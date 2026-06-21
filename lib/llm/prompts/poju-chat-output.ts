/**
 * POJU 对话轮 response 规则 — 降维排版 + 术语标记（动态 user 侧，不进静态 system 头）。
 * @see .cursor/docs/pojulife-四产品统一输出规范.md §1、§3
 */
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";

export function buildPojuChatResponseRules(locale: string): string {
  const isZh = locale.startsWith("zh");
  const unit = isZh ? "120 字" : "80 词";

  const layoutBlock = `# 对话轮 response 降维排版（强制 · parseReadingBlocks / RichReadingText 渲染）

这是**多轮对话**，保持口语自然，但**禁止**无结构的整段散文墙。JSON \`response\` 必须用下列语法（与 Glyph/Match 交付同一套渲染链）：

## 1. 粗体引导块（每个独立要点）
格式 \`**真实要旨短语:** 正文\` — 自拟要旨，如 **我看到的核心:** / **眼下的张力:** / **先厘清一件事:**
- ✗ 禁止字面 \`Bold lead:\` / \`Lead:\` 占位符
- 短回复至少 1 个引导块；较长回复每个论点各 1 个

## 2. 短段
- 每段 ≤${unit}，**一个论点一段**，段间空一行（\\n\\n）
- 禁止 4 句以上不分段

## 3. 金句框（每轮至少 1 个）
把本轮最值得记住的一句（关键重构 / 核心追问 / 直接结论）单独框出：
\`> **核心句:** …\` 或 \`> **The move:** …\`（渲染为 pullquote）
- 尖锐追问优先框进金句框
- 每轮 1 个即可，不要堆砌

## 4. 列表
选项 / 多点并列时用 \`- \` bullets，**每条独占一行**；禁止多个 \`- \` 挤在同一段

## 5. 子标题（按长度自适应）
- 短回复：引导块 + 短段 + 金句框即可，**不必**每轮 ### 
- 较长回复（≥3 个独立论点）可用 \`### 小标题\` 分区
- **禁止** ═══ ANALYSIS / CONCLUSION / WHAT TO DO / COMING BACK（final-delivery 专属）

## 6. 术语标记（与排版并存）
- 命理结构一律 \`⟦t:<闭集slug>|<软译>|<语境白话>⟧\`
- **每段 ≤2 个**标记；叙述可以自然，但**不能**因「对话感」退回裸术语或纯散文墙

## 结构范例（英文 · 勿抄内容）
\`\`\`
**What I see in your chart:** Your ⟦t:day_master|core nature (丁火)|…⟧ runs hot when stakes feel personal — that matches what you just said about the money fear.

**The tension right now:** You want clarity before you move, but waiting is costing you sleep.

> **The question I'd start with:** What would "losing money" actually look like in the next 30 days — one concrete number?

- If it's the runway → we map cash vs. timeline
- If it's the identity hit → we name that first
\`\`\``;

  return `${layoutBlock}\n\n${buildTermMarkingPromptBlock(locale)}`;
}
