/**
 * Shared dual-layer delivery + marker contract for all six product surfaces.
 * Inject into prompts; UI enforces SSOT soft labels at render.
 */

export function buildDualLayerDeliveryPromptBlock(locale: string): string {
  const zh = locale.startsWith("zh");
  if (zh) {
    return `# 双层交付结构（强制）

## 每段结构
\`\`\`
## / ### <分区标题>
<白话正文：纯人话、有温度、【零标记】、不被打断>

**依据与推理:** <≤2 句：2–3 个金字锚点 + 一句机制推导>
\`\`\`

| | 正文 | 依据与推理 |
|---|---|---|
| 职责 | 让人读懂 | 让人信服：这是算出来的 |
| 标记 | **0 个** | **金字集中于此**（≤3 个） |
| 默认 | 展开 | UI 折叠（入口：▸ 依据与推理） |

## 写作顺序（不可颠倒）
1) 先从 structured 锁定【2–3 个承重锚点】
2) 【据此】推出这一段的结论
3) 正文写结论（零标记）
4) 依据块写：锚点（打标）+ 一句推导
【禁止】先写正文再回头补依据。
自检：删掉依据块，这段结论还站得住吗？站得住 = 重写。

## 依据块硬规则
1. ≤2 句、≤3 个金字
2. 禁数据罗列（逐柱堆叠 = 幻觉高发）
3. 禁犹豫措辞（可能/也许/无法确定）
4. 合规与正文同标准：无裸干支 / 日主 / 身弱 /「命」字族 / 刑冲合害原词
5. 贴题白话：引用此人具体元素；换用户还成立 → 重写

## 打标格式（软译词你不用写）
\`⟦t:<slug>|<贴题白话>⟧\` 或 \`⟦t:<slug>||<贴题白话>⟧\`
- 第 2 格软译词【不需要你写】——系统从术语表填入官方术语；你写了也会被覆盖。
- 你只需：① 从注入清单选对 slug；② 写【只对这个人成立】的贴题白话。
- 清单没有的概念 → 不打标，直接白话讲。
- **正文零标记**；标记只出现在「依据与推理」块。`;
  }

  return `# Dual-layer delivery (mandatory)

## Per section
\`\`\`
## / ### <section title>
<body: plain vernacular, warm, ZERO markers>

**Evidence & reasoning:** <≤2 sentences: 2–3 gold anchors + one mechanism line>
\`\`\`

| | Body | Evidence |
|---|---|---|
| Job | Make it clear | Prove it was computed |
| Markers | **0** | Gold terms only (≤3) |
| Default | Open | UI folds (▸ Evidence & reasoning) |

## Writing order (do not reverse)
1) Lock 2–3 load-bearing anchors from structured
2) Derive the section conclusion from them
3) Write body (zero markers)
4) Write evidence: anchors (marked) + one derivation line
Never write body first and retrofit evidence.
Self-check: if evidence is deleted, does the conclusion still stand? If yes → rewrite.

## Evidence hard rules
1. ≤2 sentences, ≤3 gold terms
2. No pillar dumps
3. No hedge words (maybe / perhaps / unclear)
4. Same compliance as body
5. Plain must be user-specific

## Marker format (you do NOT write soft labels)
\`⟦t:<slug>|<contextual plain>⟧\` or \`⟦t:<slug>||<contextual plain>⟧\`
- Soft label is filled from the glossary SSOT; anything you put in that slot is overwritten.
- Your job: pick the right slug + write contextual plain that only fits THIS user.
- Not in the list → no marker, plain vernacular only.
- **Zero markers in body**; markers only inside Evidence & reasoning.`;
}
