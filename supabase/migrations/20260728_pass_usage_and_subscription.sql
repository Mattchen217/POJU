-- Pass usage ledger + atomic consume RPC + subscription lifecycle columns
-- Additive only — does not alter existing table semantics.
-- Strategy note (Phase 4): monthly top-up will use max(balance, monthly_quota) — strategy B.

-- 1) Usage ledger: one row per Pass spent (= account page usage history)
CREATE TABLE IF NOT EXISTS public.pass_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('atmos', 'pivot', 'match', 'syncro', 'glyph')),
  ref_id TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotency: same delivery/session cannot be charged twice
CREATE UNIQUE INDEX IF NOT EXISTS pass_usage_dedup_idx
  ON public.pass_usage (user_id, product, ref_id);

CREATE INDEX IF NOT EXISTS pass_usage_user_idx
  ON public.pass_usage (user_id, created_at DESC);

-- 2) Atomic consume: check balance → debit 1 → insert usage (one transaction)
CREATE OR REPLACE FUNCTION public.consume_user_pass(
  target_user_id UUID,
  target_product TEXT,
  target_ref_id TEXT,
  usage_desc TEXT DEFAULT NULL
)
RETURNS TABLE(ok BOOLEAN, reason TEXT, balance_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur INT;
BEGIN
  IF target_product NOT IN ('atmos', 'pivot', 'match', 'syncro', 'glyph') THEN
    RETURN QUERY SELECT FALSE, 'invalid_product', 0;
    RETURN;
  END IF;

  IF target_ref_id IS NULL OR length(trim(target_ref_id)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'invalid_ref', 0;
    RETURN;
  END IF;

  -- Idempotent: already charged for this delivery
  IF EXISTS (
    SELECT 1
    FROM public.pass_usage
    WHERE user_id = target_user_id
      AND product = target_product
      AND ref_id = target_ref_id
  ) THEN
    SELECT pass_balance INTO cur FROM public.user_passes WHERE user_id = target_user_id;
    RETURN QUERY SELECT TRUE, 'already_consumed', COALESCE(cur, 0);
    RETURN;
  END IF;

  SELECT pass_balance INTO cur
  FROM public.user_passes
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF cur IS NULL OR cur < 1 THEN
    RETURN QUERY SELECT FALSE, 'insufficient_balance', COALESCE(cur, 0);
    RETURN;
  END IF;

  UPDATE public.user_passes
  SET pass_balance = pass_balance - 1,
      updated_at = NOW()
  WHERE user_id = target_user_id;

  INSERT INTO public.pass_usage (user_id, product, ref_id, description)
  VALUES (target_user_id, target_product, target_ref_id, usage_desc);

  RETURN QUERY SELECT TRUE, 'consumed', cur - 1;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_user_pass(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_pass(UUID, TEXT, TEXT, TEXT) TO service_role;

-- 3) Subscription management columns (month reset / cancel / portal)
-- profiles.stripe_customer_id already exists in 20260727_otp_auth_passes.sql — IF NOT EXISTS is a no-op.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- 4) RLS: users read only their own usage rows
ALTER TABLE public.pass_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own usage" ON public.pass_usage;
CREATE POLICY "Users read own usage"
  ON public.pass_usage FOR SELECT
  USING (auth.uid() = user_id);

-- 5) Strategy B helper for subscription renewals (used in Phase 4 webhook)
-- Ensures subscriber has at least monthly quota without wiping flex Pass purchases.
CREATE OR REPLACE FUNCTION public.topup_subscription_passes(
  target_user_id UUID,
  monthly_quota INT,
  plan_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plan_name NOT IN ('personal', 'team') THEN
    RAISE EXCEPTION 'invalid_plan_name';
  END IF;

  INSERT INTO public.user_passes (
    user_id,
    pass_balance,
    subscription_status,
    subscription_plan,
    updated_at
  )
  VALUES (
    target_user_id,
    GREATEST(monthly_quota, 0),
    'active',
    plan_name,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    pass_balance = GREATEST(public.user_passes.pass_balance, GREATEST(monthly_quota, 0)),
    subscription_status = 'active',
    subscription_plan = plan_name,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.topup_subscription_passes(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.topup_subscription_passes(UUID, INT, TEXT) TO service_role;
