import { NextResponse } from "next/server";
import { z } from "zod";

import { sendAuthorizedBaselineDeliveryEmail } from "@/lib/deliverables/baseline-delivery-email";
import { sendAuthorizedDi2DeliveryEmail } from "@/lib/deliverables/di2-delivery-email";

/**
 * User-initiated email:
 * - pack=delivery (default): DI2 CompletedReport → server HTML artifact (same as download).
 * - pack=baseline: Personal baseline pack — login + recipient bind + optional Session writer.
 *   Baseline is NOT mapped to DI2 CompletedReport.
 */

const BodySchema = z.object({
  to: z.string().email().max(320),
  title: z.string().min(1).max(500).optional(),
  locale: z.string().max(16).optional(),
  session_id: z.string().min(1).max(200).optional(),
  job_id: z.string().min(1).max(200).optional(),
  writer_token: z.string().min(1).max(500).optional(),
  browser_task_credential: z.string().min(40).max(128).optional(),
  expected_execution_generation: z.number().int().optional(),
  expected_report_job_id: z.string().max(200).optional(),
  expected_freeze_id: z.string().max(200).optional(),
  expected_context_hash: z.string().max(200).optional(),
  /**
   * Baseline: required attachment body (still client-built after auth).
   * DI2 delivery: ignored — server builds from CompletedReport.
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

  // Baseline pack: authorized separately — never DI2 CompletedReport.
  if (body.pack === "baseline") {
    const title = body.title?.trim() ?? "";
    if (!title) {
      return NextResponse.json(
        { ok: false, error: "title_required", code: "title_required" },
        { status: 400 },
      );
    }
    const result = await sendAuthorizedBaselineDeliveryEmail({
      to: body.to,
      title,
      locale: body.locale,
      html_attachment: body.html_attachment ?? "",
      session_id: body.session_id,
      writer_token: body.writer_token,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      pack: "baseline",
      mocked: result.send.ok && "mocked" in result.send ? result.send.mocked : undefined,
    });
  }

  if (!body.session_id || !body.job_id || !body.writer_token || !body.browser_task_credential) {
    return NextResponse.json(
      {
        ok: false,
        error: "session_id, job_id, writer_token, browser_task_credential required",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const result = await sendAuthorizedDi2DeliveryEmail({
    session_id: body.session_id,
    job_id: body.job_id,
    writer_token: body.writer_token,
    browser_task_credential: body.browser_task_credential,
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
