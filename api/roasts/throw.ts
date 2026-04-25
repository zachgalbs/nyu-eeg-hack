import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { getUserIdFromCookies } from '../lib/cookies';

type ThrowBody = {
  toUserId?: string;
  toName?: string;
  fromName?: string;
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const fromUserId = getUserIdFromCookies(req.headers.cookie);
  if (!fromUserId) return res.status(401).json({ error: 'Authentication required' });

  const body = (req.body ?? {}) as ThrowBody;
  if (!body.toUserId || !body.roastText) {
    return res.status(400).json({ error: 'Missing toUserId or roastText' });
  }

  try {
    await ensureRoastTable();
    const result = await sql`
      INSERT INTO roast_events (
        from_user_id, from_name, to_user_id, to_name, session_id, roast_text, trigger_source
      )
      VALUES (
        ${fromUserId},
        ${body.fromName || null},
        ${body.toUserId},
        ${body.toName || null},
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
