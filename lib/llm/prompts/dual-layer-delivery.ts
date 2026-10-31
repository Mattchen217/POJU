/**
 * Shared dual-layer delivery contract for product surfaces.
 * TERMS-PIPELINE-SPEC-v1: model free traditional in evidence; soft = code only.
 */

export function buildDualLayerDeliveryPromptBlock(locale: string): string {
  const zh = locale.startsWith("zh");
  if (zh) {
    return `# 双层交付结构（强制）

## 每段结构
\`\`\`
## / ### <分区标题>
<白话正文：纯人话、有温度、【零标记、零传统命理词】、不被打断>

**依据与推理:** <≤2 句：2–3 个承重传统真词（自由书写） + 一句机制推导>
\`\`\`

| | 正文 | 依据与推理 |
|---|---|---|
| 职责 | 让人读懂 | 让人信服：这是算出来的 |
| 术语 | **0 个**命理真词 / 标记 | **闭集传统真词**自然写入（≤3 个承重） |
| 默认 | 展开 | UI 折叠（入口：▸ 依据与推理） |

## 写作顺序（不可颠倒）
1) 先从 structured 锁定【2–3 个承重传统真词】
2) 【据此】推出这一段的结论
3) 正文写结论（零标记、零传统命理词）
4) 依据块写：承重传统真词 + 一句推导
【禁止】先写正文再回头补依据。
自检：删掉依据块，这段结论还站得住吗？站得住 = 重写。

## 依据块硬规则
1. ≤2 句、≤3 个承重传统真词
2. 禁数据罗列（逐柱堆叠 = 幻觉高发）
3. 禁犹豫措辞（可能/也许/无法确定）
4. 合规与正文同标准：无裸恐吓红线词
5. 贴题白话连接：引用此人具体元素；换用户还成立 → 重写

## 术语输出（模型侧 · 禁止打标）
- 依据层**直接写闭集传统真词**（多字/复合），像专家自然行文。
- **禁止** \`⟦t:…⟧\` / \`?t:…\` 或任何打标格式。
- **禁止**自造软译/品牌黑话；软译由系统代码层（autoMark + SSOT）处理。
- **禁止**孤立单字命理词硬塞进句子。
- 清单/本盘没有的概念 → 白话讲，不发明术语。
- **正文零传统命理词、零标记**；传统真词只出现在「依据与推理」。`;
  }

  return `# Dual-layer delivery (mandatory)

## Per section
\`\`\`
## / ### <section title>
<body: plain vernacular, warm, ZERO markers / ZERO traditional jargon>

**Evidence & reasoning:** <≤2 sentences: 2–3 load-bearing traditional terms (free prose) + one mechanism line>
\`\`\`

| | Body | Evidence |
|---|---|---|
| Job | Make it clear | Prove it was computed |
| Terms | **0** jargon / markers | Closed-set traditional terms in free prose (≤3) |
| Default | Open | UI folds (▸ Evidence & reasoning) |

## Writing order (do not reverse)
1) Lock 2–3 load-bearing traditional terms from structured
2) Derive the section conclusion from them
3) Write body (zero markers / zero traditional jargon)
4) Write evidence: traditional terms + one derivation line
Never write body first and retrofit evidence.
Self-check: if evidence is deleted, does the conclusion still stand? If yes → rewrite.

## Evidence hard rules
1. ≤2 sentences, ≤3 load-bearing traditional terms
2. No pillar dumps
3. No hedge words (maybe / perhaps / unclear)
4. Same compliance as body
5. Plain connective language must be user-specific

## Term output (model-side · no marking)
- In evidence, write closed-set **traditional** multi-char / compound forms naturally.
- **Never** emit \`⟦t:…⟧\` / \`?t:…\` or any marker shell.
- **Never** invent soft/coined labels — soft-translate is code-side (autoMark + SSOT).
- **No** isolated single-character 命理 atoms in prose.
- Not in the inventory → plain vernacular only.
- **Zero traditional jargon / markers in body**; traditional terms only inside Evidence & reasoning.`;
}
