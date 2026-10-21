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

5. Auth → Email Templates → **Reset password**:
   - Same pattern as Confirm sign up: show **6-digit** `{{ .Token }}` as the primary CTA.
   - App syncs `user_metadata.lang` before `resetPasswordForEmail` — branch with `{{ .Data.lang }}`.
   - Optional: keep `{{ .ConfirmationURL }}` as a small secondary fallback for clients that prefer the link; the in-app flow verifies OTP with `verifyOtp` type `recovery`.

### Reset password — Subject (multilingual)

Put this in the **Subject** field only:

```text
{{ if eq .Data.lang "zh" }}重置您的 Eastern OS 密码{{ else if eq .Data.lang "es" }}Restablezca su contraseña de Eastern OS{{ else if eq .Data.lang "fr" }}Réinitialisez votre mot de passe Eastern OS{{ else }}Reset your Eastern OS password{{ end }}
```

### Reset password — Body (copy into Supabase)

```html
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #18181b;">

  {{ if eq .Data.lang "zh" }}
    <h2 style="margin: 0 0 12px; font-size: 20px;">重置 Eastern OS 密码</h2>
    <p style="margin: 0 0 16px; line-height: 1.55; color: #3f3f46;">使用下面的 6 位验证码在网站上设置新密码。验证码约 15 分钟内有效。</p>
  {{ else if eq .Data.lang "es" }}
    <h2 style="margin: 0 0 12px; font-size: 20px;">Restablecer contraseña de Eastern OS</h2>
    <p style="margin: 0 0 16px; line-height: 1.55; color: #3f3f46;">Usa el código de 6 dígitos para establecer una nueva contraseña en el sitio. Caduca en unos 15 minutos.</p>
  {{ else if eq .Data.lang "fr" }}
    <h2 style="margin: 0 0 12px; font-size: 20px;">Réinitialiser le mot de passe Eastern OS</h2>
    <p style="margin: 0 0 16px; line-height: 1.55; color: #3f3f46;">Utilisez le code à 6 chiffres ci-dessous pour définir un nouveau mot de passe sur le site. Valable environ 15 minutes.</p>
  {{ else }}
    <h2 style="margin: 0 0 12px; font-size: 20px;">Reset your Eastern OS password</h2>
    <p style="margin: 0 0 16px; line-height: 1.55; color: #3f3f46;">Use the 6-digit code below to set a new password on the site. It expires in about 15 minutes.</p>
  {{ end }}

  <div style="margin: 20px 0; padding: 18px 16px; text-align: center; border-radius: 12px; background: #fafafa; border: 1px solid #e4e4e7;">
    <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.28em; color: #18181b;">
      {{ .Token }}
    </div>
  </div>

  {{ if eq .Data.lang "zh" }}
    <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #71717a;">如果你没有请求重置密码，可以忽略这封邮件。</p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;"><a href="{{ .ConfirmationURL }}" style="color: #a1a1aa;">或使用此链接重置</a></p>
  {{ else if eq .Data.lang "es" }}
    <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #71717a;">Si no pediste restablecer la contraseña, ignora este correo.</p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;"><a href="{{ .ConfirmationURL }}" style="color: #a1a1aa;">O usa este enlace</a></p>
  {{ else if eq .Data.lang "fr" }}
    <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #71717a;">Si vous n’avez pas demandé de réinitialisation, ignorez cet e-mail.</p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;"><a href="{{ .ConfirmationURL }}" style="color: #a1a1aa;">Ou utilisez ce lien</a></p>
  {{ else }}
    <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #71717a;">If you did not request a password reset, you can ignore this email.</p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;"><a href="{{ .ConfirmationURL }}" style="color: #a1a1aa;">Or use this link instead</a></p>
  {{ end }}

</div>
```

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
