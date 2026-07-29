import type { POJUAgentState } from "@/lib/poju/agent-state";

export function buildSpineBlock(agent: POJUAgentState | null | undefined): string {
  const core = agent?.breakthrough_core;
  if (!core) return "";
  const xc = core.key_crossroads;
  const er = core.energy_retune_frame;
  const rf = core.rhythm_frame;
  return `## 你的破局脊柱（私有 · 勿原样念给用户）
处境洞察：${core.situation_conclusion}
关键抉择：分岔=${xc.real_fork} · 代价=${xc.path_costs} · 特质=${xc.decision_traits}
  锚：${xc.structural_basis} · 待验证：${xc.needs_validation}
现代行动骨架：
${core.modern_action_frames
  .map(
    (d) =>
      `- ${d.direction}（适配：${d.why_fits} · 锚：${d.structural_basis} · 待验证：${d.needs_validation} · ${d.status ?? "hypothesis"}）`,
  )
  .join("\n")}
能量调频：使力=${er.direction_fit} · 成熟条件=${er.timing_ripeness} · 日常=${er.daily_retune}
  互补=${er.complementary} · 锚：${er.structural_basis} · 待验证：${er.needs_validation} · ${er.status ?? "hypothesis"}
30天节奏：观察=${rf.phase1_observe} · 调整=${rf.phase2_adjust} · 巩固=${rf.phase3_consolidate}
自检信号：${core.self_check_signals.join(" / ")}`;
}
