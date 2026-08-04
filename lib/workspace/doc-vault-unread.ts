/**
 * Unread markers for right-rail doc vault items (localStorage, per browser).
 * Scoped by item id (already owner-partitioned in IndexedDB).
 */

import type { DocVaultSection } from "@/lib/workspace/doc-vault-types";
import { DOC_VAULT_UPDATED_EVENT } from "@/lib/workspace/doc-vault-types";

const STORAGE_KEY = "pojulife_doc_vault_unread_v1";

export const DOC_VAULT_UNREAD_CHANGED_EVENT = "pojulife:doc-vault-unread-changed";

type StoredUnread = {
  id: string;
  section: DocVaultSection;
  marked_at: string;
};

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOC_VAULT_UNREAD_CHANGED_EVENT));
  window.dispatchEvent(new CustomEvent(DOC_VAULT_UPDATED_EVENT));
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
    notify();
  } catch {
    /* quota / private */
  }
}

export function markDocVaultUnread(id: string, section: DocVaultSection): void {
  const entries = readStore().filter((e) => e.id !== id);
  entries.push({ id, section, marked_at: new Date().toISOString() });
  writeStore(entries);
}

export function markDocVaultRead(id: string): void {
  const entries = readStore();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  writeStore(next);
}

export function isDocVaultUnread(id: string): boolean {
  return readStore().some((e) => e.id === id);
}

export function getDocVaultUnreadIds(): Set<string> {
  return new Set(readStore().map((e) => e.id));
}

export function countDocVaultUnreadBySection(): Record<DocVaultSection, number> {
  const counts: Record<DocVaultSection, number> = {
    foundation: 0,
    pivot: 0,
    atmos: 0,
    match: 0,
    syncro: 0,
    glyph: 0,
  };
  for (const e of readStore()) {
    if (e.section in counts) counts[e.section] += 1;
  }
  return counts;
}

export function pruneDocVaultUnread(validIds: Iterable<string>): void {
  const valid = new Set(validIds);
  const entries = readStore();
  const next = entries.filter((e) => valid.has(e.id));
  if (next.length === entries.length) return;
  writeStore(next);
}
