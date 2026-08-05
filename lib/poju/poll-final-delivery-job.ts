import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import { buildCoverAndToc } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { DELIVERY_TRANSITION_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { PojuXhighJob, PojuXhighJobFailureReason } from "@/lib/poju/xhigh-job-types";
import { XHIGH_JOB_POLL_INTERVAL_MS } from "@/lib/poju/poll-segment2-xhigh-job";

/** Wall clock across stage/task relays (matches status MAX_JOB_AGE headroom). */
const FINAL_DELIVERY_POLL_MAX_MS = 5_400_000;

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
};

type StatusPayload = {
  ok?: boolean;
  job_id?: string;
  status?: PojuXhighJob["status"];
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
  const zh = locale.startsWith("zh");
  const lead = zh ? "**依据与推理:**" : "**Evidence & reasoning:**";
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
 * Only includes complete segments; empty until preface is ready (Spline gate).
 */
export function buildStreamedDeliveryMarkdown(
  segments: StreamedDeliverySegment[],
  locale: string,
  opts?: BuildStreamedMarkdownOptions,
): string {
  const requirePreface = opts?.require_preface !== false;
  const complete = segments.filter(isStreamedSegmentComplete);
  if (!complete.length) return "";

  const prefaceReady = complete.some((s) => s.key === "preface");
  if (requirePreface && !prefaceReady) return "";

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
  // preface…epilogue — if epilogue not in, still pending
  return !doneKeys.has("epilogue");
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
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`final-delivery resume_latest failed (${res.status})`);
  }
  return (await res.json()) as StatusPayload;
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

  while (true) {
    if (input.signal?.aborted) throw new Error("AbortError");
    if (Date.now() - startedAt > FINAL_DELIVERY_POLL_MAX_MS) {
      return {
        ok: false,
        job_id: input.job_id,
        retryable: true,
        reason: "poll_timeout",
        error: "FINAL_DELIVERY_JOB_POLL_TIMEOUT",
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

    const status = data.status ?? "pending";
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
    const preface_ready = segs.some((s) => s.key === "preface" && isStreamedSegmentComplete(s));
    const waiting_next = deliveryStreamHasMorePending(segs, status);
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
      const interrupted =
        data.interrupted === true ||
        data.reason === "interrupted" ||
        (data.retryable === true && String(data.reason ?? "").includes("interrupted"));
      console.error("[final-delivery] job failed", {
        job_id: input.job_id,
        stage: data.current_stage,
        error: base,
        error_detail: detail || null,
        interrupted,
        accumulated_content: data.accumulated_content ?? null,
      });
      return {
        ok: false,
        job_id: input.job_id,
        retryable: interrupted ? true : (data.retryable ?? true),
        reason: (data.reason as PojuXhighJobFailureReason | undefined) ?? "transport_error",
        error: detail ? `${base}${stageHint} | ${detail}` : `${base}${stageHint}`,
        interrupted: interrupted || undefined,
        // Always surface checkpoint markdown so the UI never blanks completed pages.
        streamed_markdown: streamedMd.trim() ? streamedMd : undefined,
      };
    }

    await new Promise((r) => setTimeout(r, XHIGH_JOB_POLL_INTERVAL_MS));
  }
}
