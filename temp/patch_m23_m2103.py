from pathlib import Path

# Tighten stakeholders hint — 房贷 alone is constraint, not multi-party
p = Path(r"lib/poju/decision-intake/blueprint.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''function stakeholdersHint(text: string): boolean {
  return /家里|家人|配偶|伴侣|父母|团队|合伙|同事|老板|孩子|多方|家人还有/i.test(
    text,
  );
}''',
'''function stakeholdersHint(text: string): boolean {
  // Multi-party decision signal — not mere household financial mentions (房贷).
  return /家人一起决定|配偶意见|伴侣不同意|合伙人|联合决策|多方利益相关|团队反对|父母反对/i.test(
    text,
  );
}''',
)
p.write_text(text, encoding="utf-8")

# Add unacceptable answer to M21-02
p2 = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
t2 = p2.read_text(encoding="utf-8")
t2 = t2.replace(
'''      const answers = [
        "目前桌上真实选项是：留任、内部转岗、出去创业做咨询。",
        "现状是大厂稳定工作，月薪足够但成长停滞，房贷按月在还。",
        "硬约束是存款只够撑六个月，孩子学费不能断，父母需要照顾。",
        "风险上最多能接受收入腰斩一年，再差就会回撤。",
        "补充：如果创业，方向是企业咨询，已有两个潜在客户意向。",
        "补充：转岗的机会大概在下个季度评估窗口。",
      ];''',
'''      const answers = [
        "目前桌上真实选项是：留任、内部转岗、出去创业做咨询。",
        "现状是大厂稳定工作，月薪足够但成长停滞，房贷按月在还。",
        "硬约束是存款只够撑六个月，孩子学费不能断，父母需要照顾。",
        "风险上最多能接受收入腰斩一年，再差就会回撤。",
        "不可接受的结果是：家庭现金流断裂、孩子学费中断、或把房子赌进去。",
        "退出条件是：连续六个月入不敷出，或核心客户全丢就立刻停。",
        "目标优先级：先保现金流，再看成长，最后才是名义职位。",
        "补充：如果创业，方向是企业咨询，已有两个潜在客户意向。",
        "补充：转岗的机会大概在下个季度评估窗口。",
        "期望结果是三年内有可逆的独立咨询收入，同时不破坏家庭稳定。",
      ];''',
)
# Remove diag logs and fix assert to 【已冻结】
t2 = t2.replace(
'''      const unknownBefore = session!.decision_context!.dirs
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
      assert.match(asst.content, /【已冻结】/);''',
'''      const out = await handleUserMessage({
        session: session!,
        userMessage: "确认",
        locale: "zh",
      });
      await savePOJUSession(out);
      session = await durable(sid);

      const asst = lastAssistant(session);
      assert.notEqual(asst.content, stubResponse);
      assert.match(asst.content, /【已冻结】/);''',
)
p2.write_text(t2, encoding="utf-8")
print("answers+stakeholders updated")

for f in [r"lib/poju/decision-intake/blueprint.ts", r"scripts/test-m2-1-readiness-confirm-freeze.ts"]:
    pp=Path(f); d=pp.read_bytes()
    if d.startswith(b"\xef\xbb\xbf"):
        pp.write_bytes(d[3:])
