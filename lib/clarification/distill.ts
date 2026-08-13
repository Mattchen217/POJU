import type { MatchClarificationFields } from "@/lib/clarification/types";

const MIN_RELATIONSHIP_LEN = 10;

/**
 * Distill Match clarification fields (+ optional last user note) into the
 * single `relationship_description` string expected by /api/match/analyze.
 */
export function distillMatchClarification(
  fields: MatchClarificationFields,
  locale: string,
  fallbackUserText = "",
): string {
  const type = fields.relationship_type.trim();
  const focus = fields.concern_focus.trim();
  const matter = fields.concrete_matter.trim();
  const lang = locale.split("-")[0]?.toLowerCase() ?? "en";

  const parts: string[] = [];
  if (lang === "zh") {
    if (type) parts.push(`关系：${type}`);
    if (focus) parts.push(`关切：${focus}`);
    if (matter) parts.push(`共同事项/问题：${matter}`);
  } else {
    if (type) parts.push(`Relationship: ${type}`);
    if (focus) parts.push(`Focus: ${focus}`);
    if (matter) parts.push(`Shared matter: ${matter}`);
  }

  let out = parts.join(lang === "zh" ? "。" : ". ");
  if (lang === "zh" && out && !out.endsWith("。")) out += "。";

  if (out.trim().length < MIN_RELATIONSHIP_LEN) {
    const fb = fallbackUserText.trim();
    if (fb) {
      out = out ? `${out}${lang === "zh" ? "" : " "}${fb}` : fb;
    }
  }

  return out.trim();
}

/** Build gate playback summary from Match fields (no metaphysics). */
export function buildMatchClarificationGateSummary(
  fields: MatchClarificationFields,
  locale: string,
): string {
  const type = fields.relationship_type.trim() || (locale.startsWith("zh") ? "（待补充）" : "(pending)");
  const focus = fields.concern_focus.trim() || (locale.startsWith("zh") ? "（待补充）" : "(pending)");
  const matter = fields.concrete_matter.trim() || (locale.startsWith("zh") ? "（待补充）" : "(pending)");
  const lang = locale.split("-")[0]?.toLowerCase() ?? "en";

  if (lang === "zh") {
    return [
      "我先把你目前说清的情况完整复述一遍，请你核对是否准确：",
      "",
      `Match A 与 Match B 的关系是：${type}。你最想弄清的是：${focus}。共同事项 / 各自情况是：${matter}。`,
      "",
      "确认后，我会基于 Match A 与 Match B 的个性化数据做协同与决策契合度分析。",
      "若以上理解准确，请点击下方 **[确认并继续]**；若要补充或修正，请点 **[补充并修正]**。",
    ].join("\n");
  }

  return [
    "Let me play back what I understand so far — please check whether this is accurate:",
    "",
    `Match A and Match B — relationship: ${type}. What you most want to understand: ${focus}. Shared matter / what each brings: ${matter}.`,
    "",
    "After you confirm, I'll run a collaboration and decision-fit analysis using Match A and Match B's profiles.",
    "If this looks right, tap **[Confirm and continue]** below. To add or correct, tap **[Add and revise]**.",
  ].join("\n");
}
