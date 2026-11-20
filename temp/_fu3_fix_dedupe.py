from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts")
text = p.read_text(encoding="utf-8")
old = '''    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    const key = `${semantic_kind}:${normalizeComparable(text)}`;
    if (items.some((existing) => `${existing.semantic_kind}:${normalizeComparable(existing.text)}` === key)) {
      continue;
    }
    if (items.length >= MAX_EXTRACTED_ITEMS) continue;
'''
new = '''    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    // Same text can be two distinct extracted items (different item_id / role).
    // Do not use text alone as identity or drop the second item.
    if (items.length >= MAX_EXTRACTED_ITEMS) continue;
'''
assert old in text, "dedupe block not found"
text = text.replace(old, new)

# If normalizeComparable becomes unused, check later
p.write_text(text, encoding="utf-8", newline="\n")
print("removed text-only extracted_items dedupe")

# restore clean FU3-B assertion
tp = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
t = tp.read_text(encoding="utf-8")
old_a = '''      const pending0 = s.pending_answer_resolution;
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
new_a = '''      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0 && pending0.unresolved_items.length === 2, "FU3-B must keep both same-text items");
'''
assert old_a in t, "diag assertion not found"
t = t.replace(old_a, new_a)
tp.write_text(t, encoding="utf-8", newline="\n")
print("FU3-B assertion restored")
