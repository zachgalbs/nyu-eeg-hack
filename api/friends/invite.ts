import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql } from '../lib/db';
import { parseCookie } from '../lib/cookies';

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

  const token = crypto.randomBytes(16).toString('hex');

  await sql`
    INSERT INTO friendships (inviter_id, invite_token)
    VALUES (${userId}, ${token})
  `;

  const link = `${getBase(req)}/join?token=${token}`;
  res.json({ link });
}
