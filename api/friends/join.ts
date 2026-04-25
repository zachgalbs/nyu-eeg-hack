import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { parseCookie } from '../_lib/cookies';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = parseCookie(req, 'user_id');
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const result = await sql`
    UPDATE friendships
    SET status = 'accepted', invitee_id = ${userId}, accepted_at = NOW()
    WHERE invite_token = ${token}
      AND status = 'pending'
      AND inviter_id != ${userId}
    RETURNING id
  `;

  if (result.rowCount === 0) {
    return res.status(400).json({ error: 'Invalid or already used invite' });
  }

  res.json({ ok: true });
}
