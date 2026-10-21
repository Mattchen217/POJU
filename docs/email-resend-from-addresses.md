# Resend From addresses (Eastern OS)

Production domain: **`mail.easternos.com`** (verified in Resend).  
App sends use the official **`resend`** Node SDK (`resend@^6`) via `lib/email/resend-client.ts` + `RESEND_API_KEY`.  
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
3. Auth → Email Templates → **Confirm sign up**:
   - Do **not** use the default “click Confirm email address” link as the primary CTA.
   - Show the **6-digit** `{{ .Token }}` (app verifies with `verifyOtp` type `signup`).
   - App writes `user_metadata.lang` (`zh` \| `en` \| `es` \| `fr`) on signup/resend — branch copy with Go templates on `{{ .Data.lang }}`.
4. App routes stay Supabase `signUp` / `resend` / `verifyOtp` — **no** parallel OTP table in Next.

### Confirm sign up — Subject (multilingual)

Put this in the **Subject** field only (not in Body):

```text
{{ if eq .Data.lang "zh" }}验证您的 Eastern OS 邮箱{{ else if eq .Data.lang "es" }}Verifique su correo para Eastern OS{{ else if eq .Data.lang "fr" }}Vérifiez votre e-mail pour Eastern OS{{ else }}Verify your email for Eastern OS{{ end }}
```

### Confirm sign up — Body

- Show `{{ .Token }}` only (no “Confirm email address” link as primary CTA).
- Branch on `{{ .Data.lang }}` (`zh` \| `en` \| `es` \| `fr`). App also sets `locale` as an alias.
- **Do not** promise “double-click / long-press to copy” in the email — most clients (Gmail etc.) strip `user-select` and block clipboard JS. Users select the digits manually, or use mobile keyboard autofill on the website (`autocomplete="one-time-code"`).

Until Confirm email + SMTP + Token template are live, signup “send code” will not match the in-app OTP UI.

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
