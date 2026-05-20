import { decryptJson, encryptJson } from "@/lib/crypto";
import { getPojuDb, type ArchiveRecord } from "@/lib/db/poju-db";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { mapSessionActionsToArchiveActions } from "@/lib/archive/map-actions-for-archive";
import type { POJUSessionState } from "@/lib/poju/types";
import type { POJUAction } from "@/lib/poju/types";

const ARCHIVE_SECRET = "pojulife_v4_archive_vault";

export interface POJUActionRecommendationsData {
  session_id: string;
  profile_id: string;
  original_question: string;
  delivered_at: string;
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

export async function saveActionRecommendationsToArchive(input: {
  session_id: string;
  profile_id: string;
  original_question: string;
  actions: POJUActionRecommendationsData["actions"];
  locale?: string;
}): Promise<string> {
  const deviceId = getPojuDeviceId();
  const archiveId = crypto.randomUUID();
  const now = new Date();
  const title = formatArchiveTitle(input.locale ?? "en", now);

  const data: POJUActionRecommendationsData = {
    session_id: input.session_id,
    profile_id: input.profile_id,
    original_question: input.original_question,
    delivered_at: now.toISOString(),
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
}): Promise<ArchiveSummary[]> {
  const deviceId = getPojuDeviceId();
  const records = await getPojuDb().archive.where("device_id").equals(deviceId).toArray();

  return records
    .filter((r) => !filter?.type || r.type === filter.type)
    .filter((r) => !filter?.product || r.product === filter.product)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .map((r) => ({
      archive_id: r.archive_id,
      type: r.type,
      title: r.title,
      product: r.product,
      session_id: r.session_id,
      created_at: r.created_at.toISOString(),
    }));
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
  const deliveryActions = session.main_delivery?.actions ?? [];
  if (deliveryActions.length < 3) return session;

  try {
    const profileId = session.selected_stored_profile_id ?? session.agent_v2?.selected_profile_id ?? "";
    const archiveId = await saveActionRecommendationsToArchive({
      session_id: session.session_id,
      profile_id: profileId,
      original_question: session.original_question,
      actions: mapSessionActionsToArchiveActions(deliveryActions.slice(0, 3)),
      locale,
    });
    console.log("[delivery] Action plan saved to archive:", archiveId);
    return { ...session, action_plan_archive_id: archiveId };
  } catch (e) {
    console.error("[delivery] Archive save failed:", e);
    return session;
  }
}
