import { NextResponse } from "next/server";

import { acquireLock, renewLockIfHeld } from "@/lib/base-analysis/job-store";
import {
  assembleNarrativeTree,
  getNarrativeTaskByName,
  NARRATIVE_TASKS,
  runNarrative,
  runNarrativeTask,
} from "@/lib/base-analysis-v2/narrative/narrative-call";
import {
  PIPELINE_LOCALE,
  requireReportComputed,
} from "@/lib/base-analysis-v2/phased/phase-shared";
import { baseAnalysisCacheSessionId } from "@/lib/llm/cache-session-id";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  profile_id: string;
  report_computed: unknown;
  /** When set, run only this Task (short HTTP). */
  task?: string;
  /** When set, merge+polish Task trees (no LLM). */
  trees?: Record<string, unknown>[];
};

async function ensurePhasedLock(profileId: string): Promise<boolean> {
  if (await renewLockIfHeld(profileId)) return true;
  return acquireLock(profileId);
}

/**
 * Phase 2a · 正文（中文）。可与 evidence 并行由客户端发起。
 * - `task`：单 Task LLM
 * - `trees`：合并清洗（无 LLM）
 * - 无二者：兼容旧客户端一次跑满 4 Task
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const profileId = String(body.profile_id ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: "Missing profile_id" }, { status: 400 });
  }

  const rc = requireReportComputed(body.report_computed);
  if ("error" in rc) {
    return NextResponse.json({ ok: false, error: rc.error }, { status: 400 });
  }

  const trees = Array.isArray(body.trees) ? body.trees : null;
  if (trees) {
    const t0 = Date.now();
    try {
      const narrative = assembleNarrativeTree(trees, rc, PIPELINE_LOCALE);
      return NextResponse.json({
        ok: true,
        phase: "narrative",
        narrative,
        timing_ms: Date.now() - t0,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { ok: false, error: "narrative_assemble_error", detail: message },
        { status: 500 },
      );
    }
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OpenRouter is not configured" },
      { status: 503 },
    );
  }

  const held = await ensurePhasedLock(profileId);
  if (!held) {
    return NextResponse.json(
      { ok: false, error: "Another analysis is in progress" },
      { status: 409 },
    );
  }

  const taskName = typeof body.task === "string" ? body.task.trim() : "";
  const t0 = Date.now();
  try {
    const sessionId = baseAnalysisCacheSessionId(profileId);

    if (taskName) {
      const task = getNarrativeTaskByName(taskName);
      if (!task) {
        return NextResponse.json(
          {
            ok: false,
            error: "invalid_task",
            detail: `Expected one of: ${NARRATIVE_TASKS.map((t) => t.name).join(", ")}`,
          },
          { status: 400 },
        );
      }
      const deadline = Date.now() + 300_000;
      const result = await runNarrativeTask(task, rc, PIPELINE_LOCALE, {
        session_id: sessionId,
        signal: req.signal,
        deadline,
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: "narrative_task_failed", detail: result.reason, task: taskName },
          { status: 502 },
        );
      }
      return NextResponse.json({
        ok: true,
        phase: "narrative",
        task: taskName,
        tree: result.value,
        timing_ms: Date.now() - t0,
      });
    }

    const result = await runNarrative(rc, PIPELINE_LOCALE, {
      session_id: sessionId,
      signal: req.signal,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "narrative_failed", detail: result.reason },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      phase: "narrative",
      narrative: result.value,
      timing_ms: Date.now() - t0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "narrative_error", detail: message },
      { status: 500 },
    );
  }
}
