/**
 * Aggregate IndexedDB artifacts into a right-rail document vault index.
 * Partitioned by auth owner_key (user:<id> | guest:<deviceId>).
 */

import { listArchive } from "@/lib/archive/archive-service";
import { ensurePojuDbReady, getPojuDb } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { sessionListTopicLine } from "@/lib/poju/session-list-label";
import { listStoredProfiles, getStoredProfile } from "@/lib/profile/stored-profiles-service";
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

function formatSubject(
  displayName: string,
  relationship: string,
  locale: string,
): string {
  const name = displayName.trim() || (locale.startsWith("zh") ? "未命名主体" : "Unnamed subject");
  if (!relationship || relationship === "self") return name;
  return `${name} · ${relationship}`;
}

export async function listDocVaultItems(locale = "en"): Promise<DocVaultItem[]> {
  if (typeof window === "undefined") return [];

  const ownerKey = await resolveLocalOwnerKey();
  const zh = locale.startsWith("zh");
  const items: DocVaultItem[] = [];

  // —— Foundation: matrix + base analysis per stored profile ——
  const profiles = await listStoredProfiles();
  for (const summary of profiles) {
    const subject = formatSubject(summary.display_name, summary.relationship, locale);
    const created = summary.created_at;

    // Matrix can always be rebuilt from birth; show if profile exists.
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

    if (summary.has_base_analysis) {
      const rid = reportDocId(summary.profile_id);
      const profile = await getStoredProfile(summary.profile_id);
      const reportAt =
        profile?.base_analysis?.generated_at?.trim() ||
        summary.last_used_at ||
        created;
      items.push({
        id: rid,
        section: "foundation",
        kind: "energy_report",
        title: zh ? "个人能量分析报告" : "Energy analysis report",
        subjectLabel: subject,
        createdAt: reportAt,
        unread: isDocVaultUnread(rid),
        openTarget: { type: "profile_report", profileId: summary.profile_id },
      });
    }
  }

  // —— Pivot: completed delivery books (index field, no full decrypt) ——
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
    const topic = sessionListTopicLine(row.original_question || "");
    const deliveredAt =
      row.main_delivery_at instanceof Date
        ? row.main_delivery_at.toISOString()
        : row.last_interaction_at instanceof Date
          ? row.last_interaction_at.toISOString()
          : new Date().toISOString();

    // Resolve subject from profile if linked — best-effort from question only if unknown
    let subject = zh ? "Pivot 交付" : "Pivot delivery";
    items.push({
      id,
      section: "pivot",
      kind: "pivot_delivery",
      title: zh ? "破局交付报告" : "Breakthrough delivery",
      subjectLabel: topic ? `${subject} · ${topic}` : subject,
      createdAt: deliveredAt,
      unread: isDocVaultUnread(id),
      openTarget: { type: "pivot_delivery", sessionId: sid },
    });
  }

  // —— Match / Syncro / Glyph via archive vault ——
  try {
    const archives = await listArchive();
    for (const row of archives) {
      if (row.product === "match") {
        const id = archiveDocId(row.archive_id);
        items.push({
          id,
          section: "match",
          kind: "match_report",
          title: row.title || (zh ? "合盘报告" : "Match report"),
          subjectLabel: row.title || (zh ? "Match" : "Match"),
          createdAt: row.created_at,
          unread: isDocVaultUnread(id),
          openTarget: { type: "archive", archiveId: row.archive_id, product: "match" },
        });
      } else if (row.product === "syncro") {
        const id = archiveDocId(row.archive_id);
        items.push({
          id,
          section: "syncro",
          kind: "syncro_task",
          title: row.title || (zh ? "Syncro 任务" : "Syncro task"),
          subjectLabel: row.title || "Syncro",
          createdAt: row.created_at,
          unread: isDocVaultUnread(id),
          openTarget: { type: "archive", archiveId: row.archive_id, product: "syncro" },
        });
      } else if (row.product === "glyph") {
        const id = archiveDocId(row.archive_id);
        items.push({
          id,
          section: "glyph",
          kind: "glyph_reading",
          title: row.title || (zh ? "Glyph 签文" : "Glyph reading"),
          subjectLabel: row.title || "Glyph",
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
