import type { StreamHourAdviceByKey, StreamHourCallbacks, StreamErrorPayload } from "./streaming-runner";

export type { SyncroLlmHoursInput } from "./syncro-llm-batch-core";

export async function runStreamHours(
  body: import("./syncro-llm-batch-core").SyncroLlmHoursInput,
  callbacks: StreamHourCallbacks,
  options: { signal?: AbortSignal; endpoint?: string } = {},
): Promise<void> {
  const endpoint = options.endpoint ?? "/api/syncro/stream_hours";

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
        dispatchSseEvent(rawEvent, callbacks);
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") return;
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

function dispatchSseEvent(rawEvent: string, callbacks: StreamHourCallbacks): void {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const rawLine of rawEvent.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }

  if (dataLines.length === 0) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
  } catch {
    return;
  }

  switch (eventName) {
    case "progress": {
      const phase = data.phase;
      if (phase === "connecting" || phase === "reasoning" || phase === "writing") {
        callbacks.onProgress?.(phase);
      }
      break;
    }
    case "reasoning_chunk":
      if (typeof data.text === "string") callbacks.onReasoningChunk?.(data.text);
      break;
    case "chunk":
      if (typeof data.text === "string") callbacks.onContentChunk?.(data.text);
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

export type StreamHoursErrorPayload = StreamErrorPayload;
