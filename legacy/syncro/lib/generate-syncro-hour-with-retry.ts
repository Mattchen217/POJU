import { readFetchJson } from "@/lib/client/fetch-json";
import { hourPeriodDisplayName, HOUR_PERIOD_RANGES } from "@/lib/syncro/hour-period-ranges";
import { buildSyncroProfileSummary } from "@/lib/syncro/syncro-profile-summary";
import type { HourPeriod } from "@/lib/syncro/types";
import type { SyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";

export type SyncroHourCellInput = {
  key: string;
  direction: string;
  current_level: string;
};

export type GenerateSyncroHourResult = {
  success: boolean;
  advice?: Record<
    string,
    { short_advice: string; detailed_advice: string; rationale: string }
  >;
  error?: string;
  model?: string;
  tokens_used?: number;
};

const MAX_ATTEMPTS = 3;

export function cellsForHourFromContext(
  ctx: SyncroLlmContext,
  hourId: HourPeriod,
): SyncroHourCellInput[] {
  return Object.keys(ctx.local_matrix)
    .filter((k) => k.startsWith(`${hourId}__`))
    .map((key) => {
      const [, direction] = key.split("__");
      const local = ctx.local_matrix[key];
      return {
        key,
        direction: direction ?? "N",
        current_level: local?.current_level ?? "stillwater",
      };
    });
}

export async function generateSyncroHourWithRetry(
  hourId: HourPeriod,
  ctx: SyncroLlmContext,
  onAttempt?: (attempt: number) => void,
  sessionId?: string,
): Promise<GenerateSyncroHourResult> {
  const cells = cellsForHourFromContext(ctx, hourId);
  if (cells.length === 0) {
    return { success: false, error: "no_cells" };
  }

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt?.(attempt);
    console.log(`[Syncro] ${hourId} attempt ${attempt}/${MAX_ATTEMPTS}`);

    try {
      const response = await fetch("/api/syncro/llm_hour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          profile_id: ctx.profile_id,
          hour_id: hourId,
          hour_label: hourPeriodDisplayName(hourId, ctx.locale),
          hour_range: HOUR_PERIOD_RANGES[hourId],
          cells,
          task_description: ctx.task_description,
          profile_summary: buildSyncroProfileSummary(ctx.base_analysis, ctx.task_description),
          locale: ctx.locale,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (response.ok) {
        const data = await readFetchJson<{
          success?: boolean;
          advice?: GenerateSyncroHourResult["advice"];
          model?: string;
          tokens_used?: number;
        }>(response);

        if (data.success && data.advice) {
          console.log(`[Syncro] ✅ ${hourId} success on attempt ${attempt}`);
          return {
            success: true,
            advice: data.advice,
            model: data.model,
            tokens_used: data.tokens_used,
          };
        }
        lastError = "no_advice";
      } else {
        let errData: { error?: string; retryable?: boolean; detail?: string } = {};
        try {
          errData = await response.json();
        } catch {
          errData = { error: `http_${response.status}`, retryable: response.status >= 500 };
        }

        if (!errData.retryable) {
          console.error(`[Syncro] ❌ ${hourId} non-retryable error:`, errData);
          return { success: false, error: errData.error ?? `http_${response.status}` };
        }

        lastError = errData.error ?? `http_${response.status}`;
        console.warn(`[Syncro] ⚠️ ${hourId} attempt ${attempt} failed:`, lastError, errData.detail);
      }
    } catch (e) {
      const err = e as Error & { name?: string };
      lastError = err.name === "TimeoutError" ? "timeout" : err.message || "unknown";
      console.warn(`[Syncro] ⚠️ ${hourId} attempt ${attempt} failed:`, lastError);
    }

    if (attempt < MAX_ATTEMPTS) {
      const waitMs = 1500 * Math.pow(2, attempt - 1);
      console.log(`[Syncro] ${hourId} waiting ${waitMs}ms before retry`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  console.error(`[Syncro] ❌❌ ${hourId} all ${MAX_ATTEMPTS} attempts failed: ${lastError}`);
  return { success: false, error: lastError };
}
