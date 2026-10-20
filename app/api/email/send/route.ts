import { NextResponse } from "next/server";

import { getResendFromNotify } from "@/lib/email/from-addresses";
import { sendEmail } from "@/lib/email/resend-client";
import { EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email/templates";

/**
 * @deprecated Internal / legacy template sender. Do not use for product Auth,
 * decision-report, or Companion mail — those use dedicated From addresses.
 * Templates still contain old POJU subjects; keep off user-facing paths.
 */

type SendEmailRequest = {
  to: string;
  template: EmailTemplateKey;
  variables?: Record<string, string>;
};

function render(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v), text);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<SendEmailRequest>;
  const to = String(body.to ?? "");
  const template = body.template as EmailTemplateKey | undefined;
  if (!to || !template || !(template in EMAIL_TEMPLATES)) {
    return NextResponse.json({ error: "Invalid email request" }, { status: 400 });
  }
  const picked = EMAIL_TEMPLATES[template];
  const html = `<div style="font-family:Arial,sans-serif"><h2>${picked.subject}</h2><p>${render(picked.text, body.variables)}</p></div>`;

  const result = await sendEmail({
    from: getResendFromNotify(),
    to,
    subject: picked.subject,
    html,
    logTag: "email-send-legacy",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "resend_failed", detail: result.detail },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    mocked: result.mocked === true,
    id: result.mocked ? null : result.id,
  });
}
