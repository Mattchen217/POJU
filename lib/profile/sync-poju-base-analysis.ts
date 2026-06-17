/**
 * Backfill stored_profiles.base_analysis from POJU session report messages.
 * POJU chat persists the report on the session; Glyph/Syncro read stored_profiles.
 */
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { getPojuDb } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  getStoredProfile,
  profileHasBaseAnalysis,
  saveBaseAnalysisFromStream,
} from "@/lib/profile/stored-profiles-service";

function reportTextFromSession(session: POJUSessionState): Array<{ profileId: string; text: string }> {
  const out: Array<{ profileId: string; text: string }> = [];
  const fallbackProfileId = session.selected_stored_profile_id?.trim() ?? "";

  for (const m of session.messages) {
    if (m.meta?.kind !== "report") continue;
    const profileId = (m.meta.report_profile_id ?? fallbackProfileId).trim();
    const text = (m.meta.report_text ?? m.content).trim();
    if (!profileId || text.length < 80) continue;
    out.push({ profileId, text });
  }

  return out;
}

/** Write a POJU chat report into stored_profiles when the profile row is missing analysis. */
export async function backfillBaseAnalysisFromReportText(input: {
  profile_id: string;
  display_text: string;
  locale?: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const profileId = input.profile_id.trim();
  const displayText = input.display_text.trim();
  if (!profileId || displayText.length < 80) return false;
  if (await profileHasBaseAnalysis(profileId)) return false;

  const data = await getStoredProfile(profileId);
  if (!data?.user_profile) return false;

  const local = buildStreamLocalDataFromProfile(data.user_profile, {
    output_language: input.locale?.startsWith("zh") ? "zh" : "en",
  });

  await saveBaseAnalysisFromStream({
    profile_id: profileId,
    display_text: displayText,
    structured: local.structured,
    meta: { source: "poju_report_backfill" },
    locale: input.locale ?? "en",
    generated_at: new Date().toISOString(),
  });

  console.info("[sync-poju-base-analysis] backfilled profile", profileId);
  return true;
}

/** Scan device POJU sessions and sync any report messages into stored_profiles. */
export async function syncPojuReportMessagesToStoredProfiles(): Promise<number> {
  if (typeof window === "undefined") return 0;

  const deviceId = getPojuDeviceId();
  const rows = await getPojuDb().pojuSessionRecords.where("device_id").equals(deviceId).toArray();
  let synced = 0;

  for (const row of rows) {
    const session = await loadPOJUSession(row.session_id);
    if (!session) continue;

    for (const { profileId, text } of reportTextFromSession(session)) {
      try {
        const ok = await backfillBaseAnalysisFromReportText({
          profile_id: profileId,
          display_text: text,
          locale: session.matrix_payload?.display?.narrative_locale,
        });
        if (ok) synced += 1;
      } catch (e) {
        console.warn("[sync-poju-base-analysis] backfill failed:", profileId, e);
      }
    }
  }

  return synced;
}

/** Sync report messages from a single POJU session (call after save). */
export async function syncPojuSessionReportsToStoredProfiles(session: POJUSessionState): Promise<void> {
  for (const { profileId, text } of reportTextFromSession(session)) {
    try {
      await backfillBaseAnalysisFromReportText({
        profile_id: profileId,
        display_text: text,
        locale: session.matrix_payload?.display?.narrative_locale,
      });
    } catch (e) {
      console.warn("[sync-poju-base-analysis] session backfill failed:", profileId, e);
    }
  }
}
