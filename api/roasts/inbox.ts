import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { getUserIdFromCookies } from '../lib/cookies';

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = getUserIdFromCookies(req.headers.cookie);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

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
