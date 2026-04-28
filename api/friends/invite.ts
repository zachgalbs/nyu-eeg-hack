import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

function getBase(req: VercelRequest) {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}

const ALLOWED_TTL_DAYS = new Set<number | null>([1, 7, 30, null]);
const DEFAULT_TTL_DAYS = 7;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  // ttlDays: number of days until link expires. null = never expires.
  // Whitelist enforced server-side.
  const raw = (req.body ?? {}).ttlDays;
  const ttlDays =
    raw === null ? null : Number.isFinite(raw) ? Number(raw) : DEFAULT_TTL_DAYS;
  if (!ALLOWED_TTL_DAYS.has(ttlDays)) {
    return res.status(400).json({ error: 'Invalid ttlDays (allowed: 1, 7, 30, null)' });
  }

  try {
    // FS-3: dedupe pending invites. Revoke any existing un-claimed pending
    // row from this user before issuing a new one. Keeps the DB clean and
    // avoids a forest of dead links a user can't track.
    await sql`
      DELETE FROM friendships
      WHERE inviter_id = ${userId}
        AND status = 'pending'
        AND invitee_id IS NULL
    `;

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt =
      ttlDays === null ? null : new Date(Date.now() + ttlDays * 86400_000);

    await sql`
      INSERT INTO friendships (inviter_id, invite_token, invite_expires_at, status)
      VALUES (${userId}, ${token}, ${expiresAt ? expiresAt.toISOString() : null}, 'pending')
    `;

    const link = `${getBase(req)}/join?token=${token}`;
    res.json({
      link,
      token,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[friends/invite]', msg);
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return res.status(409).json({ error: 'reauth_required' });
    }
    res.status(500).json({ error: msg });
  }
}
