import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from './db';

export type Classification = {
  isAcademic: boolean;
  subject: string | null;
};

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const PROMPT_INSTRUCTIONS = `You classify calendar event titles for a study app.

For each title, decide:
- isAcademic: true if it represents study, lectures, exams, problem sets,
  recitations, labs, group study, or office hours. False for gym, meals,
  social, errands, work meetings, doctor appts, generic reminders.
- subject: a short canonical subject name (e.g. "Calculus", "Linear Algebra",
  "CS 101", "Organic Chemistry") if academic. null if not academic.

Group related titles under one subject — "Calc 1 lecture", "Calc review",
and "Calc study w/ Sam" all share subject "Calculus".

Return ONLY a JSON array, same length and order as input, shape:
[{"isAcademic": bool, "subject": string|null}]
No prose, no code fences.`;

/**
 * Cheap, deterministic first pass before we hit the LLM. Catches the
 * obvious cases so the free-tier Gemini quota goes further.
 */
const ACADEMIC_KEYWORDS = [
  'lecture', 'lect.', 'recitation', 'lab', 'seminar', 'discussion section',
  'study', 'studying', 'review session', 'exam', 'midterm', 'final',
  'quiz', 'problem set', 'pset', 'homework', 'hw ', 'office hours',
  'oh ', 'o.h.', 'tutoring', 'tutor', 'class', 'reading', 'thesis',
  'research', 'paper draft', 'essay',
];
const NON_ACADEMIC_KEYWORDS = [
  'gym', 'workout', 'lift', 'run ', 'running', 'yoga', 'climbing',
  'lunch', 'dinner', 'breakfast', 'coffee', 'brunch', 'meal',
  'doctor', 'dentist', 'therapy', 'haircut', 'laundry', 'groceries',
  'birthday', 'party', 'date', 'hang ', 'hangout', 'movie',
  'standup', '1:1', 'one on one', 'sync', 'all hands', 'stand-up',
];

function heuristic(norm: string): Classification | null {
  const padded = ` ${norm} `;
  for (const kw of NON_ACADEMIC_KEYWORDS) {
    if (padded.includes(` ${kw}`) || padded.includes(`${kw} `)) {
      return { isAcademic: false, subject: null };
    }
  }
  for (const kw of ACADEMIC_KEYWORDS) {
    if (padded.includes(kw)) {
      // Don't try to extract a subject heuristically — that's where the
      // LLM (or future user override) earns its keep. Mark academic with
      // null subject; subject will be filled in by the LLM call once a
      // misclassified title is sent there. To keep things simple and
      // ensure subjects flow through, return null here so this title
      // still goes to the LLM. If you want to skip the LLM entirely,
      // return { isAcademic: true, subject: null } instead.
      return null;
    }
  }
  return null;
}

/**
 * Classify titles, using cache where possible. Misses are sent to Gemini
 * in a single batch call and persisted to the cache.
 */
export async function classifyTitles(
  titles: string[],
  userId: string | null,
): Promise<Map<string, Classification>> {
  const norms = Array.from(new Set(titles.map(normalizeTitle)));
  const out = new Map<string, Classification>();
  if (norms.length === 0) return out;

  // Per-user overrides win.
  if (userId) {
    const placeholders = norms.map((_, i) => `$${i + 2}`).join(',');
    const { rows: overrides } = await sql.query(
      `SELECT title_norm, is_academic, subject
       FROM event_classification_overrides
       WHERE user_id = $1 AND title_norm IN (${placeholders})`,
      [userId, ...norms],
    );
    for (const r of overrides) {
      out.set(r.title_norm as string, {
        isAcademic: r.is_academic as boolean,
        subject: (r.subject as string) ?? null,
      });
    }
  }

  const remaining = norms.filter((n) => !out.has(n));

  // Shared classification cache.
  if (remaining.length > 0) {
    const placeholders = remaining.map((_, i) => `$${i + 1}`).join(',');
    const { rows: cached } = await sql.query(
      `SELECT title_norm, is_academic, subject
       FROM event_classifications
       WHERE title_norm IN (${placeholders})`,
      remaining,
    );
    for (const r of cached) {
      out.set(r.title_norm as string, {
        isAcademic: r.is_academic as boolean,
        subject: (r.subject as string) ?? null,
      });
    }
  }

  // Heuristic for the obvious non-academic cases — no LLM needed.
  for (const norm of norms) {
    if (out.has(norm)) continue;
    const h = heuristic(norm);
    if (h) {
      out.set(norm, h);
      sql.query(
        `INSERT INTO event_classifications (title_norm, is_academic, subject, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (title_norm) DO UPDATE
           SET is_academic = EXCLUDED.is_academic,
               subject = EXCLUDED.subject,
               updated_at = NOW()`,
        [norm, h.isAcademic, h.subject],
      ).catch((err) => console.error('classification cache write failed', err));
    }
  }

  const misses = norms.filter((n) => !out.has(n));
  if (misses.length === 0) return out;

  // Batch-classify misses with one Gemini call. gemini-2.0-flash is on the
  // free tier with generous quota — far more than the ~1 call/week-fetch
  // we'll make once the cache is warm.
  let llmResults: Classification[] = [];
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(
      `${PROMPT_INSTRUCTIONS}\n\nTitles to classify (in order):\n${JSON.stringify(misses)}`,
    );
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    llmResults = JSON.parse(jsonStr);
  } catch (err) {
    console.error('classifyTitles llm failed', err);
    llmResults = misses.map(() => ({ isAcademic: false, subject: null }));
  }

  for (let i = 0; i < misses.length; i++) {
    const norm = misses[i];
    const result = llmResults[i] ?? { isAcademic: false, subject: null };
    const cls: Classification = {
      isAcademic: !!result.isAcademic,
      subject: result.subject ?? null,
    };
    out.set(norm, cls);

    sql.query(
      `INSERT INTO event_classifications (title_norm, is_academic, subject, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (title_norm) DO UPDATE
         SET is_academic = EXCLUDED.is_academic,
             subject = EXCLUDED.subject,
             updated_at = NOW()`,
      [norm, cls.isAcademic, cls.subject],
    ).catch((err) => console.error('classification cache write failed', err));
  }

  return out;
}
