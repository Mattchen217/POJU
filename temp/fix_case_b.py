from pathlib import Path
root = Path(r"D:/POJU/pojulife")
rel = root / "scripts/test-m2-3-decision-blueprint.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")

old_agent = (
    "      const agentOut = await handleUserMessage({\n"
    "        session: {\n"
    "          ...turn.session,\n"
    "          // Restore non-throwing budget so Agent path can re-enter without crashing outside catch.\n"
    "          decision_blueprint: {\n"
    "            ...activated.session.decision_blueprint!,\n"
    "            directions: activated.session.decision_blueprint!.directions.map((d) => ({\n"
    "              ...d,\n"
    "              depth_soft_cap: 0,\n"
    "            })),\n"
    "          },\n"
    "          agent_v2: {\n"
    "            ...(turn.session.agent_v2 ?? out1.agent_v2!),\n"
    "            current_phase: \"collecting_context\" as const,\n"
    "          },\n"
    "        },\n"
)
new_agent = (
    "      // FU3: same throwing depth_per_direction fixture through Agent chain\n"
    "      // (runAdaptiveQuestionTurn -> runCollectingDcTurn -> handleUserMessage).\n"
    "      // Getter lives only in-memory; persistence would drop it, so we do not save.\n"
    "      const agentOut = await handleUserMessage({\n"
    "        session: {\n"
    "          ...s,\n"
    "          agent_v2: {\n"
    "            ...(s.agent_v2 ?? out1.agent_v2!),\n"
    "            current_phase: \"collecting_context\" as const,\n"
    "          },\n"
    "        },\n"
)
assert old_agent in s, "old_agent missing"
s = s.replace(old_agent, new_agent, 1)

b_start = s.find('await check("M2.3-R2-FU2 Case B: planner exception')
b_end = s.find('await check("M2.3-R2-FU2 Case C:', b_start)
assert b_start > 0 and b_end > b_start
case_b = s[b_start:b_end]
needle = 'assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");'
assert needle in case_b
agent_part = case_b[case_b.find("const agentOut"):]
if "m1_planner_blocked" not in agent_part:
    inject = needle + (
        "\n      assert.ok(\n"
        "        (last as { meta?: { m1_planner_blocked?: boolean } }).meta\n"
        "          ?.m1_planner_blocked === true,\n"
        "        `Agent must fail-closed on same throwing fixture, meta=${JSON.stringify((last as { meta?: unknown }).meta)}`,\n"
        "      );"
    )
    case_b = case_b.replace(needle, inject, 1)
    s = s[:b_start] + case_b + s[b_end:]

out = s.replace("\n", "\r\n") if nl == "\r\n" else s
rel.write_text(out, encoding="utf-8", newline="")
print("case B strengthened")
