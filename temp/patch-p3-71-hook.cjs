const fs = require("fs");
const p = "lib/poju/cycle-db-sync.ts";
let s = fs.readFileSync(p, "utf8");

if (s.includes("__setCycleIndexWriteHookForTests")) {
  console.log("hook already present");
  process.exit(0);
}

const insertAfterImports = `import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";

/** Test-only phases after real related-table writes inside the C1 Dexie txn. */
export type CycleIndexWriteHookPhase = "after_clear" | "after_cycles_put";
type CycleIndexWriteHook = (
  phase: CycleIndexWriteHookPhase,
) => void | Promise<void>;
let cycleIndexWriteHookForTests: CycleIndexWriteHook | null = null;

/**
 * Test-only: run after real poju_cycles / poju_tool_suggestions writes so mid-txn
 * failures can prove Dexie abort (P3-71). Production never sets this.
 */
export function __setCycleIndexWriteHookForTests(
  hook: CycleIndexWriteHook | null,
): void {
  cycleIndexWriteHookForTests = hook;
}
`;

if (!s.includes('import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";')) {
  console.error("import marker missing");
  process.exit(1);
}
s = s.replace(
  'import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";\n',
  insertAfterImports,
);

const clearBlock = `  await db.poju_cycles.where("session_id").equals(sessionId).delete();
  await db.poju_tool_suggestions.where("session_id").equals(sessionId).delete();

  if (!cycles.length) return;`;

const clearBlockNew = `  await db.poju_cycles.where("session_id").equals(sessionId).delete();
  await db.poju_tool_suggestions.where("session_id").equals(sessionId).delete();

  if (cycleIndexWriteHookForTests) {
    await cycleIndexWriteHookForTests("after_clear");
  }

  if (!cycles.length) return;`;

if (!s.includes(clearBlock)) {
  console.error("clear block not found");
  process.exit(1);
}
s = s.replace(clearBlock, clearBlockNew);

const putBlock = `  await db.poju_cycles.bulkPut(rows);

  const suggestionRows = cycles.flatMap((c) =>`;

const putBlockNew = `  await db.poju_cycles.bulkPut(rows);

  if (cycleIndexWriteHookForTests) {
    await cycleIndexWriteHookForTests("after_cycles_put");
  }

  const suggestionRows = cycles.flatMap((c) =>`;

if (!s.includes(putBlock)) {
  console.error("put block not found");
  process.exit(1);
}
s = s.replace(putBlock, putBlockNew);

fs.writeFileSync(p, s);
console.log("patched cycle-db-sync.ts OK");
