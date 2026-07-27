# OTP Auth + Intent Checkout (V2 Landing)

## Flow

1. User clicks a pricing CTA on V2 landing (`flex_pass` / `personal_plan` / `team_plan`).
2. Intent is saved to `localStorage.pending_intent`.
3. Auth Modal opens (email → 6-digit OTP) — no page navigation.
4. After `verifyOtp`, frontend calls `/api/checkout/create` and redirects to Stripe Checkout (or mock URL when gateway off).

## Providers

| Role | Service | Notes |
|------|---------|-------|
| Auth / JWT | Supabase Auth | Email OTP, `shouldCreateUser: true` |
| OTP email | Resend via Supabase Custom SMTP | Host `smtp.resend.com`, port 465/587 |
| Payments | Stripe Checkout | Flex = one-time; Personal/Team = subscription |

## Env

See `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `RESEND_*` (app email + SMTP credentials in Supabase dashboard)

## API

| Route | Purpose |
|-------|---------|
| `POST /api/auth/otp/send` | Send OTP (+ email 60s / IP 10/h rate limits) |
| `POST /api/auth/otp/verify` | Verify OTP → user + access_token |
| `POST /api/checkout/create` | Create Stripe session from pending intent |
| `POST /api/webhooks/stripe` | `checkout.session.completed` → credit passes |

When Supabase / Stripe / `PAYMENT_GATEWAY_ENABLED=false`, APIs return **mock** success so UI can be tested locally (any 6-digit code).

## Database

Run `supabase/migrations/20260727_otp_auth_passes.sql` in Supabase SQL Editor:

- `profiles`, `user_passes`, `payment_records`
- `handle_new_user` trigger
- `increment_user_passes` RPC

## UI

Auth Modal lives inside V2 landing HTML (`public/v2-landing.html` + synced copies), styled to match V2 gold glass (references: `d:\POJU\注册1-4.HTML`).

## Enable live payments

1. Configure Supabase Auth Email + Custom SMTP (Resend).
2. Set Stripe keys + webhook → `/api/webhooks/stripe`.
3. Flip `PAYMENT_GATEWAY_ENABLED` to `true` in `lib/payments/gateway-enabled.ts`.
