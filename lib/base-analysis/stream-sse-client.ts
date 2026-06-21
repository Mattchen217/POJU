import type { BaseAnalysisJob } from "@/lib/base-analysis/job-types";

export type StreamSseCallbacks = {
  onStart?: (job_id: string) => void;
  onChunk?: (text: string, accumulated: string) => void;
  onPollContent?: (accumulated: string) => void;
};

export type StreamSseResult = {
  content: string;
  meta: BaseAnalysisJob["meta"] | Record<string, unknown>;
  job_id: string | null;
};

type SseEvent = { type: string; [key: string]: unknown };

function parseSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  const events: SseEvent[] = [];

  for (const block of parts) {
    const line = block.trim();
    if (!line.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(line.slice(6)) as SseEvent);
    } catch (e) {
      console.warn("[stream-sse-client] parse failed:", e, line.slice(0, 80));
    }
  }

  return { events, rest };
}

const POLL_INTERVAL_MS = 3000;
/** Slightly above server `maxDuration` (300s) + reconnect slack. */
const POLL_MAX_MS = 320_000;

async function pollJobUntilDone(
  job_id: string,
  callbacks?: StreamSseCallbacks,
): Promise<StreamSseResult> {
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > POLL_MAX_MS) {
      throw new Error("BASE_ANALYSIS_POLL_TIMEOUT");
    }
    const res = await fetch(`/api/profile/base-analysis/status?job_id=${job_id}`);
    if (!res.ok) {
      throw new Error(`status poll failed (${res.status})`);
    }
    const data = await res.json();
    const accumulated = String(data.accumulated_content ?? "");
    callbacks?.onPollContent?.(accumulated);

    if (data.status === "completed") {
      return {
        content: accumulated,
        meta: data.meta ?? {},
        job_id,
      };
    }
    if (data.status === "failed") {
      throw new Error(String(data.error || "base analysis job failed"));
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

/**
 * POST stream endpoint until done / error; falls back to status polling when needed.
 */
export async function consumeBaseAnalysisStream(input: {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob["local_data"];
  resume_job_id?: string;
  signal?: AbortSignal;
  callbacks?: StreamSseCallbacks;
}): Promise<StreamSseResult> {
  const res = await fetch("/api/profile/base-analysis/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: input.profile_id,
      locale: input.locale,
      local_data: input.local_data,
      resume_job_id: input.resume_job_id,
    }),
    signal: input.signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status}: ${errText}`);
  }
  if (!res.body) {
    throw new Error("no response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedContent = "";
  let jobId: string | null = null;

  const finishFromEvent = (ev: SseEvent): StreamSseResult | "poll" | null => {
    switch (ev.type) {
      case "start":
        jobId = String(ev.job_id);
        input.callbacks?.onStart?.(jobId);
        return null;
      case "chunk": {
        const text = String(ev.text ?? "");
        accumulatedContent += text;
        input.callbacks?.onChunk?.(text, accumulatedContent);
        return null;
      }
      case "reset":
        accumulatedContent = "";
        input.callbacks?.onPollContent?.("");
        return null;
      case "resumed":
        return {
          content: String(ev.accumulated ?? ""),
          meta: (ev.meta as BaseAnalysisJob["meta"]) ?? {},
          job_id: String(ev.job_id),
        };
      case "resumed_partial":
        jobId = String(ev.job_id);
        accumulatedContent = String(ev.accumulated ?? "");
        if (ev.poll_only) return "poll";
        return null;
      case "done":
        return {
          content: accumulatedContent,
          meta: (ev.meta as BaseAnalysisJob["meta"]) ?? {},
          job_id: jobId,
        };
      case "error":
        throw new Error(String(ev.error ?? "stream error"));
      default:
        return null;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseEvents(buffer);
    buffer = rest;

    for (const ev of events) {
      const outcome = finishFromEvent(ev);
      if (outcome === "poll" && jobId) {
        return pollJobUntilDone(jobId, input.callbacks);
      }
      if (outcome && outcome !== "poll") {
        return outcome;
      }
    }
  }

  if (jobId) {
    return pollJobUntilDone(jobId, input.callbacks);
  }

  throw new Error("stream ended without result");
}
