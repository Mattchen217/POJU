from pathlib import Path
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

def sub(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"NOT FOUND: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"NOT UNIQUE ({text.count(old)}): {label}")
    text = text.replace(old, new, 1)
    print("patched", label)

sub(
    '  const { interpretUserAnswer, answerEventFromModelDraft } = await import(\n    "../lib/poju/decision-intake/answer-interpretation"\n  );',
    '  const { interpretUserAnswer, answerEventFromModelDraft, activeTargets } = await import(\n    "../lib/poju/decision-intake/answer-interpretation"\n  );',
    "import-activeTargets",
)

# Update Case G — replace assertion tail from "A successful no-write turn..." through the check end.
sub(
    '''      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      if (out.adaptive_ask_plan) {
        assert.equal(asst.content, out.adaptive_ask_plan.question_text);
      }
      // A successful no-write turn still plans and sends the next NeedItem question,
      // so last_sent_question.plan_id is expected to advance to that new plan.
      assert.ok(out.adaptive_ask_plan || out.decision_understanding?.need_to_understand.items.length >= 0);
      console.log(
        `[m24r2g] codes=${codeA}|${codeB}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${out.decision_understanding?.budget.session_asked_count ?? askedBefore}; unresolved=${probe.notes.join(",")}; writes=${probe.proposed_writes.length}; next_q=${asst.content}; next_dirs=${(out.adaptive_ask_plan?.dir_ids ?? []).join(",")}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });
''',
    '''      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      if (out.adaptive_ask_plan) {
        assert.equal(asst.content, out.adaptive_ask_plan.question_text);
      }
      // FU2 behavior change: a no-write role-binding failure must keep pending
      // clarification and must NOT jump to the next unrelated NeedItem.
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "Case G must persist pending_answer_resolution");
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        `Case G must ask a role clarification, got=${asst.content.slice(0, 120)}`,
      );
      const sentCodes = out.decision_understanding?.last_sent_question?.fact_role_codes ?? [];
      assert.deepEqual([...sentCodes].sort(), [codeA, codeB].sort(), "clarification must keep the original authorized role codes");
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "Case G must not jump to a different NeedItem DIR set");
      assert.ok(
        (out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"),
        "Case G last_sent must be the clarification plan",
      );
      console.log(
        `[m24r2g] codes=${codeA}|${codeB}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${out.decision_understanding?.budget.session_asked_count ?? askedBefore}; unresolved=${probe.notes.join(",")}; writes=${probe.proposed_writes.length}; next_q=${asst.content}; next_dirs=${(out.adaptive_ask_plan?.dir_ids ?? []).join(",")}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}; pending=${pending?.status}:${pending?.unresolved_items.map((i)=>i.reason).join(",")}`,
      );
    });
''',
    "case-g",
)

# Light Case I comment + pending assertion before console.log
sub(
    '''      // A successful legal write still authorizes a new next question; the
      // actually-sent answer Plan must not absorb the forged role code.
      assert.equal((lastCodes).includes(forged), false);
''',
    '''      // FU2: the illegal item stays pending; the next question is a role
      // clarification and must not absorb the forged role code into the Plan.
      assert.equal((lastCodes).includes(forged), false);
      assert.ok(out.pending_answer_resolution, "Case I must keep the illegal item pending");
''',
    "case-i",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("case G/I updated")
