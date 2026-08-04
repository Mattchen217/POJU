/** Cross-product right-rail document vault — index types (Phase A). */

export type DocVaultSection =
  | "foundation"
  | "pivot"
  | "atmos"
  | "match"
  | "syncro"
  | "glyph";

export type DocVaultKind =
  | "energy_matrix"
  | "energy_report"
  | "pivot_delivery"
  | "match_report"
  | "syncro_task"
  | "glyph_reading"
  | "atmos_doc";

export type DocVaultOpenTarget =
  | { type: "profile_matrix"; profileId: string }
  | { type: "profile_report"; profileId: string }
  | { type: "pivot_delivery"; sessionId: string }
  | { type: "archive"; archiveId: string; product: "match" | "syncro" | "glyph" };

export type DocVaultItem = {
  id: string;
  section: DocVaultSection;
  kind: DocVaultKind;
  title: string;
  subjectLabel: string;
  createdAt: string;
  unread: boolean;
  openTarget: DocVaultOpenTarget;
};

export const DOC_VAULT_SECTION_ORDER: DocVaultSection[] = [
  "foundation",
  "pivot",
  "atmos",
  "match",
  "syncro",
  "glyph",
];

export const DOC_VAULT_UPDATED_EVENT = "pojulife:doc-vault-updated";

export function notifyDocVaultUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOC_VAULT_UPDATED_EVENT));
}
