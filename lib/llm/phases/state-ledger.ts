import type { POJUAgentState } from "@/lib/poju/agent-state";

export function buildStateLedger(
  agent: POJUAgentState | null,
  phaseLabel: string,
  primaryTask: string,
  doneCriterion: string,
): string {
  const core = agent?.breakthrough_core ?? null;
  const agenda = agent?.investigation_agenda ?? [];
  const covered = agenda.filter((a) => a.status === "covered").length;
  const f = (b: boolean) => (b ? "✓" : "✗");
  return `
【破局进度·后台状态】（你的内部逻辑，不要照念给用户）
- ① 问题已理解：${f(agent?.current_phase !== "opening" || Boolean(agent?.has_base_analysis))}
- ② 关系结论：${f(Boolean(core?.relationship_conclusion))}   ③ 破局方向：${f((core?.breakthrough_directions?.length ?? 0) > 0)}
- ④ 议程已建：${f(agenda.length > 0)}   ⑤ 议程收集：${covered}/${agenda.length}   ⑥ 已交付：${f(Boolean(agent?.main_delivery_at))}

【你现在在】${phaseLabel}
【本轮首要任务】${primaryTask}
【完成标准（达成即进下一格）】${doneCriterion}`;
}
