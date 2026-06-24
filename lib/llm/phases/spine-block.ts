import type { POJUAgentState } from "@/lib/poju/agent-state";

export function buildSpineBlock(agent: POJUAgentState | null | undefined): string {
  const core = agent?.breakthrough_core;
  if (!core) return "";
  return `## 你的破局脊柱（私有 · 勿原样念给用户）
关系结论：${core.relationship_conclusion}
破局方向：
${core.breakthrough_directions
  .map(
    (d) =>
      `- ${d.direction}（锚：${d.structural_basis}${d.timing ? ` · 节律：${d.timing}` : ""} · 待验证：${d.what_would_confirm} · ${d.status ?? "hypothesis"}）`,
  )
  .join("\n")}`;
}
