import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { sessionId, focusScore } = req.body ?? {};
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  await sql`
    UPDATE sessions
    SET ended_at = NOW(), focus_score = ${focusScore ?? null}
    WHERE id = ${sessionId} AND user_id = ${userId}
  `;

  res.json({ ok: true });
}
