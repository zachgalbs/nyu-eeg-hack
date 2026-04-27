import Anthropic from '@anthropic-ai/sdk';
import { sql } from './db';

export type Classification = {
  isAcademic: boolean;
  subject: string | null;
};

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

const client = new Anthropic();

const SYSTEM_PROMPT = `You classify calendar event titles for a study app.

For each title, decide:
- isAcademic: true if it represents study, lectures, exams, problem sets,
  recitations, labs, group study, or office hours. False for gym, meals,
  social, errands, work meetings, doctor appts, generic reminders.
- subject: a short canonical subject name (e.g. "Calculus", "Linear Algebra",
  "CS 101", "Organic Chemistry") if academic. null if not academic.

Group related titles under one subject — "Calc 1 lecture", "Calc review",
and "Calc study w/ Sam" all share subject "Calculus".

Return ONLY a JSON array, same order as input, with shape:
[{"isAcademic": bool, "subject": string|null}]`;

/**
 * Classify titles, using cache where possible. Misses are sent to Claude in
 * a single batch call and persisted to the cache.
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

  const misses = norms.filter((n) => !out.has(n));
  if (misses.length === 0) return out;

  // Batch-classify the misses with one Claude call.
  let llmResults: Classification[] = [];
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify these titles in order:\n${JSON.stringify(misses)}`,
        },
      ],
    });
    const raw = (msg.content[0] as { text: string }).text.trim();
    const jsonStr = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    llmResults = JSON.parse(jsonStr);
  } catch (err) {
    // Classifier is best-effort — fall back to "not academic, no subject"
    // rather than blocking the calendar fetch.
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

    // Persist (best-effort, don't block on it).
    sql`
      INSERT INTO event_classifications (title_norm, is_academic, subject, updated_at)
      VALUES (${norm}, ${cls.isAcademic}, ${cls.subject}, NOW())
      ON CONFLICT (title_norm) DO UPDATE
        SET is_academic = EXCLUDED.is_academic,
            subject = EXCLUDED.subject,
            updated_at = NOW()
    `.catch((err) => console.error('classification cache write failed', err));
  }

  return out;
}
