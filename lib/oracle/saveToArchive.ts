import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SignData, UserInput, FullReading } from "@/types/oracle";

export interface OracleArchiveEntry {
  id: string;
  sign: SignData;
  user_input: UserInput;
  full_reading: FullReading;
  drawn_at: number;
}

interface OracleDBSchema extends DBSchema {
  oracle_entries: {
    key: string;
    value: OracleArchiveEntry;
    indexes: { "by-date": number };
  };
}

const DB_NAME = "poju_oracle";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OracleDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<OracleDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OracleDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("oracle_entries", { keyPath: "id" });
        store.createIndex("by-date", "drawn_at");
      },
    });
  }
  return dbPromise;
}

export async function saveOracleEntry({
  sign,
  userInput,
  fullReading,
}: {
  sign: SignData;
  userInput: UserInput;
  fullReading: FullReading;
}): Promise<string> {
  const db = await getDB();

  const entry: OracleArchiveEntry = {
    id: safeRandomUUID(),
    sign,
    user_input: userInput,
    full_reading: fullReading,
    drawn_at: Date.now(),
  };

  await db.put("oracle_entries", entry);
  return entry.id;
}

export async function getOracleArchiveEntryById(
  id: string,
): Promise<OracleArchiveEntry | undefined> {
  const db = await getDB();
  return db.get("oracle_entries", id);
}

export async function getAllOracleEntries(): Promise<OracleArchiveEntry[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex("oracle_entries", "by-date");
  return entries.reverse();
}

export async function getRecentEntries(
  hoursAgo: number,
): Promise<OracleArchiveEntry[]> {
  const db = await getDB();
  const cutoff = Date.now() - hoursAgo * 3600 * 1000;

  const tx = db.transaction("oracle_entries", "readonly");
  const index = tx.store.index("by-date");
  const range = IDBKeyRange.lowerBound(cutoff);

  const entries: OracleArchiveEntry[] = [];
  let cursor = await index.openCursor(range);
  while (cursor) {
    entries.push(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
  return entries;
}
