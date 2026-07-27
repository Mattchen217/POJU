-- OTP Auth + Pass ledger (Supabase PostgreSQL)
-- Run in Supabase SQL Editor (or via migration pipeline).

-- 1. User profile extension (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Pass balance + subscription ledger
CREATE TABLE IF NOT EXISTS public.user_passes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  pass_balance INT DEFAULT 0 NOT NULL,
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('active', 'canceled', 'none')),
  subscription_plan TEXT CHECK (subscription_plan IS NULL OR subscription_plan IN ('personal', 'team')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Payment audit trail (idempotent webhook handling)
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  plan_type TEXT NOT NULL,
  quantity INT DEFAULT 1,
  amount_cents INT,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_records_user_id_idx ON public.payment_records (user_id);

-- 4. Auto-init profile + passes on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_passes (user_id, pass_balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Atomic pass credit (used by Stripe webhook)
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
  INSERT INTO public.user_passes (user_id, pass_balance, subscription_status, subscription_plan, updated_at)
  VALUES (
    target_user_id,
    GREATEST(passes_num, 0),
    CASE WHEN plan_name IN ('personal', 'team') THEN 'active' ELSE 'none' END,
    CASE WHEN plan_name IN ('personal', 'team') THEN plan_name ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    pass_balance = public.user_passes.pass_balance + GREATEST(passes_num, 0),
    subscription_status = CASE
      WHEN plan_name IN ('personal', 'team') THEN 'active'
      ELSE public.user_passes.subscription_status
    END,
    subscription_plan = CASE
      WHEN plan_name IN ('personal', 'team') THEN plan_name
      ELSE public.user_passes.subscription_plan
    END,
    updated_at = NOW();
END;
$$;

-- 6. RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users read own passes"
  ON public.user_passes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own payments"
  ON public.payment_records FOR SELECT
  USING (auth.uid() = user_id);
