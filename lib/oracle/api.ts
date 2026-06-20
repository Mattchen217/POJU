import type {
  GlyphReadingContent,
  GlyphReadingServiceResult,
} from "@/lib/llm/services/glyph-reading-service";
import {
  loadCachedGlyphReadingResult,
  saveCachedGlyphReadingResult,
} from "@/lib/glyph/glyph-reading-result-cache";
import { readFetchJson } from "@/lib/client/fetch-json";
import type { UserProfile } from "@/lib/profile/types";
import type { SignData, UserInput, FullReading } from "@/types/oracle";

const inFlightFullReadingRequests = new Map<string, Promise<FullReading>>();
const inFlightGlyphReadingRequests = new Map<string, Promise<GlyphReadingServiceResult>>();

/** Slightly above server maxDuration (300s) + JSON parse slack. */
export const GLYPH_READING_CLIENT_TIMEOUT_MS = 320_000;

export function clearInFlightGlyphReading(readingId: string): void {
  inFlightGlyphReadingRequests.delete(`glyph:${readingId}`);
}

function mergeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const active = signals.filter((s) => !s.aborted);
  if (active.length === 0) return AbortSignal.abort();
  if (active.length === 1) return active[0]!;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(active);
  }
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

function glyphReadingFetchSignal(external?: AbortSignal): AbortSignal {
  const timeout =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(GLYPH_READING_CLIENT_TIMEOUT_MS)
      : undefined;
  if (external && timeout) return mergeAbortSignals(external, timeout);
  if (timeout) return timeout;
  return external ?? AbortSignal.abort();
}

export async function generateFullReading({
  sign,
  userInput,
  locale,
}: {
  sign: SignData;
  userInput: UserInput;
  /** next-intl 当前 locale，传给 LLM 语言指令 */
  locale: string;
}): Promise<FullReading> {
  const requestPayload = {
    sign_number: sign.sign_number,
    level: sign.level,
    user_birth: {
      year: userInput.birthYear,
      month: userInput.birthMonth,
      day: userInput.birthDay,
      shichen: userInput.birthShichen,
    },
    user_question: userInput.question,
    locale,
  };
  const requestKey = JSON.stringify(requestPayload);

  const pending = inFlightFullReadingRequests.get(requestKey);
  if (pending) return pending;

  const requestPromise = (async () => {
    const response = await fetch("/api/oracle/full-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as {
          error?: string;
          message?: string;
          details?: string;
        };
        errorMessage =
          errorData.error ||
          errorData.message ||
          errorData.details ||
          errorMessage;
      } catch {
        // Ignore JSON parse failures and keep status-based fallback.
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as {
      reading: FullReading;
      language?: string;
    };
    return data.reading;
  })().finally(() => {
    inFlightFullReadingRequests.delete(requestKey);
  });

  inFlightFullReadingRequests.set(requestKey, requestPromise);
  return requestPromise;
}

/** Glyph v5 — DeepSeek reading with POJU profile + base_analysis (browser sends bundle). */
export async function generateGlyphFullReading({
  sign,
  question,
  locale,
  profile_id,
  reading_id,
  user_profile,
  base_analysis,
  signal,
  force,
}: {
  sign: SignData;
  question: string;
  locale: string;
  profile_id: string;
  reading_id?: string;
  user_profile: UserProfile;
  base_analysis: unknown;
  signal?: AbortSignal;
  /** When true, skip in-flight dedupe (e.g. after background resume retry). */
  force?: boolean;
}): Promise<GlyphReadingServiceResult> {
  if (reading_id) {
    const cached = loadCachedGlyphReadingResult(reading_id);
    if (cached) return cached;
  }

  const requestPayload = {
    sign_number: sign.sign_number,
    level: sign.level,
    user_question: question.trim(),
    locale,
    profile_id,
    reading_id,
    user_profile,
    base_analysis,
  };
  const requestKey = reading_id
    ? `glyph:${reading_id}`
    : `glyph:${JSON.stringify({ sign_number: sign.sign_number, profile_id, question: question.trim() })}`;

  if (!force) {
    const pending = inFlightGlyphReadingRequests.get(requestKey);
    if (pending) return pending;
  }

  const requestPromise = (async () => {
    let response: Response;
    try {
      response = await fetch("/api/oracle/full-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: glyphReadingFetchSignal(signal),
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("glyph_reading_client_timeout");
      }
      if (e instanceof Error && /load failed|failed to fetch/i.test(e.message)) {
        throw new Error("NETWORK_LOAD_FAILED");
      }
      throw e;
    }

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await readFetchJson<{
          error?: string;
          message?: string;
          code?: string;
        }>(response);
        errorMessage = errorData.error || errorData.message || errorMessage;
        if (errorData.code && !errorData.error?.includes(errorData.code)) {
          errorMessage = `${errorMessage}:${errorData.code}`;
        }
      } catch {
        // keep status fallback
      }
      throw new Error(errorMessage);
    }

    const data = await readFetchJson<{
      reading: GlyphReadingContent;
      meta?: GlyphReadingServiceResult["meta"];
    }>(response);

    const result = {
      reading: data.reading,
      meta: data.meta ?? {
        model: "unknown",
        tokens_used: 0,
        cost_usd: 0,
        latency_ms: 0,
      },
    };

    if (reading_id) {
      saveCachedGlyphReadingResult(reading_id, result);
    }

    return result;
  })().finally(() => {
    inFlightGlyphReadingRequests.delete(requestKey);
  });

  inFlightGlyphReadingRequests.set(requestKey, requestPromise);
  return requestPromise;
}
