-- Path A (2026-10-19): 1 PASS = 1 Creem transaction.
-- Per-unit purchase rows support FIFO unused refunds via POST /v1/refunds { transaction_id }.

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payment_records.stripe_payment_intent_id IS
  'Provider transaction id (Creem transaction_id / Stripe PI). One PASS flex unit = one id under Path A.';

COMMENT ON COLUMN public.payment_records.refund_id IS
  'Provider refund id after full txn refund (Creem POST /v1/refunds).';

CREATE INDEX IF NOT EXISTS payment_records_user_flex_fifo_idx
  ON public.payment_records (user_id, created_at ASC)
  WHERE plan_type = 'flex_pass';

CREATE INDEX IF NOT EXISTS payment_records_provider_txn_idx
  ON public.payment_records (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
