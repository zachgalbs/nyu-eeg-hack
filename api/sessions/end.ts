import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';
import { parseCookie } from '../lib/cookies';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = parseCookie(req, 'user_id');
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
