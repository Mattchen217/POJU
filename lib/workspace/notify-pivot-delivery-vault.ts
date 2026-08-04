import { DocVaultIds } from "@/lib/workspace/doc-vault-index";
import { markDocVaultUnread } from "@/lib/workspace/doc-vault-unread";
import { notifyDocVaultUpdated } from "@/lib/workspace/doc-vault-types";

/** Call after a Pivot delivery is persisted so the right-rail vault shows it as unread. */
export function notifyPivotDeliveryVaultItem(sessionId: string): void {
  const id = sessionId.trim();
  if (!id) return;
  markDocVaultUnread(DocVaultIds.delivery(id), "pivot");
  notifyDocVaultUpdated();
}
