import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { getPojuDb, ensurePojuDbReady, type ArchiveRecord } from "@/lib/db/poju-db";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { mapSessionActionsToArchiveActions } from "@/lib/archive/map-actions-for-archive";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { CURRENT_LEVELS, type CurrentLevel } from "@/lib/syncro/current-system";
import type { MatchReport } from "@/lib/match/types";
import { normalizeMatchArchiveSynergyType } from "@/lib/match/synergy-normalize";
import type { SyncroMatrix } from "@/lib/syncro/types";
import type { POJUSessionState } from "@/lib/poju/types";
import type { POJUAction } from "@/lib/poju/types";
import type { SignData } from "@/types/oracle";

const ARCHIVE_SECRET = "pojulife_v4_archive_vault";

export interface POJUActionRecommendationsData {
  session_id: string;
  profile_id: string;
  original_question: string;
  delivered_at: string;
  /** Excerpt from main delivery for archive detail view. */
  delivery_excerpt?: string;
  actions: Array<{
    action_id: string;
    category: "traditional_fengshui" | "modern_decisive" | "modern_reflective";
    title: string;
    description: string;
    rationale: string;
    timing?: POJUAction["timing"];
    status: POJUAction["status"];
    user_feedback?: string;
    updated_at?: string;
  }>;
}

export interface ArchiveSummary {
  archive_id: string;
  type: ArchiveRecord["type"];
  title: string;
  product: ArchiveRecord["product"];
  session_id?: string;
  created_at: string;
}

export interface GlyphReadingArchiveData {
  reading_id: string;
  profile_id: string;
  question: string;
  sign_number: number;
  sign_level: SignData["level"];
  glyph_display_name: string;
  wind_category: string;
  delivered_at: string;
  reading: GlyphReadingContent;
}

export interface SyncroTaskArchiveData {
  syncro_session_id: string;
  profile_id: string;
  task_description: string;
  created_at: string;
  expires_at: string;
  best_combination?: {
    hour_period: string;
    direction: string;
    current_level: string;
    short_advice: string;
  };
}

export interface MatchArchiveData {
  match_session_id: string;
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  synergy_type: string;
  created_at: string;
  summary: {
    overall_summary: string;
    a_summary: string;
    b_summary: string;
    top_actions: string[];
  };
}

function scoreForCurrentLevel(level: string): number {
  if (level in CURRENT_LEVELS) {
    return CURRENT_LEVELS[level as CurrentLevel].score;
  }
  return 0;
}

function formatSyncroArchiveTitle(task: string, locale: string, now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const snippet = task.length > 30 ? `${task.slice(0, 30)}…` : task;
  return locale.startsWith("zh") ? `Syncro：${snippet} · ${dateStr}` : `Syncro: ${snippet} - ${dateStr}`;
}

function formatArchiveTitle(locale: string, now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  return locale.startsWith("zh") ? `POJU 行动建议 - ${dateStr}` : `POJU Action Plan - ${dateStr}`;
}

function notifyArchiveUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
}

function archiveCreatedMs(created: Date | string | number): number {
  if (created instanceof Date) return created.getTime();
  const ms = new Date(created).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeArchiveCreatedAt(created: Date | string | number): string {
  return new Date(archiveCreatedMs(created)).toISOString();
}

export async function saveActionRecommendationsToArchive(input: {
  session_id: string;
  profile_id: string;
  original_question: string;
  actions: POJUActionRecommendationsData["actions"];
  delivery_excerpt?: string;
  locale?: string;
}): Promise<string> {
  const deviceId = getPojuDeviceId();
  const archiveId = safeRandomUUID();
  const now = new Date();
  const title = formatArchiveTitle(input.locale ?? "en", now);

  const data: POJUActionRecommendationsData = {
    session_id: input.session_id,
    profile_id: input.profile_id,
    original_question: input.original_question,
    delivered_at: now.toISOString(),
    delivery_excerpt: input.delivery_excerpt,
    actions: input.actions,
  };

  const { cipher, iv } = await encryptJson(ARCHIVE_SECRET, data);

  await getPojuDb().archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: "poju_action_recommendations",
    session_id: input.session_id,
    profile_id: input.profile_id,
    title,
    encrypted_data: cipher,
    iv,
    created_at: now,
    product: "poju",
  });

  notifyArchiveUpdated();
  return archiveId;
}

export async function listArchive(filter?: {
  type?: ArchiveRecord["type"];
  product?: ArchiveRecord["product"];
  /** Max rows after sort (newest first). */
  limit?: number;
}): Promise<ArchiveSummary[]> {
  const deviceId = getPojuDeviceId();
  const db = await ensurePojuDbReady();
  const records = await db.archive.where("device_id").equals(deviceId).toArray();

  const sorted = records
    .filter((r) => !filter?.type || r.type === filter.type)
    .filter((r) => !filter?.product || r.product === filter.product)
    .sort((a, b) => archiveCreatedMs(b.created_at) - archiveCreatedMs(a.created_at))
    .map((r) => ({
      archive_id: r.archive_id,
      type: r.type,
      title: r.title,
      product: r.product,
      session_id: r.session_id,
      created_at: normalizeArchiveCreatedAt(r.created_at),
    }));

  if (filter?.limit != null && filter.limit > 0) {
    return sorted.slice(0, filter.limit);
  }
  return sorted;
}

export async function loadArchiveItem(archiveId: string): Promise<POJUActionRecommendationsData | null> {
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || record.type !== "poju_action_recommendations") return null;

  try {
    return await decryptJson<POJUActionRecommendationsData>(ARCHIVE_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
  } catch (e) {
    console.error("[archive] Decrypt failed:", e);
    return null;
  }
}

function glyphQuestionSnippet(question: string, maxLen: number, locale: string): string {
  const q = question.trim().replace(/\s+/g, " ");
  if (!q) return locale.startsWith("zh") ? "未填写问题" : "No question entered";
  return q.length > maxLen ? `${q.slice(0, maxLen)}…` : q;
}

/** Archive list title — user question only (no sign / story figure naming). */
function formatGlyphArchiveTitle(question: string, locale: string, now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const snippet = glyphQuestionSnippet(question, 36, locale);
  return locale.startsWith("zh") ? `Glyph：${snippet} · ${dateStr}` : `Glyph: ${snippet} - ${dateStr}`;
}

export async function saveGlyphReadingToArchive(input: {
  reading_id: string;
  profile_id: string;
  question: string;
  sign: SignData;
  wind_category: string;
  reading: GlyphReadingContent;
  locale?: string;
}): Promise<string> {
  const deviceId = getPojuDeviceId();
  const archiveId = safeRandomUUID();
  const now = new Date();
  const locale = input.locale ?? "en";
  const questionLabel = glyphQuestionSnippet(input.question, 72, locale);
  const title = formatGlyphArchiveTitle(input.question, locale, now);

  const data: GlyphReadingArchiveData = {
    reading_id: input.reading_id,
    profile_id: input.profile_id,
    question: input.question,
    sign_number: input.sign.sign_number,
    sign_level: input.sign.level,
    glyph_display_name: questionLabel,
    wind_category: input.wind_category,
    delivered_at: now.toISOString(),
    reading: input.reading,
  };

  const { cipher, iv } = await encryptJson(ARCHIVE_SECRET, data);

  await getPojuDb().archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: "glyph_reading",
    profile_id: input.profile_id,
    title,
    encrypted_data: cipher,
    iv,
    created_at: now,
    product: "glyph",
  });

  notifyArchiveUpdated();
  return archiveId;
}

export async function saveSyncroToArchive(input: {
  syncro_session_id: string;
  profile_id: string;
  task_description: string;
  matrix: SyncroMatrix;
  expires_at: Date;
  locale?: string;
}): Promise<string> {
  const deviceId = getPojuDeviceId();
  const archiveId = safeRandomUUID();
  const now = new Date();
  const title = formatSyncroArchiveTitle(input.task_description, input.locale ?? "en", now);

  const bestCombo = Object.entries(input.matrix)
    .map(([key, combo]) => {
      const [hour, dir] = key.split("__");
      return {
        hour,
        dir,
        combo,
        score: scoreForCurrentLevel(combo.current_level),
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  const data: SyncroTaskArchiveData = {
    syncro_session_id: input.syncro_session_id,
    profile_id: input.profile_id,
    task_description: input.task_description,
    created_at: now.toISOString(),
    expires_at: input.expires_at.toISOString(),
    best_combination: bestCombo
      ? {
          hour_period: bestCombo.hour,
          direction: bestCombo.dir,
          current_level: bestCombo.combo.current_level,
          short_advice: bestCombo.combo.short_advice,
        }
      : undefined,
  };

  const { cipher, iv } = await encryptJson(ARCHIVE_SECRET, data);

  await getPojuDb().archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: "syncro_task",
    session_id: input.syncro_session_id,
    profile_id: input.profile_id,
    title,
    encrypted_data: cipher,
    iv,
    created_at: now,
    product: "syncro",
  });

  notifyArchiveUpdated();
  return archiveId;
}

function formatMatchArchiveTitle(relationship: string, locale: string, now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const snippet = relationship.length > 30 ? `${relationship.slice(0, 30)}…` : relationship;
  return locale.startsWith("zh") ? `Match：${snippet} · ${dateStr}` : `Match: ${snippet} - ${dateStr}`;
}

export async function saveMatchToArchive(input: {
  match_id: string;
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  report: MatchReport;
  locale?: string;
}): Promise<string> {
  const deviceId = getPojuDeviceId();
  const archiveId = safeRandomUUID();
  const now = new Date();
  const title = formatMatchArchiveTitle(
    input.relationship_description,
    input.locale ?? "en",
    now,
  );

  const data: MatchArchiveData = {
    match_session_id: input.match_id,
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    relationship_description: input.relationship_description,
    synergy_type: normalizeMatchArchiveSynergyType(input.report.conclusion?.synergy_type),
    created_at: now.toISOString(),
    summary: {
      overall_summary: input.report.conclusion?.summary ?? "",
      a_summary: input.report.analysis_a?.summary ?? "",
      b_summary: input.report.analysis_b?.summary ?? "",
      top_actions: (input.report.recommendations?.actions ?? [])
        .slice(0, 3)
        .map((a) => a.title)
        .filter(Boolean),
    },
  };

  const { cipher, iv } = await encryptJson(ARCHIVE_SECRET, data);

  await getPojuDb().archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    type: "match_session",
    session_id: input.match_id,
    profile_id: input.a_profile_id,
    title,
    encrypted_data: cipher,
    iv,
    created_at: now,
    product: "match",
  });

  notifyArchiveUpdated();
  return archiveId;
}

export async function loadMatchArchive(archiveId: string): Promise<MatchArchiveData | null> {
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || record.type !== "match_session") return null;

  try {
    const data = await decryptJson<MatchArchiveData & { compatibility_level?: string }>(
      ARCHIVE_SECRET,
      {
        iv: record.iv,
        cipher: record.encrypted_data,
      },
    );
    return {
      ...data,
      synergy_type: normalizeMatchArchiveSynergyType(data.synergy_type ?? data.compatibility_level),
    };
  } catch (e) {
    console.error("[archive] Match decrypt failed:", e);
    return null;
  }
}

export async function loadSyncroArchive(archiveId: string): Promise<SyncroTaskArchiveData | null> {
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || record.type !== "syncro_task") return null;

  try {
    return await decryptJson<SyncroTaskArchiveData>(ARCHIVE_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
  } catch (e) {
    console.error("[archive] Syncro decrypt failed:", e);
    return null;
  }
}

export async function loadGlyphReading(archiveId: string): Promise<GlyphReadingArchiveData | null> {
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || record.type !== "glyph_reading") return null;

  try {
    return await decryptJson<GlyphReadingArchiveData>(ARCHIVE_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
  } catch (e) {
    console.error("[archive] Glyph decrypt failed:", e);
    return null;
  }
}

export async function updateArchiveActionStatus(
  archiveId: string,
  actionId: string,
  status: "completed" | "modified" | "skipped",
  userFeedback?: string,
): Promise<void> {
  const data = await loadArchiveItem(archiveId);
  if (!data) return;

  const action = data.actions.find((a) => a.action_id === actionId);
  if (!action) return;

  action.status = status;
  action.user_feedback = userFeedback;
  action.updated_at = new Date().toISOString();

  const { cipher, iv } = await encryptJson(ARCHIVE_SECRET, data);
  await getPojuDb().archive.update(archiveId, { encrypted_data: cipher, iv });
  notifyArchiveUpdated();
}

export async function deleteArchiveItem(archiveId: string): Promise<void> {
  await getPojuDb().archive.delete(archiveId);
  notifyArchiveUpdated();
}

/** Client-only: completed actions from the action-plan archive for this session (tracking prompts). */
export async function loadArchiveDataForSession(
  sessionId: string,
): Promise<POJUActionRecommendationsData | null> {
  const items = await listArchive({ product: "poju", type: "poju_action_recommendations" });
  const hit = items.find((a) => a.session_id === sessionId);
  if (!hit) return null;
  return loadArchiveItem(hit.archive_id);
}

/** After main delivery: persist the 3 action cards to IndexedDB archive (non-blocking for caller). */
export async function trySaveDeliveryActionsToArchive(
  session: POJUSessionState,
  locale: string,
): Promise<POJUSessionState> {
  if (session.action_plan_archive_id) return session;
  const deliveryActions = session.main_delivery?.actions?.length
    ? session.main_delivery.actions
    : session.actions;
  if (deliveryActions.length < 1 && !session.main_delivery?.analysis) return session;

  const md = session.main_delivery;
  const deliveryExcerpt = md
    ? [
        md.analysis?.user_situation_summary,
        md.conclusion?.core_message,
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000)
    : "";

  try {
    const profileId = session.selected_stored_profile_id ?? session.agent_v2?.selected_profile_id ?? "";
    const mapped = mapSessionActionsToArchiveActions(deliveryActions.slice(0, 3));
    if (mapped.length < 1 && !deliveryExcerpt) return session;

    const archiveId = await saveActionRecommendationsToArchive({
      session_id: session.session_id,
      profile_id: profileId,
      original_question: session.original_question,
      actions: mapped.length > 0 ? mapped : [],
      delivery_excerpt: deliveryExcerpt || undefined,
      locale,
    });
    console.log("[delivery] Session saved to archive:", archiveId);
    return { ...session, action_plan_archive_id: archiveId };
  } catch (e) {
    console.error("[delivery] Archive save failed:", e);
    return session;
  }
}
