import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

/**
 * FS-12: revoke an invite the current user issued. Works on both pending
 * (no claimer yet) and claimed (awaiting my approval) rows.
 *
 * POST { friendshipId: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { friendshipId } = req.body ?? {};
  if (!friendshipId) return res.status(400).json({ error: 'Missing friendshipId' });

  const result = await sql`
    DELETE FROM friendships
    WHERE id = ${friendshipId}
      AND inviter_id = ${userId}
      AND status IN ('pending', 'claimed')
    RETURNING id
  `;

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'No matching invite to revoke' });
  }
  res.json({ ok: true });
}
