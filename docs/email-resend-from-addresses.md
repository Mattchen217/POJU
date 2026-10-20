# Resend From addresses (Eastern OS)

Production domain: **`mail.easternos.com`** (verified in Resend).  
App sends use `RESEND_API_KEY` via `lib/email/resend-client.ts`.  
Auth OTP is **not** sent by the Next app — Supabase Auth → Custom SMTP → Resend.

## Three roles

| Role | From | Env | Used by |
|------|------|-----|---------|
| Validation | `Eastern OS Validation <verify@mail.easternos.com>` | `RESEND_FROM_VERIFY` | Supabase Auth email templates (SMTP) |
| Reports | `Eastern OS Reports <reports@mail.easternos.com>` | `RESEND_FROM_REPORTS` | `POST /api/poju/delivery-email` |
| Notify | `Eastern OS <notify@mail.easternos.com>` | `RESEND_FROM_NOTIFY` | Companion drip (`lib/companion/drip-advance.ts`) |

Do **not** use `noreply@easternos.com`, `readings@`, or `checkin@` for these three.

## Supabase Dashboard (Auth OTP) — Max / ops

1. Auth → Providers → Email → enable **Confirm email**.
2. Auth → SMTP → Custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465` or `587`
   - User: `resend`
   - Password: Resend API key (or Resend SMTP credential)
   - Sender name: `Eastern OS Validation`
   - Sender email: `verify@mail.easternos.com`
3. Optional: customize OTP HTML under Auth → Email Templates (still from `verify@`).
4. App routes stay Supabase `signUp` / `resend` / `verifyOtp` — **no** parallel OTP table in Next.

Until Confirm email + SMTP are live, signup “send code” will fail regardless of `reports@` / `notify@` app config.

## Decision report mail shape

- Short fixed body (locale copy in `lib/email/report-mail-copy.ts`).
- Required attachment: interactive HTML `eastern-os-decision-report-YYYY-MM-DD.html`.
- Download uses the same filename and `buildDeliveryInteractiveHtml` output.
- Do not embed the full report in the email HTML body.

## Companion reminders

- Scheduled by Inngest `companion-drip-tick`.
- Attachment name: `eastern-os-reminder-day-NN-YYYY-MM-DD.html`.
- From: `notify@mail.easternos.com`.

## Local / no API key

If `RESEND_API_KEY` is unset, `sendEmail` logs a mock success and does not 500.
