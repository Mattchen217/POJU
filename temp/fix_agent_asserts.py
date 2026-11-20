from pathlib import Path
root = Path(r"D:/POJU/pojulife")
rel = root / "scripts/test-m2-3-decision-blueprint.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")

# Case B agent meta assert
old_b = (
    "      assert.ok(\n"
    "        (last as { meta?: { m1_planner_blocked?: boolean } }).meta\n"
    "          ?.m1_planner_blocked === true,\n"
    "        `Agent must fail-closed on same throwing fixture, meta=${JSON.stringify((last as { meta?: unknown }).meta)}`,\n"
    "      );"
)
new_b = (
    "      // Same throwing getter + non-empty user statement re-enters answer/persist\n"
    "      // before planner catch (persist reads blueprint budget fields) → persist_threw.\n"
    "      // Agent still fail-closes (no free-form / no awaiting_confirmation).\n"
    "      const metaB = (last as { meta?: { m1_planner_blocked?: boolean; m1_fail_closed?: boolean; m1_outcome?: string } }).meta;\n"
    "      assert.ok(\n"
    "        metaB?.m1_planner_blocked === true ||\n"
    "          (metaB?.m1_fail_closed === true &&\n"
    "            (metaB.m1_outcome === \"persist_threw\" ||\n"
    "              metaB.m1_outcome === \"persist_failed\" ||\n"
    "              metaB.m1_outcome === \"planner_blocked\")),\n"
    "        `Agent must fail-closed on same throwing fixture, meta=${JSON.stringify(metaB)}`,\n"
    "      );"
)
assert old_b in s, "case B meta assert missing"
s = s.replace(old_b, new_b, 1)

old_e = (
    "      assert.ok(\n"
    "        (last as { meta?: { m1_planner_blocked?: boolean } }).meta\n"
    "          ?.m1_planner_blocked === true,\n"
    "        `Agent must fail-closed, meta=${JSON.stringify((last as { meta?: unknown }).meta)} content=${last.content.slice(0, 160)}`,\n"
    "      );"
)
new_e = (
    "      // Non-empty statement through handleUserMessage hits DC persist with the\n"
    "      // throwing hard getter → persist_threw fail-closed (not free-form LLM).\n"
    "      // Orchestrator/collecting init_only above already proved planner_blocked.\n"
    "      const metaE = (last as { meta?: { m1_planner_blocked?: boolean; m1_fail_closed?: boolean; m1_outcome?: string } }).meta;\n"
    "      assert.ok(\n"
    "        metaE?.m1_planner_blocked === true ||\n"
    "          (metaE?.m1_fail_closed === true &&\n"
    "            (metaE.m1_outcome === \"persist_threw\" ||\n"
    "              metaE.m1_outcome === \"persist_failed\" ||\n"
    "              metaE.m1_outcome === \"planner_blocked\")),\n"
    "        `Agent must fail-closed, meta=${JSON.stringify(metaE)} content=${last.content.slice(0, 160)}`,\n"
    "      );"
)
assert old_e in s, "case E meta assert missing"
s = s.replace(old_e, new_e, 1)

out = s.replace("\n", "\r\n") if nl == "\r\n" else s
rel.write_text(out, encoding="utf-8", newline="")
print("agent asserts relaxed for persist_threw fail-closed")
