/**
 * @deprecated Legacy POJU-era subjects for `/api/email/send` only.
 * Do not use for Auth OTP, decision reports, or Companion reminders.
 * Product mail uses `lib/email/resend-client` + role From addresses.
 */
export type EmailTemplateKey =
  | "poju_session_started"
  | "poju_action_plan"
  | "poju_phase5_followup"
  | "poju_session_extended"
  | "poju_session_archived"
  | "glyph_reading_ready"
  | "glyph_payment_receipt"
  | "syncro_ar_receipt"
  | "syncro_window_reminder"
  | "support_auto_reply"
  | "data_export_ready";

type Template = {
  subject: string;
  text: string;
};

/** @deprecated See file header — not product SoT. */
export const EMAIL_TEMPLATES: Record<EmailTemplateKey, Template> = {
  poju_session_started: { subject: "POJU session started", text: "Your POJU session is now active for 30 days." },
  poju_action_plan: { subject: "Your POJU action plan", text: "Your Phase 4 action plan is ready." },
  poju_phase5_followup: { subject: "POJU follow-up", text: "Phase 5 follow-up is waiting for your update." },
  poju_session_extended: { subject: "Session extended", text: "Your POJU session has been extended by 30 days." },
  poju_session_archived: { subject: "Session archived", text: "Your POJU session has been archived and can be restored." },
  glyph_reading_ready: { subject: "Glyph reading ready", text: "Your Glyph reading has been generated." },
  glyph_payment_receipt: { subject: "Glyph payment receipt", text: "We received your $1.99 Glyph payment." },
  syncro_ar_receipt: { subject: "Syncro AR receipt", text: "We received your $1.99 Syncro AR payment." },
  syncro_window_reminder: { subject: "Syncro window reminder", text: "Your 5-shichen interpretation window is still active." },
  support_auto_reply: { subject: "We received your message", text: "Support has received your request and will reply soon." },
  data_export_ready: { subject: "Your data export", text: "Your requested data export is ready." },
};
