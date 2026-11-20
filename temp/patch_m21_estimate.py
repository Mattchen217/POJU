from pathlib import Path
p = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''        "补充：转岗的机会大概在下个季度评估窗口。",''',
'''        "补充：转岗评估窗口在下个季度，这是公司排期写明的。",''',
)
# Remove diag
text = text.replace(
'''      const asst = lastAssistant(session);
      assert.notEqual(asst.content, stubResponse);
      if (!/【已冻结】/.test(asst.content)) {
        const blockers = session.decision_context!.dirs
          .filter((d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false && d.current_state === "unknown")
          .map((d) => `${d.dir_id}:partial=${d.partial_satisfaction}:roles=${(d.required_fact_roles||[]).join("+")}`);
        console.error("    M21-03 freeze blocked. assistant:", asst.content.slice(0, 240));
        console.error("    unknown critical:", blockers.join(" | "));
        const facts = session.decision_context!.reality_facts.map((f) => `${f.status}/${f.verification_level}/roles=${(f.fact_roles||[]).join("+")}/dirs=${(f.related_dir_ids||[]).join(",")}`);
        console.error("    facts:", facts.join(" || "));
      }
      assert.match(asst.content, /【已冻结】/);''',
'''      const asst = lastAssistant(session);
      assert.notEqual(asst.content, stubResponse);
      assert.match(asst.content, /【已冻结】/);''',
)
# Also fix filler to avoid estimate words and be assertive
text = text.replace(
'''          `继续补充第${guard + 1}点：我会按事实回答当前问题，尽量具体可核验。`;''',
'''          `继续补充第${guard + 1}点：按当前问题，我的明确事实是——会给出可核验的具体说明，不含估计。`;''',
)
p.write_text(text, encoding="utf-8")
print("estimate wording removed")
