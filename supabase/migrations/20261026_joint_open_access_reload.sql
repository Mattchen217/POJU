-- Latest joint + account prefs schema. Safe to re-run.
-- Apply in Supabase SQL Editor, then verify NOTIFY reloads PostgREST cache.

ALTER TABLE public.joint_decision_sessions
  ALTER COLUMN household_id DROP NOT NULL;

ALTER TABLE public.joint_decision_sessions
  ADD COLUMN IF NOT EXISTS unread_a BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unread_b BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invitee_email TEXT;

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

-- Account prefs (required by /api/account/summary)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_pass_low BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_marketing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

NOTIFY pgrst, 'reload schema';
