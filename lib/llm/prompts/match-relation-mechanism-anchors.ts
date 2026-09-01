/**
 * Match → Pivot：关系机制锚（不重算合盘、不翻版报告）。
 * 从 Match result_data 抽出短可引用 token，供注入文案 / Synthesis 可选复核。
 */

export type RelationMechanismAnchor = {
  id: string;
  /** 可进 needs_validation / 内部锚引用的短句 */
  token: string;
};

function clip(s: unknown, max = 80): string {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function listStrings(v: unknown, maxItems = 4): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v.slice(0, maxItems)) {
    if (typeof item === "string" && item.trim()) {
      out.push(clip(item, 72));
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const t = clip(o.text ?? o.title ?? o.label ?? o.summary ?? o.point, 72);
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * 从 Match 结果抽出机制锚（确定性、短、可引用）。
 * 禁止把整份合盘章节灌进 Pivot。
 */
export function extractMatchRelationMechanismAnchors(
  data: Record<string, unknown>,
): RelationMechanismAnchor[] {
  const out: RelationMechanismAnchor[] = [];
  const push = (id: string, token: string) => {
    const t = clip(token, 96);
    if (!t) return;
    if (out.some((a) => a.token === t)) return;
    out.push({ id, token: t });
  };

  const synergy = clip(
    data.synergy_type ?? data.compatibility_level ?? data.relationship_description,
    64,
  );
  if (synergy) push("synergy", `合盘协同·${synergy}`);

  const resonance =
    data.resonance_index != null && String(data.resonance_index).trim()
      ? `共振指数·${clip(data.resonance_index, 16)}`
      : "";
  if (resonance) push("resonance", resonance);

  listStrings(data.key_strengths ?? data.strengths, 2).forEach((s, i) => {
    push(`strength_${i}`, `合盘优势·${s}`);
  });
  listStrings(data.key_challenges ?? data.challenges, 2).forEach((s, i) => {
    push(`challenge_${i}`, `合盘张力·${s}`);
  });

  const summary = clip(data.summary, 96);
  if (summary && out.length < 2) push("summary", `合盘摘要·${summary}`);

  return out.slice(0, 6);
}

/** 拼进 Match 注入块 / Synthesis user 侧（可选）。 */
export function formatRelationMechanismAnchorsForPrompt(
  anchors: readonly RelationMechanismAnchor[],
): string {
  if (anchors.length === 0) {
    return "## relation_mechanism_anchors\n（无可用合盘机制锚 — 仍以用户主盘收敛你侧打法）";
  }
  const lines = anchors.map((a) => `- ${a.token}`).join("\n");
  return [
    "## relation_mechanism_anchors（仅机制锚 · 禁止翻版合盘报告）",
    lines,
    "用法：可引用 1–2 条校准「你侧边界/型人适配」；禁止另开合盘专章、禁止无盘断言对方八字。",
  ].join("\n");
}
