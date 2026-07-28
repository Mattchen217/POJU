-- Dual Pass balances (flex permanent vs subscription period) + Atmos 30-day entitlements
-- Additive migration. Keeps pass_balance = flex_balance + sub_balance for compatibility.

-- 1) Dual balance columns
ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS flex_balance INT NOT NULL DEFAULT 0;

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS sub_balance INT NOT NULL DEFAULT 0;

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS sub_quota INT NOT NULL DEFAULT 0;

-- One-time backfill: existing single-pool balance → flex (permanent)
UPDATE public.user_passes
SET flex_balance = GREATEST(pass_balance, 0)
WHERE flex_balance = 0
  AND pass_balance > 0
  AND COALESCE(subscription_status, 'none') = 'none';

UPDATE public.user_passes
SET
  sub_balance = GREATEST(pass_balance, 0),
  sub_quota = GREATEST(pass_balance, 0),
  flex_balance = 0
WHERE COALESCE(subscription_status, 'none') = 'active'
  AND sub_quota = 0
  AND pass_balance > 0;

-- 2) Track which bucket was spent (optional analytics)
ALTER TABLE public.pass_usage
  ADD COLUMN IF NOT EXISTS pass_source TEXT
  CHECK (pass_source IS NULL OR pass_source IN ('flex', 'sub'));

-- 3) Atmos 30-day entitlement per account + record
CREATE TABLE IF NOT EXISTS public.atmos_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  record_key TEXT NOT NULL,
  pass_usage_ref TEXT NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, record_key)
);

CREATE INDEX IF NOT EXISTS atmos_entitlements_user_idx
  ON public.atmos_entitlements (user_id, ends_at DESC);

ALTER TABLE public.atmos_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own atmos entitlements" ON public.atmos_entitlements;
CREATE POLICY "Users read own atmos entitlements"
  ON public.atmos_entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- 4) Credit flex Passes (Buy Passes — permanent, refundable)
CREATE OR REPLACE FUNCTION public.credit_flex_passes(
  target_user_id UUID,
  passes_num INT
)
RETURNS TABLE(flex_after INT, sub_after INT, total_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f INT;
  s INT;
BEGIN
  INSERT INTO public.user_passes (user_id, pass_balance, flex_balance, sub_balance, updated_at)
  VALUES (target_user_id, GREATEST(passes_num, 0), GREATEST(passes_num, 0), 0, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    flex_balance = public.user_passes.flex_balance + GREATEST(passes_num, 0),
    pass_balance = (public.user_passes.flex_balance + GREATEST(passes_num, 0)) + public.user_passes.sub_balance,
    updated_at = NOW();

  SELECT flex_balance, sub_balance INTO f, s
  FROM public.user_passes WHERE user_id = target_user_id;

  RETURN QUERY SELECT COALESCE(f, 0), COALESCE(s, 0), COALESCE(f, 0) + COALESCE(s, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_flex_passes(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_flex_passes(UUID, INT) TO service_role;

-- 5) Grant / refresh subscription Passes (non-refundable, period-bound)
-- mode 'grant': first checkout — set sub_balance = passes_num, sub_quota = passes_num
-- mode 'renew': monthly — reset sub_balance = monthly_quota, sub_quota = monthly_quota (no rollover)
CREATE OR REPLACE FUNCTION public.credit_subscription_passes(
  target_user_id UUID,
  passes_num INT,
  plan_name TEXT,
  period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  mode TEXT DEFAULT 'grant'
)
RETURNS TABLE(flex_after INT, sub_after INT, total_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f INT;
  s INT;
  q INT;
BEGIN
  IF plan_name NOT IN ('personal', 'team') THEN
    RAISE EXCEPTION 'invalid_plan_name';
  END IF;

  q := GREATEST(passes_num, 0);

  INSERT INTO public.user_passes (
    user_id,
    pass_balance,
    flex_balance,
    sub_balance,
    sub_quota,
    subscription_status,
    subscription_plan,
    current_period_end,
    updated_at
  )
  VALUES (
    target_user_id,
    q,
    0,
    q,
    q,
    'active',
    plan_name,
    period_end,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    sub_balance = q,
    sub_quota = q,
    pass_balance = public.user_passes.flex_balance + q,
    subscription_status = 'active',
    subscription_plan = plan_name,
    current_period_end = COALESCE(period_end, public.user_passes.current_period_end),
    updated_at = NOW();

  SELECT flex_balance, sub_balance INTO f, s
  FROM public.user_passes WHERE user_id = target_user_id;

  RETURN QUERY SELECT COALESCE(f, 0), COALESCE(s, 0), COALESCE(f, 0) + COALESCE(s, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_subscription_passes(UUID, INT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_subscription_passes(UUID, INT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) TO service_role;

-- Keep legacy increment_user_passes working: flex if no plan, else subscription grant
CREATE OR REPLACE FUNCTION public.increment_user_passes(
  target_user_id UUID,
  passes_num INT,
  plan_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plan_name IN ('personal', 'team') THEN
    PERFORM public.credit_subscription_passes(
      target_user_id,
      passes_num,
      plan_name,
      NOW() + INTERVAL '30 days',
      'grant'
    );
  ELSE
    PERFORM public.credit_flex_passes(target_user_id, passes_num);
  END IF;
END;
$$;

-- 6) Consume: prefer subscription Passes, then flex. Idempotent on ref_id.
-- Must DROP first: OUT row type changed vs 20260728 (added flex_after/sub_after/pass_source).
DROP FUNCTION IF EXISTS public.consume_user_pass(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.consume_user_pass(
  target_user_id UUID,
  target_product TEXT,
  target_ref_id TEXT,
  usage_desc TEXT DEFAULT NULL
)
RETURNS TABLE(
  ok BOOLEAN,
  reason TEXT,
  balance_after INT,
  flex_after INT,
  sub_after INT,
  pass_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f INT;
  s INT;
  src TEXT;
BEGIN
  IF target_product NOT IN ('atmos', 'pivot', 'match', 'syncro', 'glyph') THEN
    RETURN QUERY SELECT FALSE, 'invalid_product', 0, 0, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF target_ref_id IS NULL OR length(trim(target_ref_id)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'invalid_ref', 0, 0, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pass_usage
    WHERE user_id = target_user_id AND product = target_product AND ref_id = target_ref_id
  ) THEN
    SELECT flex_balance, sub_balance INTO f, s
    FROM public.user_passes WHERE user_id = target_user_id;
    RETURN QUERY SELECT TRUE, 'already_consumed',
      COALESCE(f, 0) + COALESCE(s, 0), COALESCE(f, 0), COALESCE(s, 0), NULL::TEXT;
    RETURN;
  END IF;

  SELECT flex_balance, sub_balance INTO f, s
  FROM public.user_passes
  WHERE user_id = target_user_id
  FOR UPDATE;

  f := COALESCE(f, 0);
  s := COALESCE(s, 0);

  IF (f + s) < 1 THEN
    RETURN QUERY SELECT FALSE, 'insufficient_balance', 0, f, s, NULL::TEXT;
    RETURN;
  END IF;

  IF s >= 1 THEN
    s := s - 1;
    src := 'sub';
  ELSE
    f := f - 1;
    src := 'flex';
  END IF;

  UPDATE public.user_passes
  SET
    flex_balance = f,
    sub_balance = s,
    pass_balance = f + s,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  INSERT INTO public.pass_usage (user_id, product, ref_id, description, pass_source)
  VALUES (target_user_id, target_product, target_ref_id, usage_desc, src);

  RETURN QUERY SELECT TRUE, 'consumed', f + s, f, s, src;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_user_pass(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_pass(UUID, TEXT, TEXT, TEXT) TO service_role;

-- 7) Upsert Atmos 30-day window (idempotent per user+record)
CREATE OR REPLACE FUNCTION public.grant_atmos_entitlement(
  target_user_id UUID,
  target_record_key TEXT,
  target_ref_id TEXT,
  days_valid INT DEFAULT 30
)
RETURNS TABLE(ok BOOLEAN, ends_at TIMESTAMP WITH TIME ZONE, already BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_end TIMESTAMP WITH TIME ZONE;
  new_end TIMESTAMP WITH TIME ZONE;
BEGIN
  IF target_record_key IS NULL OR length(trim(target_record_key)) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, FALSE;
    RETURN;
  END IF;

  SELECT ae.ends_at INTO existing_end
  FROM public.atmos_entitlements ae
  WHERE ae.user_id = target_user_id AND ae.record_key = target_record_key;

  IF existing_end IS NOT NULL AND existing_end > NOW() THEN
    RETURN QUERY SELECT TRUE, existing_end, TRUE;
    RETURN;
  END IF;

  new_end := NOW() + make_interval(days => GREATEST(days_valid, 1));

  INSERT INTO public.atmos_entitlements (user_id, record_key, pass_usage_ref, starts_at, ends_at)
  VALUES (target_user_id, trim(target_record_key), target_ref_id, NOW(), new_end)
  ON CONFLICT (user_id, record_key) DO UPDATE SET
    pass_usage_ref = EXCLUDED.pass_usage_ref,
    starts_at = NOW(),
    ends_at = EXCLUDED.ends_at;

  RETURN QUERY SELECT TRUE, new_end, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_atmos_entitlement(UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_atmos_entitlement(UUID, TEXT, TEXT, INT) TO service_role;

-- 8) Renewal helper: reset subscription bucket only (FAQ: no rollover)
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
  PERFORM public.credit_subscription_passes(
    target_user_id,
    monthly_quota,
    plan_name,
    NOW() + INTERVAL '30 days',
    'renew'
  );
END;
$$;
