import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { requireUser } from '../_lib/session';

type ThrowBody = {
  toUserId?: string;
  sessionId?: string;
  roastText?: string;
  trigger?: 'friend_throw' | 'auto';
};

async function ensureRoastTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS roast_events (
      id BIGSERIAL PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      from_name TEXT,
      to_user_id TEXT NOT NULL,
      to_name TEXT,
      session_id TEXT,
      roast_text TEXT NOT NULL,
      trigger_source TEXT NOT NULL DEFAULT 'friend_throw',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  switch (action) {
    case 'throw': return handleThrow(req, res);
    case 'inbox': return handleInbox(req, res);
    default: return res.status(404).json({ error: 'Unknown action' });
  }
}

async function handleThrow(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const fromUserId = await requireUser(req, res, 'Authentication required');
  if (!fromUserId) return;

  const body = (req.body ?? {}) as ThrowBody;
  if (!body.toUserId || !body.roastText) {
    return res.status(400).json({ error: 'Missing toUserId or roastText' });
  }

  const friendCheck = await sql`
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND ((inviter_id = ${fromUserId} AND invitee_id = ${body.toUserId})
        OR (inviter_id = ${body.toUserId} AND invitee_id = ${fromUserId}))
    LIMIT 1
  `;
  if (friendCheck.rowCount === 0) {
    return res.status(403).json({ error: 'Not friends with target user' });
  }

  const optCheck = await sql`
    SELECT allow_roasts FROM users WHERE user_id = ${body.toUserId} LIMIT 1
  `;
  if (optCheck.rowCount === 0 || optCheck.rows[0].allow_roasts === false) {
    return res.status(403).json({ error: 'Recipient does not accept roasts' });
  }

  const namesQuery = await sql`
    SELECT user_id, name FROM users
    WHERE user_id = ${fromUserId} OR user_id = ${body.toUserId}
  `;
  const fromName =
    namesQuery.rows.find((r) => r.user_id === fromUserId)?.name ?? null;
  const toName =
    namesQuery.rows.find((r) => r.user_id === body.toUserId)?.name ?? null;

  try {
    await ensureRoastTable();
    const result = await sql`
      INSERT INTO roast_events (
        from_user_id, from_name, to_user_id, to_name, session_id, roast_text, trigger_source
      )
      VALUES (
        ${fromUserId},
        ${fromName},
        ${body.toUserId},
        ${toName},
        ${body.sessionId || null},
        ${body.roastText},
        ${body.trigger || 'friend_throw'}
      )
      RETURNING id, from_user_id, from_name, to_user_id, to_name, session_id, roast_text, trigger_source, is_read, created_at
    `;
    return res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    console.error('[roasts/throw]', error);
    return res.status(500).json({ error: 'Failed to persist roast throw event' });
  }
}

async function handleInbox(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await requireUser(req, res, 'Authentication required');
  if (!userId) return;

  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));
  const ack = req.query.ack === 'true' || req.query.ack === '1';

  try {
    await ensureRoastTable();
    const events = await sql`
      SELECT id, from_user_id, from_name, to_user_id, to_name, session_id, roast_text, trigger_source, is_read, created_at
      FROM roast_events
      WHERE to_user_id = ${userId} AND is_read = FALSE
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    if (ack && events.rows.length > 0) {
      const ids = events.rows.map((row) => row.id);
      await sql`
        UPDATE roast_events
        SET is_read = TRUE
        WHERE id = ANY(${ids as any}::bigint[])
      `;
    }

    return res.json({ events: events.rows, acked: ack });
  } catch (error) {
    console.error('[roasts/inbox]', error);
    return res.status(500).json({ error: 'Failed to fetch roast inbox' });
  }
}
