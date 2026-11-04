const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");

// Fix import to also get syncSessionCyclesToDbWithDb
s = s.replace(
  '  const { __setCycleIndexWriteHookForTests } = await import("../lib/poju/cycle-db-sync");',
  '  const {\n    syncSessionCyclesToDbWithDb,\n    __setCycleIndexWriteHookForTests,\n  } = await import("../lib/poju/cycle-db-sync");',
);

// Replace the failing mutate call to pass cycleSync from same module
const oldFailMutate = `    try {
      await mutatePOJUSession(sid, {
        operation_id: "op_71_mid_txn_fail",
        kind: "session_patch",
        bump_dc: false,
        apply: (latest) => ({
          ...latest,
          original_question: "71-should-rollback",
          last_interaction_at: "2026-11-03T12:08:00.000Z",
          active_cycle_id: "cyc_71_new",
          cycles: [
            {
              cycle_id: "cyc_71_new",
              cycle_index: 2,
              original_question: "71-should-rollback",
              question_category: "unknown",
              current_summary: null,
              started_at: "2026-11-03T12:08:00.000Z",
              tool_suggestions: [],
              is_delivered: false,
              is_active: true,
            },
          ],
        }),
      });
    } catch (err) {`;

const newFailMutate = `    try {
      await mutatePOJUSession(
        sid,
        {
          operation_id: "op_71_mid_txn_fail",
          kind: "session_patch",
          bump_dc: false,
          apply: (latest) => ({
            ...latest,
            original_question: "71-should-rollback",
            last_interaction_at: "2026-11-03T12:08:00.000Z",
            active_cycle_id: "cyc_71_new",
            cycles: [
              {
                cycle_id: "cyc_71_new",
                cycle_index: 2,
                original_question: "71-should-rollback",
                question_category: "unknown",
                current_summary: null,
                started_at: "2026-11-03T12:08:00.000Z",
                tool_suggestions: [],
                is_delivered: false,
                is_active: true,
              },
            ],
          }),
        },
        {
          // Same module instance as the hook (avoid dual @/ vs relative copies).
          cycleSync: syncSessionCyclesToDbWithDb,
        },
      );
    } catch (err) {`;

if (!s.includes(oldFailMutate)) {
  console.error("fail mutate block not found");
  process.exit(1);
}
s = s.replace(oldFailMutate, newFailMutate);
fs.writeFileSync(p, s);
console.log("P3-71 cycleSync wire OK");
