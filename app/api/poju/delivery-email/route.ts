import { NextResponse } from "next/server";
import { z } from "zod";

import { sendAuthorizedDi2DeliveryEmail } from "@/lib/deliverables/di2-delivery-email";

/**
 * User-initiated DI2 decision-report email.
 * Body copy is short fixed text; substance is the server-built HTML attachment
 * from a verified CompletedReport. Client html_attachment is never trusted.
 */

const BodySchema = z.object({
  to: z.string().email().max(320),
  title: z.string().min(1).max(500).optional(),
  locale: z.string().max(16).optional(),
  session_id: z.string().min(1).max(200),
  job_id: z.string().min(1).max(200),
  writer_token: z.string().min(1).max(500),
  expected_execution_generation: z.number().int().optional(),
  expected_report_job_id: z.string().max(200).optional(),
  expected_freeze_id: z.string().max(200).optional(),
  expected_context_hash: z.string().max(200).optional(),
  /**
   * @deprecated Ignored. Kept so older clients do not fail schema validation.
   * Server always builds the attachment from CompletedReport.
   */
  html_attachment: z.string().max(10_000_000).optional(),
  /** @deprecated Ignored for delivery packs. */
  body_text: z.string().max(100_000).optional(),
  pack: z.enum(["baseline", "delivery"]).optional(),
});

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request", code: "invalid_request" }, { status: 400 });
  }

  const body = parsed.data;
  if (body.pack === "baseline") {
    // Baseline pack remains a separate path; this route now only closes DI2 delivery.
    return NextResponse.json(
      { ok: false, error: "baseline_not_supported", code: "baseline_not_supported" },
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
