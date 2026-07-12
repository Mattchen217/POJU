import type { POJUAgentState } from "@/lib/poju/agent-state";

/** Natural-language recap of segment-1 fields (no metaphysics) — fallback if model summary is thin. */
export function buildUnderstandingGateSummaryFromFields(
  agent: POJUAgentState,
  locale: string,
): string {
  const zh = locale.startsWith("zh");
  const d = agent.core_dilemma;
  const dir = agent.desired_direction;
  const event = d?.concrete_event?.trim() || (zh ? "（待补充）" : "(pending)");
  const stakes = d?.stakes?.trim() || (zh ? "（待补充）" : "(pending)");
  const sticking = d?.sticking_point?.trim() || (zh ? "（待补充）" : "(pending)");
  const wants = dir?.wants?.trim() || (zh ? "（待补充）" : "(pending)");
  const priority = dir?.priority?.trim() || (zh ? "（待补充）" : "(pending)");

  if (zh) {
    return [
      "我先把你目前说清的情况完整复述一遍，请你核对是否准确：",
      "",
      `**具体发生了什么：** ${event}`,
      `**你在意、或害怕失去的是：** ${stakes}`,
      `**卡住的地方是：** ${sticking}`,
      "",
      `**你期望解决成：** ${wants}`,
      `**你最想优先往哪走：** ${priority}`,
      "",
      "若以上理解准确，请点击下方「对，就是这样，开始分析」；若要补充或修正，请点「我还想补充一点」。",
      "确认后，我会结合你的个性化数据做深度分析，给出方向与接下来需要聊清的几个点。",
    ].join("\n");
  }

  return [
    "Let me play back what I understand so far — please check whether this is accurate:",
    "",
    `**What happened:** ${event}`,
    `**What you care about or fear losing:** ${stakes}`,
    `**Where you're stuck:** ${sticking}`,
    "",
    `**What you want instead:** ${wants}`,
    `**Your top priority:** ${priority}`,
    "",
    'If this looks right, tap **"Yes — start analysis"** below. To add or correct anything, tap **"I want to add something"**.',
    "After you confirm, I'll run a deeper analysis using your personal chart data and outline directions plus what we should clarify next.",
  ].join("\n");
}

export function understandingGateSupplementAck(locale: string): string {
  return locale.startsWith("zh")
    ? "好的，请直接补充你想调整或补充的部分——我会据此更新理解，再请你确认。"
    : "Sure — tell me what you'd like to add or correct, and I'll update my understanding before we continue.";
}

export function understandingGateConfirmButtonLabel(locale: string): string {
  return locale.startsWith("zh")
    ? "对，就是这样，开始分析"
    : "Yes — that's right, start analysis";
}

export function understandingGateSupplementButtonLabel(locale: string): string {
  return locale.startsWith("zh") ? "我还想补充一点" : "I want to add something";
}

/** Prefer model summary; use field recap if response is too short for a gate turn. */
export function resolveUnderstandingGateSummaryContent(
  agent: POJUAgentState,
  modelResponse: string,
  locale: string,
): string {
  const trimmed = modelResponse.trim();
  if (trimmed.length >= 120) return trimmed;
  return buildUnderstandingGateSummaryFromFields(agent, locale);
}
