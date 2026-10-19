import { ensurePojuDbReady } from "@/lib/db/poju-db";
import { listActivePojuSessionsForPicker } from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import { isDefaultNewSessionTitle, sessionListTopicLine } from "@/lib/poju/session-list-label";
import { journeyStageFromHint } from "@/lib/poju/session-journey-stage";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";

/** Latest decision-dialogue session meta for a birth-info row (rail-aligned). */
export type BirthRecordLatestSession = {
  sessionId: string;
  /** Display title after POJU: prefix strip — empty means untitled/default. */
  displayTitle: string;
  /** How+Get stage 1-6, or 0 when no session. */
  journeyStage: number;
  hasRealTitle: boolean;
};

function pojuHistoryTitle(originalQuestion: string, locale: string): string {
  const snippet = sessionListTopicLine(originalQuestion);
  return locale.startsWith("zh") ? `POJU：${snippet}` : `POJU: ${snippet}`;
}

/** Same strip as left-rail history row snippet. */
export function stripPojuHistoryPrefix(title: string): string {
  const t = title.trim();
  const stripped = t.replace(/^POJU[:\uFF1A]\s*/i, "").trim();
  return stripped || t;
}

function metaFromLive(
  sessionId: string,
  originalQuestion: string,
  locale: string,
  currentStateHint?: string,
  mainDeliveryDone?: boolean,
): BirthRecordLatestSession {
  const raw = pojuHistoryTitle(originalQuestion, locale);
  const displayTitle = stripPojuHistoryPrefix(raw);
  const untitled = isDefaultNewSessionTitle(originalQuestion) || !displayTitle;
  return {
    sessionId,
    displayTitle: untitled ? "" : displayTitle,
    journeyStage: journeyStageFromHint(currentStateHint, Boolean(mainDeliveryDone)),
    hasRealTitle: !untitled,
  };
}

/**
 * Map profile_id → latest linked POJU (decision-dialogue) session.
 * Prefers live sessions (same source as left-rail); falls back to archive index.
 */
export async function mapLatestPojuSessionByProfileId(
  locale: string,
): Promise<Map<string, BirthRecordLatestSession>> {
  const byProfile = new Map<string, BirthRecordLatestSession>();
  if (typeof window === "undefined") return byProfile;

  const live = await listActivePojuSessionsForPicker();
  const claimedSessionIds = new Set<string>();

  for (const row of live) {
    try {
      const state = await loadPOJUSession(row.session_id);
      const pid =
        state?.selected_stored_profile_id?.trim() ||
        state?.agent_v2?.selected_profile_id?.trim() ||
        "";
      if (!pid || byProfile.has(pid)) continue;
      byProfile.set(
        pid,
        metaFromLive(
          row.session_id,
          row.original_question,
          locale,
          row.current_state_hint,
          row.main_delivery_done,
        ),
      );
      claimedSessionIds.add(row.session_id);
    } catch {
      /* ignore decrypt / load errors */
    }
  }

  try {
    const ownerKey = await resolveLocalOwnerKey();
    const db = await ensurePojuDbReady();
    const archives = (await db.archive.where("owner_key").equals(ownerKey).toArray())
      .filter((r) => r.product === "poju" && Boolean(r.profile_id?.trim()))
      .sort((a, b) => {
        const am = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at).getTime();
        const bm = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at).getTime();
        return bm - am;
      });

    const liveById = new Map(live.map((s) => [s.session_id, s]));

    for (const arch of archives) {
      const pid = arch.profile_id?.trim();
      if (!pid || byProfile.has(pid)) continue;
      const sid = arch.session_id?.trim();
      if (sid && liveById.has(sid)) {
        const liveRow = liveById.get(sid)!;
        byProfile.set(
          pid,
          metaFromLive(
            sid,
            liveRow.original_question,
            locale,
            liveRow.current_state_hint,
            liveRow.main_delivery_done,
          ),
        );
        continue;
      }
      if (sid && claimedSessionIds.has(sid)) continue;
      const rawTitle = (arch.title || "").trim();
      const displayTitle = stripPojuHistoryPrefix(rawTitle);
      const untitled = !displayTitle || /^new session$/i.test(displayTitle);
      byProfile.set(pid, {
        sessionId: sid || arch.archive_id,
        displayTitle: untitled ? "" : displayTitle,
        journeyStage: 6,
        hasRealTitle: !untitled,
      });
    }
  } catch {
    /* archive optional */
  }

  return byProfile;
}