import { readFetchJson } from "@/lib/client/fetch-json";
import type { MatrixCell } from "@/lib/syncro/calculate-matrix";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import {
  saveSyncroLlmContext,
  type SyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import type { SyncroSession } from "@/lib/syncro/types";

/** Re-fetch `local_matrix` via compute_local when sessionStorage/IndexedDB ctx is missing. */
export async function rebuildSyncroLlmContext(
  session: SyncroSession,
): Promise<SyncroLlmContext | null> {
  const profileRow = await getStoredProfile(session.profile_id);
  if (!profileRow?.user_profile || profileRow.base_analysis?.content == null) {
    console.error("[Syncro] rebuild ctx: profile or base_analysis missing");
    return null;
  }

  try {
    const response = await fetch("/api/syncro/compute_local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: session.profile_id,
        task_description: session.task_description,
        user_location: session.user_location,
        locale: session.locale,
        user_profile: profileRow.user_profile,
        base_analysis: profileRow.base_analysis.content,
      }),
    });

    const data = await readFetchJson<{
      success?: boolean;
      local_matrix?: Record<string, MatrixCell>;
      compute_started_at?: string;
      true_solar_meta?: import("@/lib/syncro/calculate-matrix").SyncroMatrixMetadata;
      error?: string;
      message?: string;
    }>(response);

    if (!response.ok || !data.success || !data.local_matrix) {
      console.error("[Syncro] rebuild ctx failed:", data.error ?? data.message ?? response.status);
      return null;
    }

    const ctx: SyncroLlmContext = {
      profile_id: session.profile_id,
      task_description: session.task_description,
      user_location: session.user_location,
      locale: session.locale,
      user_profile: profileRow.user_profile,
      base_analysis: profileRow.base_analysis.content,
      local_matrix: data.local_matrix,
      compute_started_at: data.compute_started_at ?? new Date().toISOString(),
      true_solar: data.true_solar_meta,
    };

    saveSyncroLlmContext(session.session_id, ctx);
    console.log("[Syncro] rebuild ctx ok, cells:", Object.keys(ctx.local_matrix).length);
    return ctx;
  } catch (e) {
    console.error("[Syncro] rebuild ctx exception:", e);
    return null;
  }
}
