-- Pending subscription plan switch — applied on next renewal cycle only.

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS pending_subscription_plan TEXT
  CHECK (
    pending_subscription_plan IS NULL
    OR pending_subscription_plan IN ('personal', 'team')
  );

COMMENT ON COLUMN public.user_passes.pending_subscription_plan IS
  'Scheduled plan switch; applied on next subscription_cycle renewal, not immediately.';
