import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

/**
 * Lists friend requests waiting for the current user's approval, plus
 * pending invites the user has issued (so they can revoke unused ones).
 *
 * Response shape:
 *   {
 *     incoming: [{ id, claimedAt, claimer: {userId, name, avatarUrl} }],
 *     outgoing: [{ id, token, status, expiresAt, claimer? }],
 *   }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { rows: incomingRows } = await sql`
    SELECT f.id, f.claimed_at, u.user_id, u.name, u.avatar_url
    FROM friendships f
    JOIN users u ON u.user_id = f.invitee_id
    WHERE f.inviter_id = ${userId}
      AND f.status = 'claimed'
    ORDER BY f.claimed_at DESC
  `;

  const { rows: outgoingRows } = await sql`
    SELECT f.id, f.invite_token, f.status, f.invite_expires_at,
           f.invitee_id, u.name AS invitee_name, u.avatar_url AS invitee_avatar
    FROM friendships f
    LEFT JOIN users u ON u.user_id = f.invitee_id
    WHERE f.inviter_id = ${userId}
      AND f.status IN ('pending', 'claimed')
    ORDER BY f.id DESC
  `;

  res.json({
    incoming: incomingRows.map((r) => ({
      id: r.id,
      claimedAt: r.claimed_at,
      claimer: {
        userId: r.user_id,
        name: r.name,
        avatarUrl: r.avatar_url,
      },
    })),
    outgoing: outgoingRows.map((r) => ({
      id: r.id,
      token: r.invite_token,
      status: r.status,
      expiresAt: r.invite_expires_at,
      claimer: r.invitee_id
        ? { userId: r.invitee_id, name: r.invitee_name, avatarUrl: r.invitee_avatar }
        : null,
    })),
  });
}
