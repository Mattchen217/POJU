import { NextResponse } from "next/server";
import { z } from "zod";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { createCompanionJob } from "@/lib/companion/create-companion-job";
import { deliverCompanionDayZero } from "@/lib/companion/drip-advance";
import {
  getCompanionJob,
  getCompanionJobBySession,
  saveCompanionJob,
} from "@/lib/companion/job-store";
import { CompanionJobSchema } from "@/lib/companion/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const CreateBodySchema = z.object({
  session_id: z.string().min(1),
  profile_id: z.string().nullable().optional(),
  full_text: z.string().min(20),
  locale: z.string().min(2).max(16).default("en"),
  original_question: z.string().optional(),
  structured: z.record(z.string(), z.unknown()),
  timezone: z.string().optional(),
  email: z.string().email().nullable().optional(),
  mail_opt_in: z.boolean().optional(),
  deliver_day_zero: z.boolean().optional().default(true),
  partner_bazi: z.enum(["absent", "present"]).nullable().optional(),
  dyad_compat_summary: z.record(z.string(), z.unknown()).nullable().optional(),
  pivot_chart_path: z.enum(["solo", "dyad"]).nullable().optional(),
  dyad_matrix_pack: z.record(z.string(), z.unknown()).nullable().optional(),
});

const PatchBodySchema = z.object({
  job_id: z.string().min(1),
  mail_opt_in: z.boolean().optional(),
  email: z.string().email().nullable().optional(),
});

/** Public job view — omit full liuri_pack to keep payload small. */
function publicJob(job: z.infer<typeof CompanionJobSchema>) {
  return {
    id: job.id,
    session_id: job.session_id,
    profile_id: job.profile_id,
    email: job.email,
    timezone: job.timezone,
    mail_opt_in: job.mail_opt_in,
    delivery_day_key: job.delivery_day_key,
    ends_day_key: job.ends_day_key,
    brief: job.brief,
    days: job.days,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const sessionId = url.searchParams.get("session_id")?.trim();
  const job = id
    ? await getCompanionJob(id)
    : sessionId
      ? await getCompanionJobBySession(sessionId)
      : null;
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ job: publicJob(job) });
}

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json();
    const parsed = CreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const existing = await getCompanionJobBySession(body.session_id);
    if (existing) {
      return NextResponse.json({ job: publicJob(existing), existing: true });
    }

    let job = createCompanionJob({
      sessionId: body.session_id,
      profileId: body.profile_id,
      fullText: body.full_text,
      locale: body.locale,
      originalQuestion: body.original_question,
      structured: body.structured as unknown as ProfileStructured,
      timezone: body.timezone,
      email: body.email,
      mailOptIn: body.mail_opt_in,
      partner_bazi: body.partner_bazi ?? null,
      dyad_compat_summary: body.dyad_compat_summary
        ? (body.dyad_compat_summary as unknown as import("@/lib/poju/dyad-compat").DyadCompatSummary)
        : null,
      pivot_chart_path: body.pivot_chart_path ?? null,
      dyad_matrix_pack: body.dyad_matrix_pack
        ? (body.dyad_matrix_pack as unknown as import("@/lib/poju/dyad-matrix-pack").DyadMatrixPack)
        : null,
    });
    await saveCompanionJob(job);

    if (body.deliver_day_zero) {
      job = await deliverCompanionDayZero(job);
    }

    return NextResponse.json({ job: publicJob(job), existing: false });
  } catch (e) {
    console.error("[api/companion/job POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "companion_job_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const raw: unknown = await req.json();
    const parsed = PatchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const job = await getCompanionJob(parsed.data.job_id);
    if (!job) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (typeof parsed.data.mail_opt_in === "boolean") {
      job.mail_opt_in = parsed.data.mail_opt_in;
    }
    if (parsed.data.email !== undefined) {
      job.email = parsed.data.email;
    }
    job.updated_at = new Date().toISOString();
    await saveCompanionJob(job);
    return NextResponse.json({ job: publicJob(job) });
  } catch (e) {
    console.error("[api/companion/job PATCH]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "companion_patch_failed" },
      { status: 500 },
    );
  }
}
