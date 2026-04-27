-- Persist Google refresh tokens so users don't re-OAuth every hour.
-- Runs idempotently — safe to apply repeatedly.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ;

-- Cache of LLM-classified event titles. Shared across users since the same
-- title (e.g. "Calc 1 Lecture") classifies the same way regardless of who
-- has it on their calendar. Lookups are by lowercase-trimmed title.
CREATE TABLE IF NOT EXISTS event_classifications (
  title_norm    TEXT PRIMARY KEY,
  is_academic   BOOLEAN NOT NULL,
  subject       TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user overrides win over the shared cache.
CREATE TABLE IF NOT EXISTS event_classification_overrides (
  user_id       TEXT NOT NULL,
  title_norm    TEXT NOT NULL,
  is_academic   BOOLEAN NOT NULL,
  subject       TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, title_norm)
);
