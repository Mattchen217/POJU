from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")
old = '''      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0 && pending0.unresolved_items.length === 2, "FU3-B must keep both same-text items");
'''
new = '''      const pending0 = s.pending_answer_resolution;
      const probeB = answerEventFromModelDraft({
        session: before,
        statement: shared,
        source_turn_id: "probe_fu3b",
        draft,
      });
      assert.ok(
        pending0 && pending0.unresolved_items.length === 2,
        `FU3-B must keep both same-text items, pending=${pending0 ? pending0.unresolved_items.map((i)=>i.item_id+":"+i.reason+":"+i.text).join("|") : "null"}; facts=${s.decision_context!.reality_facts.length}; version=${s.decision_context!.version}; codes=${codeA}|${codeB}; last=${JSON.stringify(before.decision_understanding?.last_sent_question?.fact_role_codes)}; probe_unresolved=${probeB.unresolved_items.length}; probe_writes=${probeB.proposed_writes.length}; notes=${probeB.notes.join(",")}; asst=${lastAssistant(s).content.slice(0,180)}`,
      );
'''
assert old in text
text = text.replace(old, new)
p.write_text(text, encoding="utf-8", newline="\n")
print("diagnostic assertion patched")
