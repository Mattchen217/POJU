-- Account prefs + email-nullable profiles (phone-only OAuth until email verified)

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_pass_low BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_marketing BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Keep handle_new_user safe when NEW.email is null (X phone-only)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email);

  INSERT INTO public.user_passes (user_id, pass_balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
