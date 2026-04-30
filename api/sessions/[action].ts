import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  switch (action) {
    case 'start': return handleStart(req, res);
    case 'end': return handleEnd(req, res);
    default: return res.status(404).json({ error: 'Unknown action' });
  }
}

async function handleStart(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { eventTitle } = req.body ?? {};
  if (!eventTitle) return res.status(400).json({ error: 'Missing eventTitle' });

  await sql`
    UPDATE sessions
    SET ended_at = NOW()
    WHERE user_id = ${userId} AND ended_at IS NULL
  `;

  const { rows } = await sql`
    INSERT INTO sessions (user_id, event_title)
    VALUES (${userId}, ${eventTitle})
    RETURNING id
  `;

  res.json({ sessionId: rows[0].id });
}

async function handleEnd(req: VercelRequest, res: VercelResponse) {
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
