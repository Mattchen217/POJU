-- Companion drip jobs (primary/backup daily reminders). Payload is authoritative JSON.

CREATE TABLE IF NOT EXISTS public.companion_jobs (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  profile_id TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  mail_opt_in BOOLEAN NOT NULL DEFAULT true,
  delivery_day_key DATE NOT NULL,
  ends_day_key DATE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS companion_jobs_session_idx
  ON public.companion_jobs (session_id)
  WHERE purged_at IS NULL;

CREATE INDEX IF NOT EXISTS companion_jobs_active_idx
  ON public.companion_jobs (ends_day_key)
  WHERE purged_at IS NULL;

ALTER TABLE public.companion_jobs ENABLE ROW LEVEL SECURITY;
