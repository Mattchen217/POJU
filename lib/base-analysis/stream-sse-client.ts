import type { BaseAnalysisJob } from "@/lib/base-analysis/job-types";
import {
  type BaseAnalysisArtifactKind,
  type BaseAnalysisProgressStage,
  type ProgressPayload,
} from "@/lib/base-analysis/progress-stages";
import {
  clearV2Checkpoint,
  loadV2Checkpoint,
  saveV2Checkpoint,
} from "@/lib/base-analysis/v2-checkpoint-store";
import type { ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import type { ReportSegmentTextTree } from "@/lib/base-analysis-v2/segment-text";
import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";
import {
  WAIT_ARTIFACT_INTRO_TOTAL_MS,
  WAIT_ARTIFACT_SEAT_MS,
  WAIT_FINAL_AUDIT_MS,
  WAIT_SEMANTIC_ARTIFACT_MS,
} from "@/lib/wait-ritual/constants";

export type StreamSseCallbacks = {
  onStart?: (job_id: string) => void;
  onChunk?: (text: string, accumulated: string) => void;
  onPollContent?: (accumulated: string) => void;
  /** Layer-1 judgments (v1 only; v2 does not emit). */
  onCoreJudgments?: (judgments: unknown, source?: string) => void;
  /** Wait-UI progress stage + optional artifact when a phase completes. */
  onProgress?: (payload: ProgressPayload) => void;
};

export type StreamSseResult = {
  content: string;
  meta: BaseAnalysisJob["meta"] | Record<string, unknown>;
  job_id: string | null;
};

/** Legacy monolith job endpoint — kept for resume of in-flight old jobs only. */
export const BASE_ANALYSIS_STREAM_PATH = "/api/profile/base-analysis-v2/stream";

const PHASE = {
  compute: "/api/profile/base-analysis-v2/phase/compute",
  narrative: "/api/profile/base-analysis-v2/phase/narrative",
  evidence: "/api/profile/base-analysis-v2/phase/evidence",
  finalize: "/api/profile/base-analysis-v2/phase/finalize",
  abort: "/api/profile/base-analysis-v2/phase/abort",
} as const;

const COMPUTE_WAIT_HINT_MS = 60_000;

type PhaseErrorBody = {
  ok?: boolean;
  error?: string;
  detail?: string;
};

function emit(
  callbacks: StreamSseCallbacks | undefined,
  stage: BaseAnalysisProgressStage,
  artifact?: BaseAnalysisArtifactKind,
): void {
  callbacks?.onProgress?.({ stage, artifact });
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json()) as T & PhaseErrorBody;
  if (!res.ok || data.ok === false) {
    const detail = data.detail ? `: ${data.detail}` : "";
    throw new Error(`${data.error || `phase failed (${res.status})`}${detail}`);
  }
  return data;
}

async function abortLock(profile_id: string): Promise<void> {
  try {
    await fetch(PHASE.abort, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id }),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Phased v2: compute → (narrative ∥ evidence) → finalize.
 * Intermediates live in IndexedDB; each HTTP call stays under Vercel 300s.
 */
export async function consumeBaseAnalysisStream(input: {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob["local_data"];
  resume_job_id?: string;
  signal?: AbortSignal;
  callbacks?: StreamSseCallbacks;
}): Promise<StreamSseResult> {
  const jobId = `v2-phased-${input.profile_id.slice(0, 8)}-${Date.now()}`;
  input.callbacks?.onStart?.(jobId);

  const siteLocale = input.locale;
  let cp = await loadV2Checkpoint(input.profile_id);
  if (cp && cp.locale !== siteLocale) {
    await clearV2Checkpoint(input.profile_id);
    cp = null;
  }

  emit(input.callbacks, "chart_ready");

  let reportComputed: ReportComputed | undefined = cp?.report_computed;
  let narrative: ReportSegmentTextTree | undefined = cp?.narrative;
  let evidence: ReportSegmentTextTree | undefined = cp?.evidence;
  let lockHeld = Boolean(reportComputed);

  const onAbort = () => {
    if (lockHeld) void abortLock(input.profile_id);
  };
  input.signal?.addEventListener("abort", onAbort, { once: true });

  const persistCheckpoint = async (patch: {
    report_computed?: ReportComputed;
    narrative?: ReportSegmentTextTree;
    evidence?: ReportSegmentTextTree;
  }) => {
    const latest = (await loadV2Checkpoint(input.profile_id)) ?? {
      locale: siteLocale,
      updated_at: Date.now(),
    };
    await saveV2Checkpoint(input.profile_id, {
      locale: siteLocale,
      report_computed: patch.report_computed ?? latest.report_computed ?? reportComputed,
      narrative: patch.narrative ?? latest.narrative ?? narrative,
      evidence: patch.evidence ?? latest.evidence ?? evidence,
      updated_at: Date.now(),
    });
  };

  try {
    // ── Phase 1: compute ──────────────────────────────────────────
    if (!reportComputed) {
      emit(input.callbacks, "v2_compute");
      const waitHint = setTimeout(() => {
        emit(input.callbacks, "v2_compute_wait");
      }, COMPUTE_WAIT_HINT_MS);
      try {
        const data = await postJson<{
          report_computed: ReportComputed;
          timing_ms?: number;
        }>(
          PHASE.compute,
          {
            profile_id: input.profile_id,
            locale: siteLocale,
            local_data: input.local_data,
          },
          input.signal,
        );
        reportComputed = data.report_computed;
        lockHeld = true;
        await persistCheckpoint({ report_computed: reportComputed });
        emit(input.callbacks, "v2_compute", "compute");
      } finally {
        clearTimeout(waitHint);
      }
    } else {
      emit(input.callbacks, "v2_compute", "compute");
    }

    // ── Phase 2: narrative ∥ evidence ─────────────────────────────
    const needNar = !narrative;
    const needEv = !evidence;

    if (needNar || needEv) {
      let rotateOn = true;
      let showNar = true;
      const tick = () => {
        if (!rotateOn) return;
        emit(input.callbacks, showNar ? "v2_narrative" : "v2_evidence");
        showNar = !showNar;
      };
      tick();
      const rotateTimer = setInterval(tick, ACTIVITY_CAPTION_ROTATE_MS);

      try {
        await Promise.all([
          (async () => {
            if (!needNar) {
              emit(input.callbacks, "v2_narrative", "narrative");
              return;
            }
            const data = await postJson<{ narrative: ReportSegmentTextTree }>(
              PHASE.narrative,
              { profile_id: input.profile_id, report_computed: reportComputed },
              input.signal,
            );
            narrative = data.narrative;
            await persistCheckpoint({ narrative });
            emit(input.callbacks, "v2_narrative", "narrative");
          })(),
          (async () => {
            if (!needEv) {
              emit(input.callbacks, "v2_evidence", "evidence");
              return;
            }
            const data = await postJson<{ evidence: ReportSegmentTextTree }>(
              PHASE.evidence,
              { profile_id: input.profile_id, report_computed: reportComputed },
              input.signal,
            );
            evidence = data.evidence;
            await persistCheckpoint({ evidence });
            emit(input.callbacks, "v2_evidence", "evidence");
          })(),
        ]);
      } finally {
        rotateOn = false;
        clearInterval(rotateTimer);
      }
    } else {
      emit(input.callbacks, "v2_narrative", "narrative");
      emit(input.callbacks, "v2_evidence", "evidence");
    }

    if (!narrative || !evidence || !reportComputed) {
      throw new Error("phased pipeline incomplete after write phase");
    }

    // ── Phase 3: finalize (± translate) ───────────────────────────
    // Non-zh: timed "semantic construction" theater (no translation wording).
    // Zh: merge-only finalize — short audit, no 60/120 timers, no 4th artifact.
    const isZh = siteLocale.startsWith("zh");
    let translateArtifactEmitted = false;
    const theaterTimers: ReturnType<typeof setTimeout>[] = [];

    const clearTheaterTimers = () => {
      for (const t of theaterTimers) clearTimeout(t);
      theaterTimers.length = 0;
    };

    const waitMs = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        theaterTimers.push(t);
        input.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true },
        );
      });

    if (isZh) {
      emit(input.callbacks, "v2_final_audit");
    } else {
      emit(input.callbacks, "v2_translate");
      theaterTimers.push(
        setTimeout(() => {
          translateArtifactEmitted = true;
          emit(input.callbacks, "v2_semantic_text", "translate");
        }, WAIT_SEMANTIC_ARTIFACT_MS),
      );
      theaterTimers.push(
        setTimeout(() => {
          emit(input.callbacks, "v2_final_audit");
        }, WAIT_FINAL_AUDIT_MS),
      );
    }

    let final: {
      markdown: string;
      translated?: boolean;
      timings?: Record<string, number>;
    };
    try {
      final = await postJson<{
        markdown: string;
        translated?: boolean;
        timings?: Record<string, number>;
      }>(
        PHASE.finalize,
        {
          profile_id: input.profile_id,
          locale: siteLocale,
          local_data: input.local_data,
          report_computed: reportComputed,
          narrative,
          evidence,
        },
        input.signal,
      );
    } finally {
      clearTheaterTimers();
    }
    lockHeld = false;

    if (!isZh && final.translated) {
      if (!translateArtifactEmitted) {
        translateArtifactEmitted = true;
        emit(input.callbacks, "v2_semantic_text", "translate");
        // Wait for center spawn → hold 2s → seat before tearing down wait UI.
        await waitMs(WAIT_ARTIFACT_INTRO_TOTAL_MS);
      } else {
        emit(input.callbacks, "v2_final_audit");
        await waitMs(WAIT_ARTIFACT_SEAT_MS);
      }
    } else if (isZh) {
      emit(input.callbacks, "v2_final_audit");
    }

    await clearV2Checkpoint(input.profile_id);

    const content = final.markdown;
    input.callbacks?.onPollContent?.(content);

    return {
      content,
      meta: {
        pipeline: "base_analysis_v2_phased",
        timings: final.timings,
      },
      job_id: jobId,
    };
  } catch (e) {
    // Keep checkpoint + lock for resume unless aborted.
    if (input.signal?.aborted) {
      await abortLock(input.profile_id);
      lockHeld = false;
    }
    throw e;
  } finally {
    input.signal?.removeEventListener("abort", onAbort);
  }
}
