/**
 * Local IndexedDB partition key — isolates chat/profiles/archive per auth account
 * on the same browser (device_id alone is shared across logins).
 */

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { ensurePojuDbReady } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";

export const LOCAL_OWNER_CHANGED_EVENT = "pojulife:local-owner-changed";

const MIGRATION_FLAG = "pojulife_owner_key_migrated_v1";

export function guestOwnerKey(deviceId = getPojuDeviceId()): string {
  return `guest:${deviceId}`;
}

export function userOwnerKey(userId: string): string {
  return `user:${userId.trim()}`;
}

/** Sync guest key when auth is unavailable (SSR / misconfigured). */
export function getLocalOwnerKeySync(): string {
  return guestOwnerKey();
}

/**
 * Current partition owner: logged-in Supabase user, else guest:${deviceId}.
 */
export async function getLocalOwnerKey(): Promise<string> {
  if (typeof window === "undefined") return guestOwnerKey("device_local");
  if (!isSupabaseConfigured()) return guestOwnerKey();
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id?.trim();
    if (id) return userOwnerKey(id);
  } catch {
    /* env / network */
  }
  return guestOwnerKey();
}

export function isRowOwnedBy(
  row: { owner_key?: string } | null | undefined,
  ownerKey: string,
): boolean {
  if (!row) return false;
  const key = row.owner_key?.trim();
  if (!key) return false;
  return key === ownerKey;
}

function notifyOwnerChanged(ownerKey: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LOCAL_OWNER_CHANGED_EVENT, { detail: { ownerKey } }),
  );
}

/**
 * Subscribe to auth-driven owner changes. Fires immediately with current key.
 * Returns unsubscribe.
 */
export function subscribeLocalOwnerKey(
  cb: (ownerKey: string) => void,
): () => void {
  if (typeof window === "undefined") {
    cb(guestOwnerKey("device_local"));
    return () => undefined;
  }

  let cancelled = false;
  let lastKey = "";

  const emit = (key: string) => {
    if (cancelled || key === lastKey) return;
    lastKey = key;
    cb(key);
    notifyOwnerChanged(key);
  };

  void getLocalOwnerKey().then((key) => {
    if (!cancelled) emit(key);
  });

  if (!isSupabaseConfigured()) {
    return () => {
      cancelled = true;
    };
  }

  let unsubscribeAuth: (() => void) | undefined;
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id?.trim();
      emit(id ? userOwnerKey(id) : guestOwnerKey());
    });
    unsubscribeAuth = () => data.subscription.unsubscribe();
  } catch {
    /* ignore */
  }

  return () => {
    cancelled = true;
    unsubscribeAuth?.();
  };
}

type StampableTable =
  | "pojuSessionRecords"
  | "pojuSessionArchive"
  | "stored_profiles"
  | "archive"
  | "device_usage"
  | "syncro_sessions"
  | "match_sessions"
  | "poju_cycles"
  | "poju_tool_suggestions";

async function stampTableOwnerKey(
  tableName: StampableTable,
  ownerKey: string,
): Promise<void> {
  const db = await ensurePojuDbReady();
  const table = db.table(tableName);
  const rows = await table.toArray();
  for (const row of rows) {
    const r = row as { owner_key?: string };
    if (r.owner_key?.trim()) continue;
    const keyPath = table.schema.primKey.keyPath;
    const id =
      typeof keyPath === "string"
        ? (row as Record<string, unknown>)[keyPath]
        : undefined;
    if (id == null) continue;
    await table.update(id as string | number, { owner_key: ownerKey });
  }
}

/**
 * One-shot: claim legacy rows (missing owner_key) for the current owner.
 * First opener after upgrade wins — shared-PC edge case accepted per plan.
 */
export async function ensureLocalOwnerMigration(): Promise<string> {
  const ownerKey = await getLocalOwnerKey();
  if (typeof window === "undefined") return ownerKey;

  try {
    if (localStorage.getItem(MIGRATION_FLAG) === "1") {
      return ownerKey;
    }
  } catch {
    /* private mode */
  }

  const tables: StampableTable[] = [
    "pojuSessionRecords",
    "pojuSessionArchive",
    "stored_profiles",
    "archive",
    "device_usage",
    "syncro_sessions",
    "match_sessions",
    "poju_cycles",
    "poju_tool_suggestions",
  ];

  for (const name of tables) {
    try {
      await stampTableOwnerKey(name, ownerKey);
    } catch (e) {
      console.warn(`[local-owner] migrate ${name} failed:`, e);
    }
  }

  // device_usage primary key was device__product — rewrite to owner__product when unscoped
  try {
    const db = await ensurePojuDbReady();
    const usages = await db.device_usage.toArray();
    for (const row of usages) {
      if (row.owner_key && row.owner_key !== ownerKey) continue;
      const expectedId = `${ownerKey}__${row.product}`;
      if (row.id === expectedId && row.owner_key === ownerKey) continue;
      if (!row.owner_key?.trim() || row.id !== expectedId) {
        await db.device_usage.delete(row.id);
        await db.device_usage.put({
          ...row,
          id: expectedId,
          owner_key: ownerKey,
        });
      }
    }
  } catch (e) {
    console.warn("[local-owner] device_usage rewrite failed:", e);
  }

  try {
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    /* ignore */
  }

  return ownerKey;
}

/** Ensure migration ran, return current owner key. */
export async function resolveLocalOwnerKey(): Promise<string> {
  return ensureLocalOwnerMigration();
}
