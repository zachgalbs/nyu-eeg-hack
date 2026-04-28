import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

/**
 * Inviter accepts or declines a claimed friendship.
 * POST { friendshipId: number, action: 'accept' | 'decline' }
 *
 * Only the inviter (the user whose link was used) can respond. A decline
 * deletes the row; an accept moves status to 'accepted'.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { friendshipId, action } = req.body ?? {};
  if (!friendshipId || (action !== 'accept' && action !== 'decline')) {
    return res.status(400).json({ error: 'Missing friendshipId or invalid action' });
  }

  if (action === 'accept') {
    const result = await sql`
      UPDATE friendships
      SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${friendshipId}
        AND inviter_id = ${userId}
        AND status = 'claimed'
      RETURNING id
    `;
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No matching pending request' });
    }
    return res.json({ ok: true, status: 'accepted' });
  }

  // decline: remove the row entirely so the invitee can be re-invited later
  // if relationships change.
  const result = await sql`
    DELETE FROM friendships
    WHERE id = ${friendshipId}
      AND inviter_id = ${userId}
      AND status = 'claimed'
    RETURNING id
  `;
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'No matching pending request' });
  }
  res.json({ ok: true, status: 'declined' });
}
