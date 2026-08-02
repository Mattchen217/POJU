import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";
import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/**
 * Mark-step mode (legacy):
 * - combined: one connective call (zh). Foreign translation is a separate pass (P2).
 * - split: kept for env compatibility; same as combined for connective-only mark.
 */
export type DeliveryMarkMode = "combined" | "split";

export type MarkEvidenceContext = {
  /** User's original question / dilemma — drives situational connective prose. */
  original_question?: string | null;
};

export type MarkEvidenceArgInput = {
  /** Narrative argument body (for situational gloss). */
  body: string;
  /** Already code-marked evidence (`⟦t:slug|⟧`) — mark only rewrites connective. */
  evidence: string;
};

export function resolveDeliveryMarkMode(
  env: Record<string, string | undefined> = process.env,
): DeliveryMarkMode {
  return env.DELIVERY_MARK_MODE?.trim() === "split" ? "split" : "combined";
}

function questionBlock(ctx: MarkEvidenceContext | undefined, zh: boolean): string {
  const q = ctx?.original_question?.trim();
  if (!q) {
    return zh
      ? "（用户问题未注入 — 仍须按本条论点正文写贴题串联，勿抄词典定义。）"
      : "(No user question injected — still write situational connective from the argument body.)";
  }
  return zh ? `「${q}」` : `"${q}"`;
}

/** Extra jargon often left in connective even after marking. */
const MARK_PLAIN_EXTRA_BAN_ZH = [
  "食神",
  "伤官",
  "七杀",
  "偏官",
  "正官",
  "正印",
  "偏印",
  "枭神",
  "正财",
  "偏财",
  "比肩",
  "劫财",
  "比劫",
  "印星",
  "官星",
  "财星",
  "杀星",
  "才星",
  "生扶",
  "泄身",
  "泄秀",
  "吐秀",
  "化杀",
  "制食",
  "生身",
  "克身",
  "攻身",
  "克泄",
  "当令",
  "失令",
  "透干",
  "无强根",
  "通根",
  "双透",
  "合化",
  "乙庚",
  "贵人",
  "才华星",
  "压力星",
  "支持星",
] as const;

function buildMarkPlainBanListZh(): string {
  const fromSsot = [...BANNED_TERMS_ZH].filter((w) => w.length >= 2);
  const merged = [...new Set([...fromSsot, ...MARK_PLAIN_EXTRA_BAN_ZH])].sort(
    (a, b) => b.length - a.length,
  );
  return merged.join(" / ");
}

const MARK_PLAIN_BAN_LIST_ZH = buildMarkPlainBanListZh();

/**
 * P2 mark: connective-only. Code already marked `⟦t:slug|⟧`.
 * No slug picking, no situational tooltip slots, no translation.
 */
export function buildMarkEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  _locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  const q = questionBlock(ctx, true);
  const system = `# 你是谁
你能在心里读懂八字体系,但用户【永远不该听到这些词】。
上游已用代码打好金字标记 \`⟦t:<slug>|⟧\`(软译/tooltip 由系统填)。
你的**唯一任务**:把金字之间的连接内容,用啰嗦通顺、扣住本段+用户问题的大白话重写成"不点开也能读懂的因果故事"。

# 你收到什么
每条包含:
- body:论点正文(只给你理解方向;**禁止抄进输出**);
- evidence:已打标的依据(你只改连接白话,【保留全部 \`⟦t:…⟧\` 原样】);
- 用户的问题(下面给出)。

# 你要做的(只这一件事)
1. 读懂证据里金字之间的因果;
2. 重写连接白话:谁在消耗你、谁在压你、缺了什么补给、因此现在会有什么感受/节奏;
3. **保留每一个 \`⟦t:<slug>|…⟧\` 标记原样**(不要增删改 slug,不要填第三段情景槽)。

# 绝对禁止
- 打标 / 猜 slug / 写 \`⟦w:\` / 填 \`⟦t:slug||情景⟧\` 第三段;
- 翻译成外语(本步只出中文);
- 碰真算结构(不删承重因果);
- 复述或改写 body 正文/周计划/行动清单;
- 串联白话里出现下列任一命理原词/干支字面:
  ${MARK_PLAIN_BAN_LIST_ZH}
- 半文言连接:旺而/受制/见官之象/克泄交加/生扶无力…

# 自检
遮住所有金字,光读串联白话——普通美国高中生能懂吗?有禁词吗?抄了 body 吗?
不过关就重写连接白话。

# 输出 JSON(严格)
\`{ "arguments": [ { "evidence": "串联后的依据" }, ... ] }\`
- 长度/顺序与输入该段一致;只填 evidence;
- 输入 evidence 为空 → 输出同位置也必须是空字符串。

# 用户的问题
${q}
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `只做情景串联(保留全部 ⟦t:…⟧;零命理词;勿抄 body)。输出 {"arguments":[{"evidence":"..."},...]}。\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** @deprecated P2: translation is a separate per-segment pass — kept for split-mode callers. */
export function buildTranslateEvidencePrompt(
  segments: Record<string, { arguments: Array<{ evidence: string }> }>,
  locale: string,
): { system: string; user: string } {
  const system = `# 你是谁
你把已打标依据里的【串联白话】译成地道 ${locale}。
【铁律】每个 \`⟦t:<slug>|…⟧\` 原样保留(含 slug);只译标记外的连接文字。禁止发明新标记。禁止中文命理原词残留。

# 输出 JSON
\`{ "arguments": [ { "evidence": "…" }, ... ] }\` 长度与输入一致。
`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `Translate connective prose only into ${locale}; keep all ⟦t:…⟧ intact.\n\`\`\`json\n${payload}\n\`\`\``;
  return { system, user };
}

/** Alias — connective-only mark is language-agnostic (always zh connective). */
export function buildMarkOnlyEvidencePrompt(
  segments: Record<string, { arguments: MarkEvidenceArgInput[] }>,
  locale: string,
  ctx?: MarkEvidenceContext,
): { system: string; user: string } {
  return buildMarkEvidencePrompt(segments, locale, ctx);
}

/**
 * Pack argument tree for the mark step (body + evidence).
 * Never substitutes body for missing evidence.
 */
export function pickMarkEvidenceInput(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: MarkEvidenceArgInput[] }> {
  const out: Record<string, { arguments: MarkEvidenceArgInput[] }> = {};
  for (const k of paths) {
    const args = tree[k] ?? [];
    if (args.length === 0) continue;
    out[k] = {
      arguments: args.map((a) => ({
        body: (a.body ?? "").trim(),
        evidence: (a.evidence ?? "").trim(),
      })),
    };
  }
  return out;
}

/** Evidence-only payload for translate pass. */
export function pickMarkEvidenceOnly(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: Array<{ evidence: string }> }> {
  const out: Record<string, { arguments: Array<{ evidence: string }> }> = {};
  for (const k of paths) {
    const args = tree[k] ?? [];
    if (args.length === 0) continue;
    out[k] = {
      arguments: args.map((a) => ({
        evidence: (a.evidence ?? "").trim(),
      })),
    };
  }
  return out;
}
