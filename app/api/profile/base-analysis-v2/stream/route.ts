import { after, NextResponse } from "next/server";

import {
  acquireLock,
  createJob,
  failJob,
  finalizeJob,
  findLatestJobForProfile,
  getJob,
  releaseLock,
  setJobContent,
  setJobProgress,
  updateJobStatus,
} from "@/lib/base-analysis/job-store";
import type { BaseAnalysisJob } from "@/lib/base-analysis/job-types";
import { auditBaseAnalysisDelivery } from "@/lib/base-analysis/delivery-gate";
import { runReportV2 } from "@/lib/base-analysis-v2/orchestrate/run-report";
import { collectUnmarkedMingliCandidates } from "@/lib/base-analysis-v2/collect-unmarked";
import { baseAnalysisCacheSessionId } from "@/lib/llm/cache-session-id";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";
import { forceSsotPlainInMarkers, demoteWuxingMarkers } from "@/lib/llm/sanitize/term-marking";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Hobby plan max is 300s; Pro can raise later. after() inherits this ceiling. */
export const maxDuration = 300;

/** If a streaming/pending v2 job has not progressed this long, allow a fresh job. */
const STALE_JOB_MS = 15 * 60 * 1000;

type RequestBody = {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob["local_data"];
  resume_job_id?: string;
};

function jobPollPayload(job: BaseAnalysisJob) {
  return {
    job_id: job.job_id,
    profile_id: job.profile_id,
    kind: job.kind ?? "base_analysis_v2",
    status: job.status,
    accumulated_content: job.accumulated_content,
    progress_stage: job.progress_stage ?? null,
    progress_updated_at: job.progress_updated_at ?? null,
    meta: job.meta,
    error: job.error,
    error_detail: job.error_detail,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
  };
}

async function runV2Job(job_id: string, profile_id: string): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;

  // 幂等：同一 job 已在跑/已完成则跳过，且不 releaseLock（所有者仍持有或已释放）。
  if (job.status === "completed" || job.status === "streaming") {
    console.warn(`[v2/job] ${job_id} 已是 ${job.status},跳过重复执行`);
    return;
  }

  try {
    await updateJobStatus(job_id, "streaming", {
      accumulated_content: "",
      error: undefined,
      error_detail: undefined,
    });

    const sessionId = baseAnalysisCacheSessionId(profile_id);
    const r = await runReportV2(job.local_data.structured, job.locale, {
      session_id: sessionId,
      onProgress: async (stage) => {
        try {
          await setJobProgress(job_id, stage);
        } catch (e) {
          console.warn("[base-analysis-v2] setJobProgress failed:", e);
        }
      },
    });

    if (!r.ok) {
      await failJob(job_id, `${r.stage}_failed`, r.reason);
      return;
    }

    // v2 原则:不拦截重跑,只代码清洗放行。
    // 合规已在①第1次 sanitize②第2/3次各自清洗③mergeToMarkdown 填软译 三层做过,
    // 这里再兜: sanitize → forceSsot（与 v1 stream-llm-with-gate 同序），不再 failJob。
    const gated = demoteWuxingMarkers(
      forceSsotPlainInMarkers(
        applyComplianceSanitize(r.markdown, job.locale).text,
        job.locale,
      ),
    );

    // gate 仅【观测】(记日志),不 failJob —— 违规交给上面清洗,不整轮重跑。
    // skipEvidenceProse: 依据块本就该有打标真词,勿当正文违规。
    const gate = auditBaseAnalysisDelivery(
      gated,
      job.locale,
      job.local_data.structured,
      { skipEvidenceProse: true },
    );
    if (!gate.ok) {
      console.warn(
        `[base-analysis-v2] ℹ️ gate 观测到残留(不重跑,已清洗放行):`,
        gate.violations.slice(0, 5).map((v) => v.label).join(", "),
      );
    }

    // 旁路收集漏网疑似命理词 → KV 候选池；失败不影响交付
    try {
      await collectUnmarkedMingliCandidates(gated, job.locale);
    } catch (e) {
      console.warn(
        "[collect] 收集失败(不影响交付):",
        e instanceof Error ? e.message : String(e),
      );
    }

    await setJobContent(job_id, gated);
    await finalizeJob(job_id, {
      pipeline: "base_analysis_v2",
      timings: r.timings,
    });
    console.log(`[base-analysis-v2] ✅ job ${job_id} completed`, r.timings);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[base-analysis-v2] job ${job_id} crashed:`, message);
    await failJob(job_id, "orchestrate_error", message);
  } finally {
    await releaseLock(profile_id);
  }
}

/**
 * v2 三调用底座：立即返回 job_id，后台 after() 跑真算→正文/依据并行→合并→门禁→落库。
 * 前端轮询复用 `GET /api/profile/base-analysis/status?job_id=…`。
 */
export async function POST(req: Request) {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OpenRouter is not configured" },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.profile_id?.trim() || !body.locale?.trim() || !body.local_data?.structured) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: profile_id, locale, local_data.structured" },
      { status: 400 },
    );
  }

  const profileId = body.profile_id.trim();
  const locale = body.locale.trim();

  const ACTIVE_STATUSES = new Set(["completed", "streaming", "pending"]);

  // Resume existing v2 job if still in flight / completed（含 pending：刚建 job 尚未转 streaming）
  if (body.resume_job_id?.trim()) {
    const candidate = await getJob(body.resume_job_id.trim());
    if (
      candidate &&
      candidate.profile_id === profileId &&
      candidate.kind === "base_analysis_v2"
    ) {
      if (ACTIVE_STATUSES.has(candidate.status)) {
        return NextResponse.json({ ok: true, ...jobPollPayload(candidate) });
      }
    }
  }

  const latest = await findLatestJobForProfile(profileId);
  if (
    latest &&
    latest.kind === "base_analysis_v2" &&
    ACTIVE_STATUSES.has(latest.status)
  ) {
    const age = Date.now() - latest.updated_at;
    if (latest.status === "completed" || age <= STALE_JOB_MS) {
      return NextResponse.json({ ok: true, ...jobPollPayload(latest) });
    }
  }

  const locked = await acquireLock(profileId);
  if (!locked) {
    return NextResponse.json(
      { ok: false, error: "Another analysis is in progress" },
      { status: 409 },
    );
  }

  let job: BaseAnalysisJob;
  try {
    job = await createJob({
      profile_id: profileId,
      locale,
      local_data: {
        structured: body.local_data.structured,
        output_language: body.local_data.output_language ?? (locale.startsWith("zh") ? "zh" : "en"),
      },
      kind: "base_analysis_v2",
    });
  } catch (e) {
    await releaseLock(profileId);
    const message = e instanceof Error ? e.message : "Create job failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  after(async () => {
    await runV2Job(job.job_id, profileId);
  });

  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    kind: "base_analysis_v2",
    poll: `/api/profile/base-analysis/status?job_id=${encodeURIComponent(job.job_id)}`,
  });
}
