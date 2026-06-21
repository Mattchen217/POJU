/**
 * POJU 对话轮 response 规则 — 轻排版 + 术语标记（动态 taskBlock / user 侧，不进静态 system 头）。
 * @see .cursor/docs/pojulife-四产品统一输出规范.md §1、§3
 */
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";

export function buildPojuChatResponseRules(locale: string): string {
  const isZh = locale.startsWith("zh");
  const chatIntro = `# 对话轮 response 输出规则（JSON \`response\` 字段 · 轻排版 + 术语标记）

## 对话 vs 主交付
- 这是**多轮对话**，不是满版报告：保持口语自然
- **「少用 bullet / 4-6 段叙述」≠ 可以省略术语标记** — 命理词仍须 ⟦t:…⟧ 形态
- **禁止** ═══ ANALYSIS / CONCLUSION / WHAT TO DO / COMING BACK 块（final-delivery 专属）
- **不要**每轮都写 \`###\` 子标题

## 轻排版
- 允许 \`**粗体引导句:**\` 开启要点；列举时用 \`- \` bullets（每条独占一行）
- 每段 ${isZh ? "≤120 字" : "≤80 词"}，空行分段；每段 ≤2 个金色术语标记

## 术语标记（强制 · 下文详表）
凡引用命理结构，**禁止裸术语、禁止裸干支**；id 用闭集 slug；⟦ 与 ⟧ 必须成对`;

  return `${chatIntro}\n\n${buildTermMarkingPromptBlock(locale)}`;
}
