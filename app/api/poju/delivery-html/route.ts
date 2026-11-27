import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAuthorizedDi2HtmlArtifact } from "@/lib/deliverables/di2-html-artifact";

/**
 * DI2 standalone HTML download — server CompletedReport authority only.
 * Same buildAuthorizedDi2HtmlArtifact() as delivery-email attachment.
 */

const BodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  locale: z.string().max(16).optional(),
  session_id: z.string().min(1).max(200),
  job_id: z.string().min(1).max(200),
  writer_token: z.string().min(1).max(500),
  expected_execution_generation: z.number().int().optional(),
  expected_report_job_id: z.string().max(200).optional(),
  expected_freeze_id: z.string().max(200).optional(),
  expected_context_hash: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", code: "invalid_request" },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const result = await buildAuthorizedDi2HtmlArtifact({
    session_id: body.session_id,
    job_id: body.job_id,
    writer_token: body.writer_token,
    locale: body.locale || "en",
    title: body.title,
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
    html: result.html,
    report_job_id: result.report_job_id,
    execution_generation: result.execution_generation,
    template_version: result.template_version,
    identity: result.identity,
    report_date: result.record.committed_at.slice(0, 10),
    title: result.title,
  });
}
