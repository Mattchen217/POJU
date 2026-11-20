from pathlib import Path
p = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
text = p.read_text(encoding="utf-8")
old = '''      const out = await handleUserMessage({
        session: session!,
        userMessage: "确认",
        locale: "zh",
      });
      await savePOJUSession(out);
      session = await durable(sid);

      const asst = lastAssistant(session);
      assert.notEqual(asst.content, stubResponse);
      assert.match(asst.content, /已冻结|冻结/);'''
new = '''      const unknownBefore = session!.decision_context!.dirs
        .filter((d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false)
        .map((d) => `${d.dir_id}:${d.current_state}:partial=${d.partial_satisfaction}`);
      console.log("    M21-03 pre-confirm critical dirs:", unknownBefore.join(" | "));
      console.log("    M21-03 readiness:", session!.decision_understanding?.readiness);
      console.log("    M21-03 facts:", session!.decision_context!.reality_facts.length);

      const out = await handleUserMessage({
        session: session!,
        userMessage: "确认",
        locale: "zh",
      });
      await savePOJUSession(out);
      session = await durable(sid);

      const asst = lastAssistant(session);
      console.log("    M21-03 assistant:", asst.content.slice(0, 200));
      console.log(
        "    M21-03 post dirs:",
        session.decision_context!.dirs
          .filter((d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false)
          .map((d) => `${d.dir_id}:${d.current_state}`)
          .join(" | "),
      );
      assert.notEqual(asst.content, stubResponse);
      assert.match(asst.content, /【已冻结】/);'''
if old not in text:
    raise SystemExit('block not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('diag inserted')
