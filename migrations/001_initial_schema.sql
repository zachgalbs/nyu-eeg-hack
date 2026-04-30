-- Base schema, reverse-engineered from the queries in api/. Idempotent.
-- Apply this first on a fresh database, then 002, 003, 004 in order.
-- The pre-existing prod database already has these tables (created
-- out-of-band before this migration was committed); on prod this file
-- is a no-op thanks to IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,
  name        TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  id            BIGSERIAL PRIMARY KEY,
  inviter_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invitee_id    TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',
  invite_token  TEXT UNIQUE,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS friendships_invite_token_idx ON friendships(invite_token);

CREATE TABLE IF NOT EXISTS sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_title  TEXT,
  focus_score  NUMERIC,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_user_started_idx ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_active_idx ON sessions(user_id) WHERE ended_at IS NULL;
