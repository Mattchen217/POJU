-- Duo household (2 seats, shared PASS pool) + joint decision sessions.
-- Additive. Does not alter existing flex/personal consume path until app calls new RPCs.

-- 1) Household
CREATE TABLE IF NOT EXISTS public.pass_households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL DEFAULT 'duo' CHECK (plan IN ('duo')),
  status TEXT NOT NULL DEFAULT 'pending_partner'
    CHECK (status IN ('pending_partner', 'active', 'canceled')),
  seat_a_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  seat_b_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_sub_balance INT NOT NULL DEFAULT 0 CHECK (shared_sub_balance >= 0),
  quota INT NOT NULL DEFAULT 5 CHECK (quota > 0),
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  seat_invite_token TEXT UNIQUE,
  seat_invite_email TEXT,
  seat_invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pass_households_seat_a_uidx
  ON public.pass_households (seat_a_user_id)
  WHERE status IN ('pending_partner', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS pass_households_seat_b_uidx
  ON public.pass_households (seat_b_user_id)
  WHERE seat_b_user_id IS NOT NULL AND status IN ('pending_partner', 'active');

CREATE INDEX IF NOT EXISTS pass_households_invite_token_idx
  ON public.pass_households (seat_invite_token)
  WHERE seat_invite_token IS NOT NULL;

-- 2) Joint decision sessions
CREATE TABLE IF NOT EXISTS public.joint_decision_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.pass_households(id) ON DELETE CASCADE,
  initiator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'running', 'sealed', 'canceled', 'expired')),
  pivot_session_id_a TEXT,
  pivot_session_id_b TEXT,
  pass_ref_a TEXT,
  pass_ref_b TEXT,
  -- Structured birth snapshots for server-side seed only (not exposed cross-user in list APIs).
  birth_snapshot_a JSONB,
  birth_snapshot_b JSONB,
  invite_expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS joint_decision_sessions_household_idx
  ON public.joint_decision_sessions (household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS joint_decision_sessions_user_a_idx
  ON public.joint_decision_sessions (initiator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS joint_decision_sessions_user_b_idx
  ON public.joint_decision_sessions (invitee_user_id, created_at DESC);

-- 3) Consume 1 from household shared pool (attribute usage to acting user)
CREATE OR REPLACE FUNCTION public.consume_household_pass(
  target_household_id UUID,
  target_user_id UUID,
  target_product TEXT,
  target_ref_id TEXT,
  usage_desc TEXT DEFAULT NULL
)
RETURNS TABLE(
  ok BOOLEAN,
  reason TEXT,
  balance_after INT,
  pass_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hh public.pass_households%ROWTYPE;
  flex_cur INT;
  total_after INT;
BEGIN
  IF target_product NOT IN ('atmos', 'pivot', 'match', 'syncro', 'glyph') THEN
    RETURN QUERY SELECT FALSE, 'invalid_product', 0, NULL::TEXT;
    RETURN;
  END IF;

  IF target_ref_id IS NULL OR length(trim(target_ref_id)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'invalid_ref', 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Idempotent per user+product+ref
  IF EXISTS (
    SELECT 1 FROM public.pass_usage
    WHERE user_id = target_user_id
      AND product = target_product
      AND ref_id = target_ref_id
  ) THEN
    SELECT h.shared_sub_balance INTO flex_cur
    FROM public.pass_households h WHERE h.id = target_household_id;
    RETURN QUERY SELECT TRUE, 'already_consumed', COALESCE(flex_cur, 0), 'household'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO hh
  FROM public.pass_households
  WHERE id = target_household_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'household_not_found', 0, NULL::TEXT;
    RETURN;
  END IF;

  IF hh.status NOT IN ('pending_partner', 'active') THEN
    RETURN QUERY SELECT FALSE, 'household_inactive', COALESCE(hh.shared_sub_balance, 0), NULL::TEXT;
    RETURN;
  END IF;

  IF target_user_id IS DISTINCT FROM hh.seat_a_user_id
     AND target_user_id IS DISTINCT FROM hh.seat_b_user_id THEN
    RETURN QUERY SELECT FALSE, 'not_household_member', COALESCE(hh.shared_sub_balance, 0), NULL::TEXT;
    RETURN;
  END IF;

  -- Prefer shared sub pool
  IF hh.shared_sub_balance >= 1 THEN
    UPDATE public.pass_households
    SET shared_sub_balance = shared_sub_balance - 1,
        updated_at = NOW()
    WHERE id = target_household_id;

    INSERT INTO public.pass_usage (user_id, product, ref_id, description)
    VALUES (target_user_id, target_product, target_ref_id, usage_desc);

    -- Keep pass_source column if present (migration may have added it)
    BEGIN
      UPDATE public.pass_usage
      SET pass_source = 'sub'
      WHERE user_id = target_user_id AND product = target_product AND ref_id = target_ref_id;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    RETURN QUERY SELECT TRUE, 'consumed', hh.shared_sub_balance - 1, 'household'::TEXT;
    RETURN;
  END IF;

  -- Fallback: user's flex_balance
  SELECT flex_balance INTO flex_cur
  FROM public.user_passes
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF flex_cur IS NULL OR flex_cur < 1 THEN
    RETURN QUERY SELECT FALSE, 'insufficient_balance', COALESCE(hh.shared_sub_balance, 0), NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.user_passes
  SET flex_balance = flex_balance - 1,
      pass_balance = GREATEST(0, COALESCE(pass_balance, 0) - 1),
      updated_at = NOW()
  WHERE user_id = target_user_id;

  INSERT INTO public.pass_usage (user_id, product, ref_id, description)
  VALUES (target_user_id, target_product, target_ref_id, usage_desc);

  BEGIN
    UPDATE public.pass_usage
    SET pass_source = 'flex'
    WHERE user_id = target_user_id AND product = target_product AND ref_id = target_ref_id;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  SELECT COALESCE(shared_sub_balance, 0) INTO total_after
  FROM public.pass_households WHERE id = target_household_id;

  RETURN QUERY SELECT TRUE, 'consumed', total_after, 'flex'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_household_pass(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_household_pass(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
