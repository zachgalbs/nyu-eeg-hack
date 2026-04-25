import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { parseCookie } from '../_lib/cookies';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const userId = parseCookie(req, 'user_id');
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { rows } = await sql`
    SELECT
      u.user_id,
      u.name,
      u.avatar_url,
      s.event_title  AS last_event,
      s.focus_score  AS last_score,
      s.ended_at     AS last_summit,
      (
        SELECT COUNT(*) = 0
        FROM sessions active
        WHERE active.user_id = u.user_id
          AND active.ended_at IS NULL
          AND active.started_at > NOW() - INTERVAL '10 minutes'
      ) IS FALSE      AS is_active
    FROM friendships f
    JOIN users u ON (
      CASE WHEN f.inviter_id = ${userId} THEN f.invitee_id ELSE f.inviter_id END = u.user_id
    )
    LEFT JOIN LATERAL (
      SELECT event_title, focus_score, ended_at
      FROM sessions
      WHERE user_id = u.user_id AND ended_at IS NOT NULL
      ORDER BY ended_at DESC
      LIMIT 1
    ) s ON true
    WHERE (f.inviter_id = ${userId} OR f.invitee_id = ${userId})
      AND f.status = 'accepted'
    ORDER BY u.name
  `;

  res.json({ friends: rows });
}
