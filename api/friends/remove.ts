import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

/**
 * FS-4: unfriend. Deletes the friendship row regardless of which direction
 * it was created. Either party can unfriend; both lose access to each
 * other's activity immediately.
 *
 * POST { friendUserId: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { friendUserId } = req.body ?? {};
  if (!friendUserId || typeof friendUserId !== 'string') {
    return res.status(400).json({ error: 'Missing friendUserId' });
  }
  if (friendUserId === userId) {
    return res.status(400).json({ error: 'Cannot unfriend yourself' });
  }

  const result = await sql`
    DELETE FROM friendships
    WHERE status = 'accepted'
      AND ((inviter_id = ${userId} AND invitee_id = ${friendUserId})
        OR (inviter_id = ${friendUserId} AND invitee_id = ${userId}))
    RETURNING id
  `;

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Not friends' });
  }
  res.json({ ok: true, removed: result.rowCount });
}
