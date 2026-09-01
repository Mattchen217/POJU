import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import { buildCoverAndToc } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { deliveryEvidenceLeadLabel } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  DELIVERY_BOOTSTRAP_SEGMENT,
  DELIVERY_CLOSING_SEGMENT,
  DELIVERY_TRANSITION_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { PojuXhighJob, PojuXhighJobFailureReason } from "@/lib/poju/xhigh-job-types";
import { XHIGH_JOB_POLL_INTERVAL_MS } from "@/lib/poju/poll-segment2-xhigh-job";

/** Match server MAX_JOB_AGE (~90m). Shorter poll used to abandon live jobs mid-book. */
export const FINAL_DELIVERY_POLL_MAX_MS = 90 * 60_000;

/** Auto-resume interrupted jobs without user tapping Continue (server handoff should cover most). */
export const FINAL_DELIVERY_AUTO_RESUME_MAX = 24;

export async function resumeInterruptedFinalDeliveryJob(job_id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/poju/final-delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ continue_interrupted: true, job_id }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; job_id?: string };
    return Boolean(data.ok && data.job_id);
  } catch {
    return false;
  }
}

export type FinalDeliveryJobPollResult =
  | {
      ok: true;
      job_id: string;
      full_text: string;
      actions: unknown[];
      model: string;
      tokens_used: number;
      llm_debug?: LLMCallDebug;
      timings?: Record<string, number | undefined>;
    }
  | {
      ok: false;
      job_id: string;
      retryable: boolean;
      reason: PojuXhighJobFailureReason | "poll_timeout" | "completed_without_result";
      error: string;
      /** Soft pause — keep streamed UI; user may Continue. */
      interrupted?: boolean;
      streamed_markdown?: string;
    };

export type StreamedDeliverySegment = {
  key: string;
  heading: string;
  body: string;
  evidence: string;
  /** Per-argument interleaved body/evidence (preferred). */
  interleaved?: string;
  evidence_ready: boolean;
  /** Structured page slots when fill path succeeded. */
  page_schema?: unknown;
};

type StatusPayload = {
  ok?: boolean;
  job_id?: string | null;
  status?: PojuXhighJob["status"] | "none";
  current_stage?: string;
  progress_label?: string;
  accumulated_content?: string;
  full_text?: string;
  actions?: unknown[];
  model?: string;
  tokens_used?: number;
  llm_debug?: LLMCallDebug;
  timings?: Record<string, number | undefined>;
  retryable?: boolean;
  interrupted?: boolean;
  reason?: FinalDeliveryJobPollResult extends { ok: false; reason: infer R } ? R : never;
  error?: string;
  error_detail?: string | null;
  streamed_segments?: StreamedDeliverySegment[];
};

/** Segment is displayable only when body (+ evidence if required) are present. */
export function isStreamedSegmentComplete(s: StreamedDeliverySegment): boolean {
  const interleaved = (s.interleaved ?? "").trim();
  if (interleaved) return true;
  const body = s.body.trim();
  if (!body) return false;
  const key = s.key as DeliverySegmentKey;
  if (DELIVERY_TRANSITION_KEYS.has(key) || !s.evidence_ready) return true;
  return Boolean(s.evidence.trim());
}

function sectionBodyMarkdown(s: StreamedDeliverySegment, locale: string): string {
  const interleaved = (s.interleaved ?? "").trim();
  if (interleaved) return interleaved;
  const lead = deliveryEvidenceLeadLabel(locale);
  const parts: string[] = [];
  if (s.body.trim()) parts.push(s.body.trim());
  if (s.evidence_ready && s.evidence.trim()) {
    parts.push(`${lead}\n${s.evidence.trim()}`);
  }
  return parts.join("\n\n");
}

export type BuildStreamedMarkdownOptions = {
  /** When set, prepend deterministic cover + TOC (before first section). */
  original_question?: string;
  /**
   * Gate: return "" until preface is complete so UI can keep the Spline ritual up.
   * Default true.
   */
  require_preface?: boolean;
};

/**
 * Build progressive markdown from streamed_segments (overwritten by full_text on complete).
 * Only includes complete segments; empty until bootstrap page (direct_answer) is ready.
 */
export function buildStreamedDeliveryMarkdown(
  segments: StreamedDeliverySegment[],
  locale: string,
  opts?: BuildStreamedMarkdownOptions,
): string {
  const requirePreface = opts?.require_preface !== false;
  const complete = segments.filter(isStreamedSegmentComplete);
  if (!complete.length) return "";

  const bootstrapReady = complete.some(
    (s) => s.key === DELIVERY_BOOTSTRAP_SEGMENT || s.key === "preface",
  );
  if (requirePreface && !bootstrapReady) return "";

  const parts: string[] = [];
  const q = opts?.original_question?.trim();
  if (q) {
    parts.push(
      buildCoverAndToc({
        original_question: q,
        locale,
      }),
    );
  }

  for (const s of complete) {
    parts.push(`## ${s.heading}`);
    const body = sectionBodyMarkdown(s, locale);
    if (body) parts.push(body);
  }
  return parts.join("\n\n") + "\n";
}

/** True when more delivery sections may still arrive. */
export function deliveryStreamHasMorePending(
  segments: StreamedDeliverySegment[],
  jobStatus: string,
): boolean {
  if (jobStatus === "completed" || jobStatus === "failed") return false;
  const doneKeys = new Set(segments.filter(isStreamedSegmentComplete).map((s) => s.key));
  // direct_answer…signals_close — if closing page not in, still pending
  return !doneKeys.has(DELIVERY_CLOSING_SEGMENT) && !doneKeys.has("epilogue");
}

export async function fetchFinalDeliveryJobStatus(job_id: string): Promise<StatusPayload> {
  const res = await fetch(
    `/api/poju/final-delivery/status?job_id=${encodeURIComponent(job_id)}`,
    { credentials: "same-origin" },
  );
  if (!res.ok) {
    throw new Error(`final-delivery status poll failed (${res.status})`);
  }
  return (await res.json()) as StatusPayload;
}

/** Resume lookup — latest job for session (completed or in-flight). */
export async function fetchLatestFinalDeliveryJob(session_id: string): Promise<StatusPayload | null> {
  const res = await fetch("/api/poju/final-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ session_id, resume_latest: true }),
  });
  // Legacy: older deploys answered empty resume with 404.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`final-delivery resume_latest failed (${res.status})`);
  }
  const data = (await res.json()) as StatusPayload;
  if (!data?.job_id || data.status === "none") return null;
  return data;
}

export async function pollFinalDeliveryJobUntilDone(input: {
  job_id: string;
  signal?: AbortSignal;
  onProgress?: (
    status: PojuXhighJob["status"],
    hint: string,
    streamed?: {
      segments: StreamedDeliverySegment[];
      markdown: string;
      waiting_next: boolean;
      preface_ready: boolean;
    },
  ) => void;
  /** Client connectivity to the status API — server job may still be running. */
  onNetworkIssue?: (offline: boolean) => void;
  /** Locale for streamed markdown assembly (default zh). */
  locale?: string;
  /** Used for progressive cover + TOC shell. */
  original_question?: string;
}): Promise<FinalDeliveryJobPollResult> {
  const startedAt = Date.now();
  console.info("[final-delivery] polling", { job_id: input.job_id });
  let networkIssue = false;
  let consecutiveNetworkFails = 0;
  let lastStreamedMd = "";
  let autoResumeCount = 0;

  while (true) {
    if (input.signal?.aborted) throw new Error("AbortError");
    if (Date.now() - startedAt > FINAL_DELIVERY_POLL_MAX_MS) {
      // Keep Continuity — never clear pending just because the tab waited a long time.
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "interrupted",
        error: "FINAL_DELIVERY_JOB_POLL_TIMEOUT",
        interrupted: true,
        streamed_markdown: lastStreamedMd.trim() || undefined,
      };
    }

    let data: StatusPayload;
    try {
      data = await fetchFinalDeliveryJobStatus(input.job_id);
      consecutiveNetworkFails = 0;
      if (networkIssue) {
        networkIssue = false;
        input.onNetworkIssue?.(false);
      }
    } catch (e) {
      if (input.signal?.aborted) throw e;
      consecutiveNetworkFails += 1;
      if (!networkIssue) {
        networkIssue = true;
        input.onNetworkIssue?.(true);
      }
      console.warn("[final-delivery] status poll network blip", {
        job_id: input.job_id,
        fails: consecutiveNetworkFails,
        error: e instanceof Error ? e.message : String(e),
      });
      // Keep polling — server-side stage hops continue independently of the client.
      const backoff = Math.min(15_000, XHIGH_JOB_POLL_INTERVAL_MS * Math.max(1, consecutiveNetworkFails));
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    const rawStatus = data.status;
    const status: PojuXhighJob["status"] =
      rawStatus && rawStatus !== "none" ? rawStatus : "pending";
    const hint =
      (typeof data.progress_label === "string" && data.progress_label.trim()) ||
      (typeof data.current_stage === "string" && data.current_stage.trim()) ||
      String(data.accumulated_content ?? "");
    const segs = Array.isArray(data.streamed_segments) ? data.streamed_segments : [];
    const locale = input.locale ?? "zh";
    const streamedMd = buildStreamedDeliveryMarkdown(segs, locale, {
      original_question: input.original_question,
      require_preface: true,
    });
    if (streamedMd.trim()) lastStreamedMd = streamedMd;
    const preface_ready = segs.some(
      (s) =>
        (s.key === DELIVERY_BOOTSTRAP_SEGMENT || s.key === "preface") &&
        isStreamedSegmentComplete(s),
    );    const waiting_next = deliveryStreamHasMorePending(segs, status);
    input.onProgress?.(status, hint, {
      segments: segs,
      markdown: streamedMd,
      waiting_next,
      preface_ready,
    });

    if (status === "completed") {
      if (typeof data.full_text === "string" && data.full_text.trim()) {
        return {
          ok: true,
          job_id: input.job_id,
          full_text: data.full_text.trim(),
          actions: Array.isArray(data.actions) ? data.actions : [],
          model: String(data.model ?? ""),
          tokens_used: typeof data.tokens_used === "number" ? data.tokens_used : 0,
          llm_debug: data.llm_debug,
          timings: data.timings,
        };
      }
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "completed_without_result",
        error: "FINAL_DELIVERY_COMPLETED_WITHOUT_TEXT",
      };
    }

    if (status === "failed") {
      const detail =
        typeof data.error_detail === "string" && data.error_detail.trim()
          ? data.error_detail.trim()
          : "";
      const base = (typeof data.error === "string" && data.error.trim()) || "final delivery failed";
      const stageHint =
        typeof data.current_stage === "string" && data.current_stage.trim()
          ? ` [stage=${data.current_stage}]`
          : "";
      const hasPages = Boolean(streamedMd.trim());
      const interrupted =
        data.interrupted === true ||
        data.reason === "interrupted" ||
        hasPages ||
        (data.retryable === true && String(data.reason ?? "").includes("interrupted"));
      console.error("[final-delivery] job failed", {
        job_id: input.job_id,
        stage: data.current_stage,
        error: base,
        error_detail: detail || null,
        interrupted,
        ready_pages: segs.length,
        accumulated_content: data.accumulated_content ?? null,
      });
      if (
        interrupted &&
        (data.retryable === true || hasPages) &&
        autoResumeCount < FINAL_DELIVERY_AUTO_RESUME_MAX
      ) {
        autoResumeCount += 1;
        console.info("[final-delivery] auto-resume interrupted job", {
          job_id: input.job_id,
          attempt: autoResumeCount,
          stage: data.current_stage,
        });
        const resumed = await resumeInterruptedFinalDeliveryJob(input.job_id);
        if (resumed) {
          await new Promise((r) => setTimeout(r, XHIGH_JOB_POLL_INTERVAL_MS));
          continue;
        }
      }
      return {
        ok: false,
        job_id: input.job_id,
        retryable: interrupted ? true : (data.retryable ?? true),
        reason: (data.reason as PojuXhighJobFailureReason | undefined) ?? "transport_error",
        error: detail ? `${base}${stageHint} | ${detail}` : `${base}${stageHint}`,
        // Any checkpointed pages ⇒ Continue pause (never wipe the book).
        interrupted: interrupted || undefined,
        streamed_markdown: streamedMd.trim() ? streamedMd : undefined,
      };
    }

    await new Promise((r) => setTimeout(r, XHIGH_JOB_POLL_INTERVAL_MS));
  }
}
