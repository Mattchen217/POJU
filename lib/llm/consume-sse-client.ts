/** Browser: read an SSE response body and invoke callback per `data:` JSON payload. */
export async function consumeFetchSse(
  response: Response,
  onData: (payload: Record<string, unknown>) => void,
): Promise<void> {
  if (!response.body) throw new Error("sse_no_body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        onData(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        /* ignore partial JSON lines */
      }
    }
  }
}
