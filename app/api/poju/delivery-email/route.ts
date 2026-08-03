import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * User-initiated delivery-book email.
 * Body / HTML attachment provided by the client (from local session).
 * Resend retention should be short; we do not store the address server-side beyond the send.
 */

const BodySchema = z.object({
  to: z.string().email().max(320),
  title: z.string().min(1).max(500),
  body_text: z.string().min(1).max(100_000),
  locale: z.string().max(16).optional(),
  /** Printable HTML (evidence expanded) — attached when present. */
  html_attachment: z.string().max(1_200_000).optional(),
});

function toHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toBase64Utf8(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const { to, title, body_text, locale, html_attachment } = parsed.data;
  const zh = (locale ?? "").startsWith("zh");
  const subject = zh
    ? `你的 Pivot 能量决策报告 · ${title.slice(0, 80)}`
    : `Your Pivot energy decision report · ${title.slice(0, 80)}`;
  const intro = zh
    ? html_attachment
      ? "附件是你的交付报告（HTML，可在浏览器打开后打印为 PDF；依据层已展开）。正文另附纯文本备份。"
      : "以下是你在本机会话中生成的交付报告全文（纯文本）。请妥善保存。"
    : html_attachment
      ? "Attached is your delivery report (HTML — open in a browser and Print to PDF; evidence expanded). Plain text is included below as backup."
      : "Below is the delivery report generated in your local session (plain text). Please keep a copy.";

  const html = `<div style="font-family:Arial,sans-serif;color:#1a1525;max-width:720px">
  <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1>
  <p style="color:#666;font-size:13px;margin:0 0 20px">${escapeHtml(intro)}</p>
  ${toHtmlParagraphs(body_text.slice(0, 40_000))}
  <p style="color:#999;font-size:11px;margin-top:28px">${zh ? "本邮件由你主动请求发送；pojulife 不会因此建立账户。" : "Sent at your request; pojulife does not create an account from this email."}</p>
</div>`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: true, mocked: true, to });
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "noreply@easternos.com";
  const attachments =
    html_attachment && html_attachment.trim().length > 100
      ? [
          {
            filename: `pivot-delivery-${new Date().toISOString().slice(0, 10)}.html`,
            content: toBase64Utf8(html_attachment),
          },
        ]
      : undefined;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text: `${title}\n\n${intro}\n\n${body_text}`,
        ...(attachments ? { attachments } : {}),
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("[delivery-email] resend_failed", err.slice(0, 200));
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delivery-email] error", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
}
