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

1. **实例闭集**：你只能使用【本次提供的命主结构数据 (structured) 里实际出现的】命理术语。structured 未列出的神煞/十神/长生/干支关系，一律**不准提及、不准编造**。
2. **词汇闭集**：本引擎**不计算**下列词——若 structured 无对应项，**绝不能出现**：${OUT_OF_SET_SAMPLE}… 等集外神煞/术语。
3. **神煞**只可能是这 9 个之一：${SHEN_SHA_LIST}。
4. **十神**只可能是这 10 个之一：${TEN_GOD_LIST}。
5. **十二长生**只可能是这 12 个之一：${LIFE_STAGE_LIST}。
6. 每个用到的术语必须用 \`⟦t:<id>|<可见软译>|<该处白话>⟧\` 三段位标记；\`id\` 取自术语表（如 \`fei_ren\`、\`qi_sha\`），禁止自造 id。
7. 禁止用「神煞」「十神」「贵人」等**类别统称**代替具体条目；必须点名 structured 里**实际存在**的具体词。`;
}
