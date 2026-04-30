import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql } from '../_lib/db';
import { getUserIdFromRequest } from '../_lib/session';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  switch (action) {
    case 'list': return handleList(req, res);
    case 'incoming': return handleIncoming(req, res);
    case 'invite': return handleInvite(req, res);
    case 'join': return handleJoin(req, res);
    case 'respond': return handleRespond(req, res);
    case 'revoke': return handleRevoke(req, res);
    case 'remove': return handleRemove(req, res);
    default: return res.status(404).json({ error: 'Unknown action' });
  }
}

async function handleList(req: VercelRequest, res: VercelResponse) {
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

  const friends = rows.map((r) => {
    let lastActivity: string | null = null;
    if (r.last_summit) {
      if (r.last_is_academic && r.last_subject) lastActivity = String(r.last_subject);
      else if (r.last_is_academic) lastActivity = 'studying';
      else lastActivity = null;
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

async function handleIncoming(req: VercelRequest, res: VercelResponse) {
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

function getBase(_req: VercelRequest) {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}

const ALLOWED_TTL_DAYS = new Set<number | null>([1, 7, 30, null]);
const DEFAULT_TTL_DAYS = 7;

async function handleInvite(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const raw = (req.body ?? {}).ttlDays;
  const ttlDays =
    raw === null ? null : Number.isFinite(raw) ? Number(raw) : DEFAULT_TTL_DAYS;
  if (!ALLOWED_TTL_DAYS.has(ttlDays)) {
    return res.status(400).json({ error: 'Invalid ttlDays (allowed: 1, 7, 30, null)' });
  }

  try {
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

async function handleJoin(req: VercelRequest, res: VercelResponse) {
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

async function handleRespond(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { friendshipId, action: respondAction } = req.body ?? {};
  if (!friendshipId || (respondAction !== 'accept' && respondAction !== 'decline')) {
    return res.status(400).json({ error: 'Missing friendshipId or invalid action' });
  }

  if (respondAction === 'accept') {
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

async function handleRevoke(req: VercelRequest, res: VercelResponse) {
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

async function handleRemove(req: VercelRequest, res: VercelResponse) {
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
