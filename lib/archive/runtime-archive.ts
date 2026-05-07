import type { ArchiveEntry } from "@/lib/archive/types";

/** Same key as chat / syncro / stage-1 — single local “vault” list for the Archive page. */
export const ARCHIVE_RUNTIME_KEY = "pojulife_archive_runtime_v1";

export const ARCHIVE_UPDATED_EVENT = "pojulife-archive-updated";

/**
 * Prepends one row and notifies the Archive preview (same tab) to reload.
 */
export function appendRuntimeArchiveEntry(row: ArchiveEntry): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
    const list = raw ? (JSON.parse(raw) as ArchiveEntry[]) : [];
    localStorage.setItem(ARCHIVE_RUNTIME_KEY, JSON.stringify([row, ...list].slice(0, 120)));
    window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
  } catch {
    // ignore quota / private mode
  }
}
