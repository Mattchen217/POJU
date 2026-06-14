import {
  markArchiveRead,
  markArchiveUnread,
  type ArchiveUnreadProduct,
} from "@/lib/archive/archive-unread";

const PENDING_KEY = "pojulife_archive_pending_delivery_v1";

/** After this, user did not land on the in-app delivery page → treat as unread. */
const PENDING_STALE_MS = 4000;

export type PendingDeliveryArchive = {
  archive_id: string;
  product: ArchiveUnreadProduct;
  session_id: string;
  created_at: string;
};

function readPending(): PendingDeliveryArchive[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingDeliveryArchive[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(entries: PendingDeliveryArchive[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

/** Saved to archive; waiting for forced in-app delivery redirect. */
export function registerPendingDeliveryArchive(entry: PendingDeliveryArchive): void {
  const next = readPending().filter((row) => row.session_id !== entry.session_id);
  next.push(entry);
  writePending(next);
}

/** User opened the product delivery page — counts as read. */
export function acknowledgeDeliveryViewed(sessionId: string): void {
  const pending = readPending();
  const hit = pending.find((row) => row.session_id === sessionId);
  if (hit) {
    markArchiveRead(hit.archive_id);
  }
  writePending(pending.filter((row) => row.session_id !== sessionId));
}

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?=\/)/i, "");
}

function isDeliveryPath(pathname: string, entry: PendingDeliveryArchive): boolean {
  const path = stripLocalePrefix(pathname);
  if (entry.product === "match") {
    return path.startsWith(`/match/result/${entry.session_id}`);
  }
  if (entry.product === "syncro") {
    return path.startsWith(`/syncro/result/${entry.session_id}`);
  }
  return false;
}

/**
 * Match / Syncro: if delivery redirect never happened (tab closed), mark archive unread.
 * If user is on the delivery route, mark read instead.
 */
export function reconcilePendingDeliveryArchives(pathname: string): void {
  const pending = readPending();
  if (pending.length === 0) return;

  const now = Date.now();
  const keep: PendingDeliveryArchive[] = [];

  for (const entry of pending) {
    if (isDeliveryPath(pathname, entry)) {
      markArchiveRead(entry.archive_id);
      continue;
    }

    const ageMs = now - new Date(entry.created_at).getTime();
    if (ageMs >= PENDING_STALE_MS) {
      markArchiveUnread(entry.archive_id, entry.product);
      continue;
    }

    keep.push(entry);
  }

  writePending(keep);
}
