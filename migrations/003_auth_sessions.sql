-- Server-side session store. Cookies hold an opaque random session_id;
-- user_id is looked up here. This eliminates the "edit a cookie to become
-- another user" class of bug. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  user_agent  TEXT,
  ip_addr     TEXT
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
