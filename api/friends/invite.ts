import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql } from '../_lib/db';
import { parseCookie } from '../_lib/cookies';

function getBase(req: VercelRequest) {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = parseCookie(req, 'user_id');
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const token = crypto.randomBytes(16).toString('hex');

    await sql`
      INSERT INTO friendships (inviter_id, invite_token)
      VALUES (${userId}, ${token})
    `;

    const link = `${getBase(req)}/join?token=${token}`;
    res.json({ link });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[friends/invite]', msg);
    // FK violation means the user row doesn't exist yet — they need to re-login
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return res.status(409).json({ error: 'reauth_required' });
    }
    res.status(500).json({ error: msg });
  }
}
