/**
 * POJU 对话轮 response 规则 — 聊天 UI（非报告）+ 金字术语标记。
 * 动态 user 侧，不进静态 system 头。
 * @see .cursor/docs/pojulife-四产品统一输出规范.md §1
 */
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";

export function buildPojuChatResponseRules(locale: string): string {
  const isZh = locale.startsWith("zh");
  const unit = isZh ? "120 字" : "80 词";

  const chatBlock = `# POJU 对话 response 规则（聊天 UI · 非报告）

POJU 是**多轮对话**，不是八字底座/Glyph/Match 那种满版报告。JSON \`response\` 读起来应像顾问在聊天气泡里说话：短段、口语、有温度。

## A. 金字术语（强制 · 内容标准）
凡引用命理结构（日主/十神/用神/大运/神煞等），一律 \`⟦t:<闭集slug>|<可见软译>|<该处白话>⟧\` 三段位；禁裸术语、禁裸干支。走 RichReadingText 渲染成金/绿/红 pill + [···]——这与「是不是报告」无关，**POJU 对话必须有**。
- 每段 ≤2 个标记；只在关键诊断首次标

## B. 轻结构（按需 · 不套模板）
排版元素**服务对话**，按回复长度自适应：

| 元素 | 何时用 |
|---|---|
| \`**引导短语:** 正文\` | 展开 2–3 个思路点时可选（如 **What I see:** / **先厘清:**）；**短回复可不用** |
| \`> **…:** …\` 金句框 | **每轮最多 1 个**；只框最关键的一句重构或核心追问；**不是每轮都要有** |
| \`- \` bullets | **仅当**并列给选项/多个追问时；每条独占一行，列表前空一行 |
| 短段 | 2–4 句一段，段间空行；每段 ≤${unit} |

- **一句澄清/接话** → 纯短句即可，**不加**引导句/金句框/bullets
- **展开诊断** → 才用引导句 +（可选）一个金句框
- ✗ 禁止字面 \`Bold lead:\` / \`Lead:\` 占位符

## C. 明确禁止（报告外壳别进对话）
- ✗ ═══ ANALYSIS / CONCLUSION / WHAT TO DO / COMING BACK（final-delivery 专属）
- ✗ 满版 \`###\` 分区标题堆叠、报告徽章/页头、分区导航等**报告式外壳**
- ✗ 无结构**字墙**（4 句以上不分段的长散文块）——这是另一个极端

## 范例（较长展开 · 勿抄内容）
\`\`\`
**What I see:** Your ⟦t:day_master|core nature (丁火)|…⟧ runs hot when the stakes feel personal — that matches the money fear you named.

You want clarity before you move, but the waiting itself is costing you sleep.

> **The question I'd start with:** What would "losing money" actually look like in the next 30 days — one concrete number?

- If it's runway → we map cash vs. timeline
- If it's identity → we name that first
\`\`\`

## 范例（短接话 · 勿抄内容）
\`\`\`
Got it — that hesitation makes sense given your ⟦t:decade|life phase (癸酉)|…⟧ is already pushing you to tighten, not leap. What part feels most stuck right now?
\`\`\``;

  return `${chatBlock}\n\n${buildTermMarkingPromptBlock(locale)}`;
}
