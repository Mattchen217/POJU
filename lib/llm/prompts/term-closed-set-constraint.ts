/**
 * Closed-set 命理 terminology constraint — injected into delivery / chat term planes.
 * TERMS-PIPELINE-SPEC-v1:
 * - Body / chat `response` = vernacular only (no traditional jargon).
 * - Evidence only = free traditional closed-set (no markers / no coined soft).
 * - Soft translate = code layer only (autoMark + SSOT).
 */

import {
  CLOSED_LIFE_STAGES,
  CLOSED_SHEN_SHA,
  CLOSED_TEN_GODS,
  OUT_OF_SET_FORBIDDEN_HAN,
} from "@/lib/glossary/term-closed-set";

const SHEN_SHA_LIST = CLOSED_SHEN_SHA.map((s) => (s === "飞刃" ? "飞刃(羊刃)" : s)).join("/");
const SHEN_SHA_COUNT = CLOSED_SHEN_SHA.length;
const TEN_GOD_LIST = CLOSED_TEN_GODS.join("/");
const LIFE_STAGE_LIST = CLOSED_LIFE_STAGES.join("/");
const OUT_OF_SET_SAMPLE = OUT_OF_SET_FORBIDDEN_HAN.slice(0, 8).join("/");

/**
 * Evidence / inventory-facing closed-set (not a body license).
 * Body surfaces still ban traditional jargon via dual-layer + chat binding.
 */
export function buildClosedSetConstraintPromptBlock(_locale: string): string {
  return `# 命理术语闭集约束（硬规则 · 依据层）
1. **实例闭集**：你只能使用【本次提供的命主结构数据 (structured) 里实际出现的】命理术语。structured 未列出的神煞/十神/长生/干支关系/本盘动态关系，一律**不准提及、不准编造**。
2. **词汇闭集**：本引擎**不计算**下列词——若 structured 无对应项，**绝不能出现**：${OUT_OF_SET_SAMPLE}…等集外神煞/术语。
3. **神煞**只可能是这 ${SHEN_SHA_COUNT} 个之一：${SHEN_SHA_LIST}。（旧口径「九个」已废；以本表 + 本盘实例清单为准。）
4. **十神**只可能是这 10 个之一：${TEN_GOD_LIST}。
5. **十二长生**只可能是这 12 个之一：${LIFE_STAGE_LIST}。
6. **依据层 · 自由传统词**：闭集内的【多字/复合】传统真词直接写进「依据与推理」；**禁止** \`⟦t:…⟧\` / \`?t:…\` 或任何打标格式；**禁止**自造软译/品牌黑话。软译由系统代码层处理。
7. **禁止孤立单字命理词**硬塞进散文（如单写「命/煞/刃」等）；用完整多字闭集形，或白话改写。
8. 禁止用「神煞」「十神」「贵人」等**类别统称**代替具体条目；必须点名 structured 里**实际存在**的具体词。
9. **正文 / 白话层零传统命理词**（见双层交付）；本闭集不是给正文开写真词的许可证。`;
}

/** POJU chat phases — hard binding for JSON \`response\` (vernacular body). */
export function buildChatPhaseTermBindingBlock(locale: string): string {
  const isZh = locale.startsWith("zh");
  if (isZh) {
    return `# Pivot 聊天 \`response\` · 术语绑定（硬规则）

- \`response\` 是用户可见**白话正文**：**禁止**传统命理真词、**严禁** \`⟦t:…⟧\` / \`?t:…\` 打标、**严禁**自造软译。
- 需要命理举证时：只用双层结构的「依据与推理」块写闭集【多字/复合】传统真词；软译由后端 autoMark/SSOT 处理。
- **禁止**孤立单字命理词硬塞进 \`response\`。
- 未在 structured 出现的神煞/十神/长生/本盘动态关系**不得**写进 \`response\`。`;
  }
  return `# Pivot chat \`response\` · term binding (hard rules)

- \`response\` is user-visible **vernacular body**: **no** traditional metaphysical jargon, **never** \`⟦t:…⟧\` / \`?t:…\` markers, **never** coined soft labels.
- If evidence is needed: only inside a dual-layer **Evidence & reasoning** block, write closed-set multi-char traditional forms; soft-translate is code-side (autoMark + SSOT).
- **Do not** drop isolated single-character 命理 atoms into prose.
- Do **not** mention shen_sha / ten_god / life_stage / natal relation labels absent from structured.`;
}
