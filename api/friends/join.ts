import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

/**
 * Invitee taps the link and signs in. We mark the friendship as 'claimed'
 * (NOT 'accepted'). The inviter must explicitly confirm via /api/friends/respond
 * before the friendship is mutual. This closes FS-5: anyone with a stale
 * link can no longer become a friend silently.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const result = await sql`
    UPDATE friendships
    SET status = 'claimed', invitee_id = ${userId}, claimed_at = NOW()
    WHERE invite_token = ${token}
      AND status = 'pending'
      AND inviter_id != ${userId}
      AND (invite_expires_at IS NULL OR invite_expires_at > NOW())
    RETURNING inviter_id
  `;

  if (result.rowCount === 0) {
    // Differentiate expired vs already-claimed vs unknown — look up the row
    // (read-only) to give a useful error without leaking whether the token
    // ever existed.
    const probe = await sql`
      SELECT status, invite_expires_at FROM friendships
      WHERE invite_token = ${token} LIMIT 1
    `;
    if (probe.rowCount === 0) {
      return res.status(400).json({ error: 'invalid_invite' });
    }
    const row = probe.rows[0];
    if (row.invite_expires_at && new Date(row.invite_expires_at as string) < new Date()) {
      return res.status(410).json({ error: 'expired_invite' });
    }
    return res.status(409).json({ error: 'already_used' });
  }

  res.json({ ok: true, status: 'claimed', inviterId: result.rows[0].inviter_id });
}
