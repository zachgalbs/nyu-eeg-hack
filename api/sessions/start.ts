import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { parseCookie } from '../_lib/cookies';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = parseCookie(req, 'user_id');
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { eventTitle } = req.body ?? {};
  if (!eventTitle) return res.status(400).json({ error: 'Missing eventTitle' });

  const { rows } = await sql`
    INSERT INTO sessions (user_id, event_title)
    VALUES (${userId}, ${eventTitle})
    RETURNING id
  `;

  res.json({ sessionId: rows[0].id });
}
