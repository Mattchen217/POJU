import Dexie, { type Table } from "dexie";

export type OracleSignRecord = {
  id: string;
  createdAt: number;
  question: string;
  signNo: number;
  levelName: string;
  levelSubtitle: string;
  // 修改这一行：使用 ReadonlyArray<string> 或者 readonly string[]
  readonly verseLines: readonly string[]; 
  whatItMeans: string;
  forToday: string;
};

class OracleDb extends Dexie {
  oracleSigns!: Table<OracleSignRecord, string>;

  constructor() {
    super("poju_oracle_v1");
    this.version(1).stores({
      oracleSigns: "id,createdAt,levelName",
    });
  }
}

const db = new OracleDb();

function canUseDb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export async function saveOracleSign(record: OracleSignRecord): Promise<void> {
  if (!canUseDb()) return;
  await db.oracleSigns.put(record);
}

export async function getLatestOracleSign(): Promise<OracleSignRecord | null> {
  if (!canUseDb()) return null;
  const row = await db.oracleSigns.orderBy("createdAt").last();
  return row ?? null;
}

export async function getOracleSignById(id: string): Promise<OracleSignRecord | null> {
  if (!canUseDb()) return null;
  const row = await db.oracleSigns.get(id);
  return row ?? null;
}

