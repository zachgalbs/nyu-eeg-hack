import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

/**
 * Lists accepted friends with safe activity context. We DO NOT return the
 * raw event_title (could leak "Therapy with Dr. Smith" or "Job interview
 * prep"). Instead we surface the canonical academic subject from the
 * classifier, falling back to a generic label.
 *
 * Closes FS-6 (privacy on activity share). Only status='accepted' rows are
 * returned, completing FS-5 (mutual confirmation).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { rows } = await sql`
    WITH friend_pairs AS (
      SELECT
        CASE WHEN f.inviter_id = ${userId} THEN f.invitee_id ELSE f.inviter_id END
          AS friend_user_id
      FROM friendships f
      WHERE (f.inviter_id = ${userId} OR f.invitee_id = ${userId})
        AND f.status = 'accepted'
    ),
    last_session AS (
      SELECT DISTINCT ON (s.user_id)
        s.user_id, s.event_title, s.focus_score, s.ended_at
      FROM sessions s
      JOIN friend_pairs fp ON fp.friend_user_id = s.user_id
      WHERE s.ended_at IS NOT NULL
      ORDER BY s.user_id, s.ended_at DESC
    ),
    active AS (
      SELECT DISTINCT ON (s.user_id) s.user_id, true AS is_active
      FROM sessions s
      JOIN friend_pairs fp ON fp.friend_user_id = s.user_id
      WHERE s.ended_at IS NULL
        AND s.started_at > NOW() - INTERVAL '4 hours'
    )
    SELECT
      u.user_id,
      u.name,
      u.avatar_url,
      ec.subject AS last_subject,
      ec.is_academic AS last_is_academic,
      ls.focus_score AS last_score,
      ls.ended_at AS last_summit,
      COALESCE(a.is_active, false) AS is_active
    FROM friend_pairs fp
    JOIN users u ON u.user_id = fp.friend_user_id
    LEFT JOIN last_session ls ON ls.user_id = u.user_id
    LEFT JOIN event_classifications ec ON ec.title_norm = LOWER(TRIM(ls.event_title))
    LEFT JOIN active a ON a.user_id = u.user_id
    ORDER BY u.name
  `;

  // Map the raw row into a safe shape: never include the raw event_title.
  // `last_activity` is a short, non-sensitive label.
  const friends = rows.map((r) => {
    let lastActivity: string | null = null;
    if (r.last_summit) {
      if (r.last_is_academic && r.last_subject) lastActivity = String(r.last_subject);
      else if (r.last_is_academic) lastActivity = 'studying';
      else lastActivity = null; // non-academic event — don't leak
    }
    return {
      user_id: r.user_id,
      name: r.name,
      avatar_url: r.avatar_url,
      last_activity: lastActivity,
      last_score: r.last_score,
      last_summit: r.last_summit,
      is_active: r.is_active,
    };
  });

  res.json({ friends });
}
