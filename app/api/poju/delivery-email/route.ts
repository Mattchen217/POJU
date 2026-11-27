import { NextResponse } from "next/server";
import { z } from "zod";

import { sendAuthorizedDi2DeliveryEmail } from "@/lib/deliverables/di2-delivery-email";
import { getResendFromReports } from "@/lib/email/from-addresses";
import { sendEmail } from "@/lib/email/resend-client";
import { getBaselinePackMailCopy } from "@/lib/email/report-mail-copy";

/**
 * User-initiated email:
 * - pack=delivery (default): DI2 CompletedReport → server HTML artifact (same as download).
 * - pack=baseline: Personal baseline pack — client-built HTML attachment (WorkspaceDocVaultModal).
 *   Baseline is NOT mapped to DI2 CompletedReport.
 */

const BodySchema = z.object({
  to: z.string().email().max(320),
  title: z.string().min(1).max(500).optional(),
  locale: z.string().max(16).optional(),
  session_id: z.string().min(1).max(200).optional(),
  job_id: z.string().min(1).max(200).optional(),
  writer_token: z.string().min(1).max(500).optional(),
  expected_execution_generation: z.number().int().optional(),
  expected_report_job_id: z.string().max(200).optional(),
  expected_freeze_id: z.string().max(200).optional(),
  expected_context_hash: z.string().max(200).optional(),
  /**
   * Baseline: required attachment body.
   * DI2 delivery: ignored — server builds from CompletedReport.
   */
  html_attachment: z.string().max(10_000_000).optional(),
  /** @deprecated Ignored for delivery packs. */
  body_text: z.string().max(100_000).optional(),
  pack: z.enum(["baseline", "delivery"]).optional(),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendBaselinePackEmail(body: {
  to: string;
  title: string;
  locale?: string;
  html_attachment: string;
}) {
  const attachment = body.html_attachment.trim();
  if (attachment.length < 100) {
    return NextResponse.json(
      { ok: false, error: "attachment_required", code: "attachment_required" },
      { status: 400 },
    );
  }

  const copy = getBaselinePackMailCopy(body.locale, body.title);
  const html = `<div style="font-family:Arial,sans-serif;color:#1a1525;max-width:720px">
  <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(body.title)}</h1>
  <p style="color:#444;font-size:14px;line-height:1.65;margin:0 0 20px">${copy.introHtml}</p>
  <p style="color:#999;font-size:11px;margin-top:28px">${escapeHtml(copy.footerHtml)}</p>
</div>`;

  const result = await sendEmail({
    from: getResendFromReports(),
    to: body.to,
    subject: copy.subject,
    html,
    text: `${body.title}\n\n${copy.introText}\n\n${copy.footerText}`,
    attachments: [
      {
        filename: copy.filename,
        content: attachment,
      },
    ],
    logTag: "delivery-email",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "send_failed", code: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, mocked: result.mocked === true, pack: "baseline" });
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request", code: "invalid_request" }, { status: 400 });
  }

  const body = parsed.data;

  // Baseline pack: preserve pre-F-R2 behavior for WorkspaceDocVaultModal callers.
  // Do NOT route through DI2 CompletedReport.
  if (body.pack === "baseline") {
    const title = body.title?.trim() ?? "";
    if (!title) {
      return NextResponse.json(
        { ok: false, error: "title_required", code: "title_required" },
        { status: 400 },
      );
    }
    return sendBaselinePackEmail({
      to: body.to,
      title,
      locale: body.locale,
      html_attachment: body.html_attachment ?? "",
    });
  }

  if (!body.session_id || !body.job_id || !body.writer_token) {
    return NextResponse.json(
      { ok: false, error: "session_id, job_id, writer_token required", code: "invalid_request" },
      { status: 400 },
    );
  }

  const result = await sendAuthorizedDi2DeliveryEmail({
    session_id: body.session_id,
    job_id: body.job_id,
    writer_token: body.writer_token,
    locale: body.locale || "en",
    to: body.to,
    title: body.title,
    html_attachment: body.html_attachment,
    expected_execution_generation: body.expected_execution_generation,
    expected_report_job_id: body.expected_report_job_id,
    expected_freeze_id: body.expected_freeze_id,
    expected_context_hash: body.expected_context_hash,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    report_job_id: result.report_job_id,
    execution_generation: result.execution_generation,
    template_version: result.template_version,
    mocked: result.send.ok && "mocked" in result.send ? result.send.mocked : undefined,
  });
}
