from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\pending-intake-control.ts")
text = p.read_text(encoding="utf-8")

old_q = '''function questionTextForItem(
  item: IntakeControlItem,
  originalTarget: string | null,
): string {
  if (item.kind === "goal_change") {
    const proposed = (item.proposed_decision_target ?? item.text).trim();
    const current = originalTarget?.trim() || "（当前目标未单独记录）";
    return [
      "你提出将决策目标改为以下内容：",
      "",
      `「${proposed}」`,
      "",
      `当前决策目标仍是：「${current}」`,
      "",
      "是否确认更换当前决策目标？只有明确确认后才会进入受控的 Blueprint 更新路径；在此之前不会自动修改 Blueprint 或已确认的决策定义。",
      "",
      "1. 确认更换决策目标",
      "2. 保持原来的决策目标",
    ].join("\\n");
  }
'''
new_q = '''export function hasResolvedProposedDecisionTarget(
  item: IntakeControlItem,
): boolean {
  return Boolean(item.proposed_decision_target?.trim());
}

function questionTextForItem(
  item: IntakeControlItem,
  originalTarget: string | null,
): string {
  if (item.kind === "goal_change") {
    const current = originalTarget?.trim() || "（当前目标未单独记录）";
    if (!hasResolvedProposedDecisionTarget(item)) {
      return [
        "你提出要更换决策目标，但还没有给出可核对的新目标原文。",
        "",
        `当前决策目标仍是：「${current}」`,
        "",
        "请直接重述你建议的新决策目标，使用你自己的原话，不要用转述或推断。",
        "",
        "在明确新目标之前，系统不会询问是否确认更换，也不会自动修改 Blueprint 或已确认的决策定义。",
      ].join("\\n");
    }
    const proposed = item.proposed_decision_target!.trim();
    return [
      "你提出将决策目标改为以下内容：",
      "",
      `「${proposed}」`,
      "",
      `当前决策目标仍是：「${current}」`,
      "",
      "是否确认更换当前决策目标？只有明确确认后才会进入受控的 Blueprint 更新路径；在此之前不会自动修改 Blueprint 或已确认的决策定义。",
      "",
      "1. 确认更换决策目标",
      "2. 保持原来的决策目标",
    ].join("\\n");
  }
'''
assert old_q in text, "questionTextForItem goal_change block not found"
text = text.replace(old_q, new_q, 1)

old_plan_id = '''function planIdForItem(control: PendingIntakeControl, item: IntakeControlItem): string {
  return `qp_intake_control_${item.kind}_${control.source_turn_id}_${item.item_id}`.slice(
    0,
    120,
  );
}
'''
new_plan_id = '''function planIdForItem(control: PendingIntakeControl, item: IntakeControlItem): string {
  const stage =
    item.kind === "goal_change" && !hasResolvedProposedDecisionTarget(item)
      ? "goal_change_restate"
      : item.kind;
  return `qp_intake_control_${stage}_${control.source_turn_id}_${item.item_id}`.slice(
    0,
    120,
  );
}
'''
assert old_plan_id in text, "planIdForItem not found"
text = text.replace(old_plan_id, new_plan_id, 1)

old_expected = '''    expected_info:
      item.kind === "goal_change"
        ? "请确认是否更换决策目标"
        : "请澄清当前未决项",
'''
new_expected = '''    expected_info:
      item.kind === "goal_change"
        ? hasResolvedProposedDecisionTarget(item)
          ? "请确认是否更换决策目标"
          : "请重述建议的新决策目标"
        : "请澄清当前未决项",
'''
assert old_expected in text, "expected_info block not found"
text = text.replace(old_expected, new_expected, 1)

# also update ask_now_reason to distinguish restatement
old_reason = '''    ask_now_reason: `pending_intake_control_${item.kind}`,
'''
new_reason = '''    ask_now_reason:
      item.kind === "goal_change" && !hasResolvedProposedDecisionTarget(item)
        ? "pending_intake_control_goal_change_restate"
        : `pending_intake_control_${item.kind}`,
'''
assert old_reason in text, "ask_now_reason not found"
text = text.replace(old_reason, new_reason, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("patched pending-intake-control.ts")