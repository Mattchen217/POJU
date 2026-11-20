from pathlib import Path
p = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''      const asst = lastAssistant(session);
      assert.notEqual(asst.content, stubResponse);
      assert.match(asst.content, /【已冻结】/);

      const dc = session.decision_context!;
      assert.equal(dc.status, "final");''',
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
      assert.match(asst.content, /【已冻结】/);

      const dc = session.decision_context!;
      assert.equal(dc.status, "final");''',
)
p.write_text(text, encoding="utf-8")
print("diag2")
