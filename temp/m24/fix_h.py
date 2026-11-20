from pathlib import Path
p = Path(r"scripts/test-m1-production-adaptive-question-loop.ts")
t = p.read_text(encoding="utf-8")
# Strengthen Case H: require authorized plan questions on turns 2 and 3
old = '''      const asst2 = lastAssistant(s);
      if (s.adaptive_ask_plan?.question_text) {
        assert.equal(asst2.content, s.adaptive_ask_plan.question_text);
        assert.notEqual(asst2.content, stubResponse);
        assert.ok(s.adaptive_ask_plan.dir_ids.length >= 1);
        assert.ok(s.adaptive_ask_plan.ddr_ids.length >= 1);
      }
      assert.equal(s.agent_v2?.current_phase, "collecting_context");'''
new = '''      const asst2 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan?.question_text, "turn2 must have authorized plan question");
      assert.equal(asst2.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst2.content, stubResponse);
      assert.equal(asst2.content.includes("【系统】"), false);
      assert.ok(s.adaptive_ask_plan!.dir_ids.length >= 1);
      assert.ok(s.adaptive_ask_plan!.ddr_ids.length >= 1);
      assert.equal(s.agent_v2?.current_phase, "collecting_context");'''
if old not in t:
    raise SystemExit('h2 block missing')
t = t.replace(old, new)
old3 = '''      const asst3 = lastAssistant(s);
      if (s.adaptive_ask_plan?.question_text) {
        assert.equal(asst3.content, s.adaptive_ask_plan.question_text);
        assert.notEqual(asst3.content, stubResponse);
        assert.notEqual(asst3.content, q2);
      }'''
new3 = '''      const asst3 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan?.question_text, "turn3 must have authorized plan question");
      assert.equal(asst3.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst3.content, stubResponse);
      assert.equal(asst3.content.includes("【系统】"), false);
      assert.notEqual(asst3.content, q2);'''
if old3 not in t:
    raise SystemExit('h3 block missing')
t = t.replace(old3, new3)
p.write_text(t, encoding='utf-8')
print('strengthened Case H')
