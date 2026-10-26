-- Joint decision: open to all users; optional household; unread flags; partner_ready.

-- Allow joints without a duo household (flex-only users).
ALTER TABLE public.joint_decision_sessions
  ALTER COLUMN household_id DROP NOT NULL;

-- Unread per seat (initiator = a, invitee = b)
ALTER TABLE public.joint_decision_sessions
  ADD COLUMN IF NOT EXISTS unread_a BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unread_b BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invitee_email TEXT;

-- Expand status check to include partner_ready
ALTER TABLE public.joint_decision_sessions
  DROP CONSTRAINT IF EXISTS joint_decision_sessions_status_check;

ALTER TABLE public.joint_decision_sessions
  ADD CONSTRAINT joint_decision_sessions_status_check
  CHECK (status IN (
    'invited',
    'accepted',
    'partner_ready',
    'running',
    'sealed',
    'canceled',
    'expired'
  ));

CREATE INDEX IF NOT EXISTS joint_decision_sessions_invitee_email_idx
  ON public.joint_decision_sessions (invitee_email)
  WHERE invitee_email IS NOT NULL;
