/**
 * Parse fetch bodies safely (Safari throws opaque errors on response.json() for HTML/504).
 */
export async function readFetchJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("empty_response");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        `non_json_response:${response.status}:Server returned HTML (often a timeout or gateway error).`,
      );
    }
    throw new Error(`invalid_json_response:${response.status}:${snippet}`);
  }
}
