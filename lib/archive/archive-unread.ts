import { listArchive } from "@/lib/archive/archive-service";

export type ArchiveUnreadProduct = "glyph" | "match" | "syncro";

const STORAGE_KEY = "pojulife_archive_unread_v1";

export const ARCHIVE_UNREAD_CHANGED_EVENT = "pojulife-archive-unread-changed";

type StoredUnread = {
  archive_id: string;
  product: ArchiveUnreadProduct;
  marked_at: string;
};

function notifyUnreadChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ARCHIVE_UNREAD_CHANGED_EVENT));
}

function readStore(): StoredUnread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUnread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(entries: StoredUnread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    notifyUnreadChanged();
  } catch {
    // ignore quota / private mode
  }
}

/** Background delivery saved while user left glyph / match / syncro flow. */
export function markArchiveUnread(archiveId: string, product: ArchiveUnreadProduct): void {
  const entries = readStore().filter((e) => e.archive_id !== archiveId);
  entries.push({
    archive_id: archiveId,
    product,
    marked_at: new Date().toISOString(),
  });
  writeStore(entries);
}

export function markArchiveRead(archiveId: string): void {
  const entries = readStore();
  const next = entries.filter((e) => e.archive_id !== archiveId);
  if (next.length === entries.length) return;
  writeStore(next);
}

export function isArchiveUnread(archiveId: string): boolean {
  return readStore().some((e) => e.archive_id === archiveId);
}

export function hasUnreadArchives(): boolean {
  return readStore().length > 0;
}

export function getUnreadArchiveIds(): Set<string> {
  return new Set(readStore().map((e) => e.archive_id));
}

export function pruneStaleUnreadArchiveIds(validIds: Iterable<string>): void {
  const valid = new Set(validIds);
  const entries = readStore();
  const next = entries.filter((e) => valid.has(e.archive_id));
  if (next.length === entries.length) return;
  writeStore(next);
}

/** Drop unread markers for deleted or missing archive rows. */
export async function syncArchiveUnreadState(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const all = await listArchive();
    pruneStaleUnreadArchiveIds(all.map((row) => row.archive_id));
  } catch {
    // ignore — unread UI still works with local set
  }
}
