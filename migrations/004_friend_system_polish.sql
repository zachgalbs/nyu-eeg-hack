-- Friend system polish: invite expiry, mutual-confirmation states,
-- roast opt-out. Idempotent.

-- FS-2: invite token expiry (NULL = never expires for the "permanent
-- link" case the user opted into).
ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- FS-5: mutual-confirmation state machine.
--   'pending'  — token issued, no claimer yet (inviter waiting)
--   'claimed'  — invitee tapped the link, awaiting inviter approval
--   'accepted' — both sides confirmed; this is the only state visible in /friends/list
--   'declined' — inviter rejected the claim
ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- FS-9: per-user roast opt-out. Default true preserves existing behaviour.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allow_roasts BOOLEAN NOT NULL DEFAULT TRUE;

-- Helpful indices for the new query shapes.
CREATE INDEX IF NOT EXISTS friendships_inviter_status_idx
  ON friendships(inviter_id, status);
CREATE INDEX IF NOT EXISTS friendships_invitee_status_idx
  ON friendships(invitee_id, status);
