import { NextRequest, NextResponse } from "next/server";

import { inngest } from "@/lib/inngest/client";
import { sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import {
  getSyncroJob,
  indexSyncroJobForDevice,
  setSyncroJob,
} from "@/lib/syncro/syncro-job-kv";
import { setSyncroLlmContextKv } from "@/lib/syncro/syncro-llm-context-kv";
import { countCompletedInKv } from "@/lib/syncro/syncro-status-helpers";
import { getSyncroStatus, isSyncroKvConfigured, setSyncroStatus } from "@/lib/syncro/syncro-status-kv";
import type { SyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import type { HourPeriod } from "@/lib/syncro/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 45 * 60 * 1000;

type StartBody = {
  session_id: string;
  submission_anchor: HourPeriod;
  /** Wall-clock hour to generate first (compass gate). */
  priority_hour: HourPeriod;
  hour_order?: HourPeriod[];
  llm_context: SyncroLlmContext;
  device_id?: string;
  /** true = do not LLM-call priority hour again (after client SSE + compass). */
  remaining_only?: boolean;
};

export async function POST(req: NextRequest) {
  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const session_id = body.session_id?.trim();
  const submission_anchor = body.submission_anchor;
  const priority_hour = body.priority_hour ?? submission_anchor;
  const llm_context = body.llm_context;

  if (!session_id || !submission_anchor || !priority_hour || !llm_context?.local_matrix) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const kv_configured = isSyncroKvConfigured();
  if (!kv_configured) {
    console.warn("[inngest_start] KV not configured — clients cannot poll cloud progress");
  }

  const remaining_only = Boolean(body.remaining_only);
  const hour_order =
    body.hour_order?.length === 12
      ? body.hour_order
      : sortedHourPeriodsFromLive(submission_anchor);

  const existing = await getSyncroStatus(session_id);
  if (existing?.done) {
    return NextResponse.json({
      ok: true,
      already_done: true,
      status: existing,
    });
  }

  if (existing && !existing.done) {
    const age = Date.now() - existing.updated_at;
    if (age < STALE_MS) {
      return NextResponse.json({
        ok: true,
        already_running: true,
        status: existing,
      });
    }
  }

  await setSyncroLlmContextKv(session_id, llm_context);

  const completed = await countCompletedInKv(session_id, hour_order);

  await setSyncroStatus(session_id, {
    total: 12,
    completed,
    current_hour: hour_order[completed] ?? hour_order[0] ?? null,
    failed_hours: existing?.failed_hours ?? [],
    hour_order,
    started_at: existing?.started_at ?? Date.now(),
    updated_at: Date.now(),
    done: completed >= 12,
  });

  const device_id = body.device_id?.trim() ?? "";
  await setSyncroJob({
    session_id,
    profile_id: llm_context.profile_id,
    task_description: llm_context.task_description,
    submission_anchor,
    hour_order,
    created_at: existing?.started_at ?? Date.now(),
    updated_at: Date.now(),
  });
  if (device_id) {
    await indexSyncroJobForDevice(device_id, session_id);
  }

  if (completed >= 12) {
    return NextResponse.json({
      ok: true,
      already_done: true,
      status: await getSyncroStatus(session_id),
    });
  }

  try {
    await inngest.send({
      name: "syncro/generate-all",
      data: { session_id, hour_order, priority_hour },
    });
  } catch (e) {
    console.error("[inngest_start] send failed:", e);
    return NextResponse.json({ error: "inngest_send_failed" }, { status: 503 });
  }

  const job = await getSyncroJob(session_id);
  console.log(
    `[inngest_start] ${session_id} anchor=${submission_anchor} priority=${priority_hour} completed=${completed}/12`,
  );

  return NextResponse.json({
    ok: true,
    started: true,
    kv_configured,
    remaining_only,
    status: await getSyncroStatus(session_id),
    job,
  });
}
