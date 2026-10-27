/** Cross-product right-rail document vault — index types (Phase A). */

import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type DocVaultSection =
  | "foundation"
  | "pivot"
  | "reminders"
  | "atmos"
  | "match"
  | "syncro"
  | "glyph";

export type DocVaultKind =
  | "energy_matrix"
  | "energy_report"
  | "pivot_delivery"
  | "pivot_reminders"
  | "match_report"
  | "syncro_task"
  | "glyph_reading"
  | "atmos_doc";

export type DocVaultOpenTarget =
  | { type: "profile_matrix"; profileId: string }
  | { type: "profile_report"; profileId: string }
  | { type: "pivot_delivery"; sessionId: string }
  | { type: "pivot_reminders"; sessionId: string }
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
  /** Precomputed during prepare wait — open baseline without a second load spin. */
  matrixPayload?: PojuMatrixPayload | null;
};

export const DOC_VAULT_SECTION_ORDER: DocVaultSection[] = [
  "foundation",
  "pivot",
  "reminders",
  "atmos",
  "match",
  "syncro",
  "glyph",
];

/** Right-rail「历史交付」— three fixed categories only. */
export const DOC_VAULT_DELIVERY_SECTIONS: DocVaultSection[] = [
  "foundation",
  "pivot",
  "reminders",
];

/** Visible rows per category before inner scroll. */
export const DOC_VAULT_SECTION_VISIBLE_ROWS = 5;

export const DOC_VAULT_UPDATED_EVENT = "pojulife:doc-vault-updated";

/** First entry after birth prepare — open baseline portrait as overlay (center stays welcome chat). */
export const BASELINE_AUTO_OPEN_EVENT = "pojulife:baseline-auto-open";

export type BaselineAutoOpenDetail = {
  profileId: string;
  /** When set (after prepare), modal paints immediately — no post-wait reload. */
  matrixPayload?: PojuMatrixPayload | null;
};

export function notifyDocVaultUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOC_VAULT_UPDATED_EVENT));
}

export function requestBaselineAutoOpen(
  profileId: string,
  matrixPayload?: PojuMatrixPayload | null,
): void {
  if (typeof window === "undefined") return;
  const id = profileId.trim();
  if (!id) return;
  window.dispatchEvent(
    new CustomEvent<BaselineAutoOpenDetail>(BASELINE_AUTO_OPEN_EVENT, {
      detail: { profileId: id, matrixPayload: matrixPayload ?? null },
    }),
  );
}

/** Chat confirm / generation start — open decision report popup (center stays chat). */
export const DELIVERY_AUTO_OPEN_EVENT = "pojulife:delivery-auto-open";

export type DeliveryAutoOpenDetail = { sessionId: string };

export function requestDeliveryAutoOpen(sessionId: string): void {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!id) return;
  window.dispatchEvent(
    new CustomEvent<DeliveryAutoOpenDetail>(DELIVERY_AUTO_OPEN_EVENT, {
      detail: { sessionId: id },
    }),
  );
}
