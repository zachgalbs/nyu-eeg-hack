import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireUser } from '../_lib/session';

/**
 * Read or update user preferences. Currently surfaces:
 *   - allow_roasts: per-user opt-out (FS-9)
 *
 * GET  -> { allowRoasts: boolean }
 * POST { allowRoasts?: boolean } -> updated record
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await requireUser(req, res, 'Not logged in');
  if (!userId) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT allow_roasts FROM users WHERE user_id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'User missing' });
    return res.json({ allowRoasts: rows[0].allow_roasts !== false });
  }

  if (req.method === 'POST') {
    const { allowRoasts } = req.body ?? {};
    if (typeof allowRoasts !== 'boolean') {
      return res.status(400).json({ error: 'Missing or invalid allowRoasts' });
    }
    await sql`
      UPDATE users SET allow_roasts = ${allowRoasts} WHERE user_id = ${userId}
    `;
    return res.json({ ok: true, allowRoasts });
  }

  return res.status(405).end();
}
