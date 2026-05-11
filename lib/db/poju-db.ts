import Dexie, { type EntityTable } from "dexie";
import type { EncryptedPayload } from "@/lib/crypto";

export type EncryptedRecord = {
  id: string;
  payload: EncryptedPayload;
  createdAt: number;
  updatedAt: number;
};

export type UsageRecord = {
  id: string;
  dayKey: string;
  product: "glyph" | "syncro_ar" | "poju";
  count: number;
  updatedAt: number;
};

export class PojuDb extends Dexie {
  userProfiles!: EntityTable<EncryptedRecord, "id">;
  glyphHistory!: EntityTable<EncryptedRecord, "id">;
  syncroCache!: EntityTable<EncryptedRecord, "id">;
  pojuSessions!: EntityTable<EncryptedRecord, "id">;
  usage!: EntityTable<UsageRecord, "id">;

  constructor() {
    super("pojulife_v4");
    this.version(1).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
    });
  }
}

let singleton: PojuDb | null = null;

export function getPojuDb(): PojuDb {
  if (!singleton) singleton = new PojuDb();
  return singleton;
}
