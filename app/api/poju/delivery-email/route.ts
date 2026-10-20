import { NextResponse } from "next/server";
import { z } from "zod";

import { getResendFromReports } from "@/lib/email/from-addresses";
import { sendEmail } from "@/lib/email/resend-client";
import {
  getBaselinePackMailCopy,
  getDecisionReportMailCopy,
} from "@/lib/email/report-mail-copy";

/**
 * User-initiated decision-report / baseline email.
 * Body = short fixed copy; substance = interactive HTML attachment only.
 */

const BodySchema = z.object({
  to: z.string().email().max(320),
  title: z.string().min(1).max(500),
  /** @deprecated Ignored for delivery packs — report lives in the attachment. */
  body_text: z.string().max(100_000).optional(),
  locale: z.string().max(16).optional(),
  /** Interactive offline HTML (TOC + details); required for successful send. */
  html_attachment: z.string().max(10_000_000).optional(),
  /**
   * Pack chrome for email subject / attachment name.
   * baseline = Personal baseline profile (vault matrix pack).
   * delivery (default) = Eastern OS decision report.
   */
  pack: z.enum(["baseline", "delivery"]).optional(),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const { to, title, locale, html_attachment, pack } = parsed.data;
  const isBaseline = pack === "baseline";
  const attachment = html_attachment?.trim() ?? "";

  if (attachment.length < 100) {
    return NextResponse.json({ ok: false, error: "attachment_required" }, { status: 400 });
  }

  const copy = isBaseline
    ? getBaselinePackMailCopy(locale, title)
    : getDecisionReportMailCopy(locale, title);

  const html = `<div style="font-family:Arial,sans-serif;color:#1a1525;max-width:720px">
  <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1>
  <p style="color:#444;font-size:14px;line-height:1.65;margin:0 0 20px">${copy.introHtml}</p>
  <p style="color:#999;font-size:11px;margin-top:28px">${escapeHtml(copy.footerHtml)}</p>
</div>`;

  const result = await sendEmail({
    from: getResendFromReports(),
    to,
    subject: copy.subject,
    html,
    text: `${title}\n\n${copy.introText}\n\n${copy.footerText}`,
    attachments: [
      {
        filename: copy.filename,
        content: attachment,
      },
    ],
    logTag: "delivery-email",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, mocked: result.mocked === true });
}
