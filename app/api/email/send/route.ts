import { NextResponse } from "next/server";
import { EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email/templates";

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

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: true, mocked: true, to, template });
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "noreply@easternos.com";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: picked.subject,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: "resend_failed", detail: err }, { status: 502 });
  }
  const data = await response.json();
  return NextResponse.json({ ok: true, mocked: false, id: data.id ?? null });
}
