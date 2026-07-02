/**
 * Closed-set 命理 terminology constraint — injected into all four product delivery prompts.
 * Vocabulary closed-set + instance closed-set (only terms present in structured profile data).
 */

import {
  CLOSED_LIFE_STAGES,
  CLOSED_SHEN_SHA,
  CLOSED_TEN_GODS,
  OUT_OF_SET_FORBIDDEN_HAN,
} from "@/lib/glossary/term-closed-set";

const SHEN_SHA_LIST = CLOSED_SHEN_SHA.map((s) => (s === "飞刃" ? "飞刃(羊刃)" : s)).join("/");
const TEN_GOD_LIST = CLOSED_TEN_GODS.join("/");
const LIFE_STAGE_LIST = CLOSED_LIFE_STAGES.join("/");
const OUT_OF_SET_SAMPLE = OUT_OF_SET_FORBIDDEN_HAN.slice(0, 8).join("/");

export function buildClosedSetConstraintPromptBlock(_locale: string): string {
  return `# 命理术语闭集约束（硬规则）

1. **实例闭集**：你只能使用【本次提供的命主结构数据 (structured) 里实际出现的】命理术语。structured 未列出的神煞/十神/长生/干支关系/本盘动态关系，一律**不准提及、不准编造**。
2. **词汇闭集**：本引擎**不计算**下列词——若 structured 无对应项，**绝不能出现**：${OUT_OF_SET_SAMPLE}… 等集外神煞/术语。
3. **神煞**只可能是这 9 个之一：${SHEN_SHA_LIST}。
4. **十神**只可能是这 10 个之一：${TEN_GOD_LIST}。
5. **十二长生**只可能是这 12 个之一：${LIFE_STAGE_LIST}。
6. 每个用到的术语必须用 \`⟦t:<id>|<可见软译>|<该处白话>⟧\` 三段位标记；\`id\` 取自术语表（如 \`fei_ren\`、\`qi_sha\`），禁止自造 id。
7. 禁止用「神煞」「十神」「贵人」等**类别统称**代替具体条目；必须点名 structured 里**实际存在**的具体词。`;
}

/** POJU chat phases — hard binding for JSON \`response\` field (no example-word hacks). */
export function buildChatPhaseTermBindingBlock(locale: string): string {
  const isZh = locale.startsWith("zh");
  if (isZh) {
    return `# POJU 聊天 \`response\` · 术语绑定（硬规则）

- 凡命理术语**必须**来自上方术语表 + 本次 structured 实例闭集；**禁止**闭集外自造词。
- **必须**用 \`⟦t:<slug>|<可见软译>|<该处白话>⟧\` 三段位包裹；**严禁**裸写术语、裸括号干支、裸「神煞/十神/贵人」等统称。
- 标记只包软译词（含括号干支），不要把整句 your/你/的 包进去。
- 未在 structured 出现的神煞/十神/长生/本盘动态关系**不得**写进 \`response\`。`;
  }
  return `# POJU chat \`response\` · term binding (hard rules)

- Every metaphysical term **must** come from the closed-set table + structured instance inventory above — **no** out-of-set inventions.
- **Must** wrap each term as \`⟦t:<slug>|<visible soft label>|<context plain>⟧\` (3 segments). **Never** bare terms, bare stem-branch pairs, or category labels ("ten god", "shen sha", "noble star").
- Markers wrap only the soft label (with stem-branch in parens if required) — not whole clauses with "your/the/as".
- Do **not** mention shen_sha / ten_god / life_stage / natal relation labels absent from structured.`;
}
