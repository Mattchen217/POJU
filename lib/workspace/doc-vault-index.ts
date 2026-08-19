/**
 * Aggregate IndexedDB artifacts into a right-rail document vault index.
 * Partitioned by auth owner_key (user:<id> | guest:<deviceId>).
 */

import { listArchive } from "@/lib/archive/archive-service";
import { ensurePojuDbReady, getPojuDb } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { listStoredProfiles } from "@/lib/profile/stored-profiles-service";
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";
import {
  isDocVaultUnread,
  pruneDocVaultUnread,
} from "@/lib/workspace/doc-vault-unread";
import type { DocVaultItem, DocVaultSection } from "@/lib/workspace/doc-vault-types";
import { DOC_VAULT_SECTION_ORDER } from "@/lib/workspace/doc-vault-types";

function matrixDocId(profileId: string): string {
  return `matrix:${profileId}`;
}

function reportDocId(profileId: string): string {
  return `report:${profileId}`;
}

function deliveryDocId(sessionId: string): string {
  return `delivery:${sessionId}`;
}

function archiveDocId(archiveId: string): string {
  return `archive:${archiveId}`;
}

/** User-facing subject: display name + birth date when both useful. */
function profileSubjectLabel(displayName: string, birthDate: string): string {
  const name = displayName.trim();
  const birth = birthDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? birthDate.trim();
  if (name && birth && name !== birth) return `${name} · ${birth}`;
  return name || birth || "";
}

export async function listDocVaultItems(locale = "en"): Promise<DocVaultItem[]> {
  if (typeof window === "undefined") return [];

  const ownerKey = await resolveLocalOwnerKey();
  const zh = locale.startsWith("zh");
  const items: DocVaultItem[] = [];

  // —— Foundation: matrix + base analysis per stored profile ——
  const profiles = await listStoredProfiles();
  const profileById = new Map(profiles.map((p) => [p.profile_id, p]));

  for (const summary of profiles) {
    const subject = profileSubjectLabel(summary.display_name, summary.birth_date);
    const created = summary.created_at;

    const mid = matrixDocId(summary.profile_id);
    items.push({
      id: mid,
      section: "foundation",
      kind: "energy_matrix",
      title: zh ? "个人能量画像" : "Personal energy chart",
      subjectLabel: subject,
      createdAt: created,
      unread: isDocVaultUnread(mid),
      openTarget: { type: "profile_matrix", profileId: summary.profile_id },
    });
  }

  // —— Pivot: completed delivery books ——
  await ensurePojuDbReady();
  const deviceId = getPojuDeviceId();
  const sessionRows = await getPojuDb()
    .pojuSessionRecords.where("owner_key")
    .equals(ownerKey)
    .toArray();

  for (const row of sessionRows) {
    if (!row.main_delivery_done) continue;
    if (row.device_id && row.device_id !== deviceId) continue;
    const sid = row.session_id;
    const id = deliveryDocId(sid);
    const deliveredAt =
      row.main_delivery_at instanceof Date
        ? row.main_delivery_at.toISOString()
        : row.last_interaction_at instanceof Date
          ? row.last_interaction_at.toISOString()
          : new Date().toISOString();

    let subject = "";
    try {
      const state = await loadPOJUSession(sid);
      const pid = state?.selected_stored_profile_id?.trim();
      if (pid) {
        const p = profileById.get(pid);
        if (p) subject = profileSubjectLabel(p.display_name, p.birth_date);
      }
    } catch {
      /* index-only fallback */
    }

    const question = row.original_question?.trim() || "";
    items.push({
      id,
      section: "pivot",
      kind: "pivot_delivery",
      title: question || (zh ? "破局交付报告" : "Breakthrough delivery"),
      subjectLabel: subject || (zh ? "未知主体" : "Unknown subject"),
      createdAt: deliveredAt,
      unread: isDocVaultUnread(id),
      openTarget: { type: "pivot_delivery", sessionId: sid },
    });
  }

  // —— Match / Syncro / Glyph via archive vault ——
  try {
    const archives = await listArchive();
    const archiveRows = await getPojuDb().archive.where("owner_key").equals(ownerKey).toArray();
    const profileIdByArchive = new Map(
      archiveRows.map((r) => [r.archive_id, r.profile_id?.trim() || ""] as const),
    );

    for (const row of archives) {
      if (row.product !== "match" && row.product !== "syncro" && row.product !== "glyph") {
        continue;
      }
      const id = archiveDocId(row.archive_id);
      const pid = profileIdByArchive.get(row.archive_id) || "";
      const p = pid ? profileById.get(pid) : undefined;
      const subject = p ? profileSubjectLabel(p.display_name, p.birth_date) : "";

      if (row.product === "match") {
        items.push({
          id,
          section: "match",
          kind: "match_report",
          title: row.title || (zh ? "合盘报告" : "Match report"),
          subjectLabel: subject || (zh ? "合盘" : "Match"),
          createdAt: row.created_at,
          unread: isDocVaultUnread(id),
          openTarget: { type: "archive", archiveId: row.archive_id, product: "match" },
        });
      } else if (row.product === "syncro") {
        items.push({
          id,
          section: "syncro",
          kind: "syncro_task",
          title: row.title || (zh ? "Syncro 任务" : "Syncro task"),
          subjectLabel: subject || "Syncro",
          createdAt: row.created_at,
          unread: isDocVaultUnread(id),
          openTarget: { type: "archive", archiveId: row.archive_id, product: "syncro" },
        });
      } else {
        items.push({
          id,
          section: "glyph",
          kind: "glyph_reading",
          title: row.title || (zh ? "Glyph 签文" : "Glyph reading"),
          subjectLabel: subject || "Glyph",
          createdAt: row.created_at,
          unread: isDocVaultUnread(id),
          openTarget: { type: "archive", archiveId: row.archive_id, product: "glyph" },
        });
      }
    }
  } catch {
    /* archive list optional */
  }

  pruneDocVaultUnread(items.map((i) => i.id));

  items.sort((a, b) => {
    const si = DOC_VAULT_SECTION_ORDER.indexOf(a.section);
    const sj = DOC_VAULT_SECTION_ORDER.indexOf(b.section);
    if (si !== sj) return si - sj;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return items;
}

export function groupDocVaultBySection(
  items: DocVaultItem[],
): Record<DocVaultSection, DocVaultItem[]> {
  const groups: Record<DocVaultSection, DocVaultItem[]> = {
    foundation: [],
    pivot: [],
    atmos: [],
    match: [],
    syncro: [],
    glyph: [],
  };
  for (const item of items) {
    groups[item.section].push(item);
  }
  return groups;
}

export function countDocVaultBySection(
  items: DocVaultItem[],
): Record<DocVaultSection, number> {
  const groups = groupDocVaultBySection(items);
  return {
    foundation: groups.foundation.length,
    pivot: groups.pivot.length,
    atmos: groups.atmos.length,
    match: groups.match.length,
    syncro: groups.syncro.length,
    glyph: groups.glyph.length,
  };
}

/** Stable id helpers for callers that mark unread on write. */
export const DocVaultIds = {
  matrix: matrixDocId,
  report: reportDocId,
  delivery: deliveryDocId,
  archive: archiveDocId,
};
