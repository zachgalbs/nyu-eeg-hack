import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';
import { normalizeTitle } from '../_lib/classify';

/**
 * Per-user override for academic classification. Lets a user mark
 * "Calc lecture" as not-study or vice-versa.
 *
 * POST { title: string, isAcademic: boolean, subject?: string|null }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not signed in' });

  const { title, isAcademic, subject } = req.body ?? {};
  if (typeof title !== 'string' || typeof isAcademic !== 'boolean') {
    return res.status(400).json({ error: 'Bad payload' });
  }
  const norm = normalizeTitle(title);
  if (!norm) return res.status(400).json({ error: 'Empty title' });

  await sql`
    INSERT INTO event_classification_overrides (user_id, title_norm, is_academic, subject, updated_at)
    VALUES (${userId}, ${norm}, ${isAcademic}, ${subject ?? null}, NOW())
    ON CONFLICT (user_id, title_norm) DO UPDATE
      SET is_academic = EXCLUDED.is_academic,
          subject = EXCLUDED.subject,
          updated_at = NOW()
  `;

  res.json({ ok: true });
}
