export interface StreamHourBody {
  session_id: string;
  hour_id: string;
  hour_label: string;
  hour_range: string;
  cells: Array<{
    key: string;
    direction: string;
    current_level: string;
    key_hints?: string[];
  }>;
  task_description: string;
  profile_summary: string;
  locale: string;
}

export type StreamPhase = "connecting" | "reasoning" | "writing";

export type StreamHourAdviceByKey = Record<
  string,
  { short_advice: string; detailed_advice: string; rationale: string }
>;

export interface StreamErrorPayload {
  error: string;
  retryable: boolean;
  detail?: string;
  status?: number;
}

export interface StreamHourCallbacks {
  onProgress?: (phase: StreamPhase) => void;
  onReasoningChunk?: (text: string) => void;
  onContentChunk?: (text: string) => void;
  onComplete?: (advice: StreamHourAdviceByKey, fromCache: boolean) => void;
  onError?: (err: StreamErrorPayload) => void;
}

export interface StreamHourOptions {
  signal?: AbortSignal;
  endpoint?: string;
}

const STREAM_PHASES: ReadonlySet<string> = new Set(["connecting", "reasoning", "writing"]);

/**
 * POST /api/syncro/stream_hour and consume standard SSE events via callbacks.
 * Resolves when the stream ends; outcomes are delivered through onComplete / onError.
 */
export async function runStreamHour(
  body: StreamHourBody,
  callbacks: StreamHourCallbacks,
  options: StreamHourOptions = {},
): Promise<void> {
  const endpoint = options.endpoint ?? "/api/syncro/stream_hour";

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    const message = e instanceof Error ? e.message : String(e);
    callbacks.onError?.({
      error: name === "AbortError" ? "aborted" : "network_error",
      retryable: name !== "AbortError",
      detail: message,
    });
    return;
  }

  if (!response.ok || !response.body) {
    callbacks.onError?.({
      error: "http_error",
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
      detail: await response.text().catch(() => "no body"),
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        parseAndDispatchEvent(rawEvent, callbacks);
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    callbacks.onError?.({
      error: "stream_read_error",
      retryable: true,
      detail: message,
    });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function parseAndDispatchEvent(rawEvent: string, callbacks: StreamHourCallbacks): void {
  let eventName = "message";
  const dataLines: string[] = [];

  const lines = rawEvent.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }

  if (dataLines.length === 0) return;

  const dataStr = dataLines.join("\n");

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataStr) as Record<string, unknown>;
  } catch {
    console.warn("[streaming-runner] failed to parse SSE data:", dataStr.slice(0, 100));
    return;
  }

  switch (eventName) {
    case "progress": {
      const phase = data.phase;
      if (typeof phase === "string" && STREAM_PHASES.has(phase)) {
        callbacks.onProgress?.(phase as StreamPhase);
      }
      break;
    }

    case "reasoning_chunk":
      if (typeof data.text === "string") {
        callbacks.onReasoningChunk?.(data.text);
      }
      break;

    case "chunk":
      if (typeof data.text === "string") {
        callbacks.onContentChunk?.(data.text);
      }
      break;

    case "complete":
      if (data.advice && typeof data.advice === "object") {
        callbacks.onComplete?.(data.advice as StreamHourAdviceByKey, Boolean(data.from_cache));
      }
      break;

    case "error":
      callbacks.onError?.({
        error: typeof data.error === "string" ? data.error : "unknown",
        retryable: Boolean(data.retryable),
        detail: typeof data.detail === "string" ? data.detail : undefined,
        status: typeof data.status === "number" ? data.status : undefined,
      });
      break;

    default:
      break;
  }
}
