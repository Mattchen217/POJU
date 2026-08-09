-- Plan-switch carryover + spend order: carryover → subscription → flex
-- Immediate upgrade/downgrade keeps unused sub Passes in sub_carryover.

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS sub_carryover INT NOT NULL DEFAULT 0;

ALTER TABLE public.user_passes
  ADD COLUMN IF NOT EXISTS carryover_source_plan TEXT
  CHECK (
    carryover_source_plan IS NULL
    OR carryover_source_plan IN ('personal', 'team')
  );

-- Allow pass_source = carryover
ALTER TABLE public.pass_usage DROP CONSTRAINT IF EXISTS pass_usage_pass_source_check;
ALTER TABLE public.pass_usage
  ADD CONSTRAINT pass_usage_pass_source_check
  CHECK (pass_source IS NULL OR pass_source IN ('flex', 'sub', 'carryover'));

-- Recompute total = flex + sub + carryover for existing rows
UPDATE public.user_passes
SET pass_balance = COALESCE(flex_balance, 0) + COALESCE(sub_balance, 0) + COALESCE(sub_carryover, 0);

-- Flex credit: keep carryover in total
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
  c INT;
BEGIN
  INSERT INTO public.user_passes (user_id, pass_balance, flex_balance, sub_balance, sub_carryover, updated_at)
  VALUES (target_user_id, GREATEST(passes_num, 0), GREATEST(passes_num, 0), 0, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    flex_balance = public.user_passes.flex_balance + GREATEST(passes_num, 0),
    pass_balance =
      (public.user_passes.flex_balance + GREATEST(passes_num, 0))
      + public.user_passes.sub_balance
      + COALESCE(public.user_passes.sub_carryover, 0),
    updated_at = NOW();

  SELECT flex_balance, sub_balance, COALESCE(sub_carryover, 0)
  INTO f, s, c
  FROM public.user_passes WHERE user_id = target_user_id;

  RETURN QUERY SELECT COALESCE(f, 0), COALESCE(s, 0), COALESCE(f, 0) + COALESCE(s, 0) + COALESCE(c, 0);
END;
$$;

-- mode:
--   grant  — first subscribe: set sub/quota (leave carryover)
--   renew  — monthly: reset sub/quota only (keep carryover)
--   switch — plan change: move current sub_balance into carryover, then grant new sub/quota
DROP FUNCTION IF EXISTS public.credit_subscription_passes(UUID, INT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT);

CREATE OR REPLACE FUNCTION public.credit_subscription_passes(
  target_user_id UUID,
  passes_num INT,
  plan_name TEXT,
  period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  mode TEXT DEFAULT 'grant'
)
RETURNS TABLE(
  flex_after INT,
  sub_after INT,
  carryover_after INT,
  total_after INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f INT;
  s INT;
  c INT;
  q INT;
  m TEXT;
BEGIN
  IF plan_name NOT IN ('personal', 'team') THEN
    RAISE EXCEPTION 'invalid_plan_name';
  END IF;

  m := lower(coalesce(nullif(trim(mode), ''), 'grant'));
  IF m NOT IN ('grant', 'renew', 'switch') THEN
    m := 'grant';
  END IF;

  q := GREATEST(passes_num, 0);

  PERFORM 1 FROM public.user_passes WHERE user_id = target_user_id FOR UPDATE;

  INSERT INTO public.user_passes (
    user_id,
    pass_balance,
    flex_balance,
    sub_balance,
    sub_quota,
    sub_carryover,
    carryover_source_plan,
    subscription_status,
    subscription_plan,
    pending_subscription_plan,
    current_period_end,
    updated_at
  )
  VALUES (
    target_user_id,
    q,
    0,
    q,
    q,
    0,
    NULL,
    'active',
    plan_name,
    NULL,
    period_end,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    sub_carryover = CASE
      WHEN m = 'switch' THEN
        COALESCE(public.user_passes.sub_carryover, 0) + COALESCE(public.user_passes.sub_balance, 0)
      ELSE COALESCE(public.user_passes.sub_carryover, 0)
    END,
    carryover_source_plan = CASE
      WHEN m = 'switch' AND COALESCE(public.user_passes.sub_balance, 0) > 0 THEN
        public.user_passes.subscription_plan
      ELSE public.user_passes.carryover_source_plan
    END,
    sub_balance = q,
    sub_quota = q,
    pass_balance =
      public.user_passes.flex_balance
      + q
      + CASE
          WHEN m = 'switch' THEN
            COALESCE(public.user_passes.sub_carryover, 0) + COALESCE(public.user_passes.sub_balance, 0)
          ELSE COALESCE(public.user_passes.sub_carryover, 0)
        END,
    subscription_status = 'active',
    subscription_plan = plan_name,
    pending_subscription_plan = NULL,
    current_period_end = COALESCE(period_end, public.user_passes.current_period_end),
    updated_at = NOW();

  SELECT flex_balance, sub_balance, COALESCE(sub_carryover, 0)
  INTO f, s, c
  FROM public.user_passes WHERE user_id = target_user_id;

  RETURN QUERY SELECT
    COALESCE(f, 0),
    COALESCE(s, 0),
    COALESCE(c, 0),
    COALESCE(f, 0) + COALESCE(s, 0) + COALESCE(c, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_subscription_passes(UUID, INT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_subscription_passes(UUID, INT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) TO service_role;

-- Consume: carryover → subscription → flex
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
  carryover_after INT,
  pass_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f INT;
  s INT;
  c INT;
  src TEXT;
BEGIN
  IF target_product NOT IN ('atmos', 'pivot', 'match', 'syncro', 'glyph') THEN
    RETURN QUERY SELECT FALSE, 'invalid_product', 0, 0, 0, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF target_ref_id IS NULL OR length(trim(target_ref_id)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'invalid_ref', 0, 0, 0, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pass_usage
    WHERE user_id = target_user_id AND product = target_product AND ref_id = target_ref_id
  ) THEN
    SELECT flex_balance, sub_balance, COALESCE(sub_carryover, 0) INTO f, s, c
    FROM public.user_passes WHERE user_id = target_user_id;
    RETURN QUERY SELECT TRUE, 'already_consumed',
      COALESCE(f, 0) + COALESCE(s, 0) + COALESCE(c, 0),
      COALESCE(f, 0), COALESCE(s, 0), COALESCE(c, 0), NULL::TEXT;
    RETURN;
  END IF;

  SELECT flex_balance, sub_balance, COALESCE(sub_carryover, 0)
  INTO f, s, c
  FROM public.user_passes
  WHERE user_id = target_user_id
  FOR UPDATE;

  f := COALESCE(f, 0);
  s := COALESCE(s, 0);
  c := COALESCE(c, 0);

  IF (f + s + c) < 1 THEN
    RETURN QUERY SELECT FALSE, 'insufficient_balance', 0, f, s, c, NULL::TEXT;
    RETURN;
  END IF;

  IF c >= 1 THEN
    c := c - 1;
    src := 'carryover';
  ELSIF s >= 1 THEN
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
    sub_carryover = c,
    carryover_source_plan = CASE WHEN c = 0 THEN NULL ELSE carryover_source_plan END,
    pass_balance = f + s + c,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  INSERT INTO public.pass_usage (user_id, product, ref_id, description, pass_source)
  VALUES (target_user_id, target_product, target_ref_id, usage_desc, src);

  RETURN QUERY SELECT TRUE, 'consumed', f + s + c, f, s, c, src;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_user_pass(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_pass(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Renewal: reset current plan bucket only; keep carryover + flex
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
