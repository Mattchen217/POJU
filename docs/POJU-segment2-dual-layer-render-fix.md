# POJU 第2段收尾 · 双层呈现焊死（正文零金字 / 依据金字集中）

> **一件事**：让「正文 = 纯白话零金字」「金字 + 白话解释 = 全部进依据与推理」**由代码保证**，而不是靠提示词自觉。
>
> **动手前**：`git clone https://github.com/Mattchen217/POJU` 拉最新 main。下面所有行号基于本次拉取的 main。
>
> **本文不做**（留给后续单独的文档）：第3段议程收集改造、第4段 ReportStructured/PDF 重做、术语四表合一。

---

## 零、病根（先看这段，否则会改错地方）

**提示词是对的，模型也基本守规了 —— 是渲染层把模型写的白话改成了金字。**

`lib/llm/deepseek/breakthrough-core.ts:89` 已明写「direction / relationship_conclusion：纯白话、【零标记】」；
`lib/llm/prompts/dual-layer-delivery.ts:45` 已明写「正文零标记；标记只出现在「依据与推理」块」。

但 `components/cross-product/GlossaryText.tsx:333-334` 的 `MarkedInline` 对**任何**文本无差别调用
`prepareTextForGlossaryRender` → 内含 `autoMarkBareTerms`（`term-marking.ts:475`）。**渲染层不知道自己在画正文还是依据。**

### 证据链 A —「均势[···]」的来路（可复现）

```
term-closed-set.ts:108      CLOSED_STRUCTURAL 里躺着「平衡」
  → term-closed-set.ts:131  CLOSED_SET_REPLACE_IDS
  → term-marking.ts:350     BARE_AUTO_MARK_HAN
  → term-closed-set.ts:254  CLOSED_SET_SLUG["平衡"] = "balanced_self"
  → pojulife-terms.ts:150   balanced_self.term.zh = "均势"
```

模型写「需要重新调整**平衡**」→ 渲染层输出「需要重新调整**均势[···]**」。

**铁证**：依据里那句「需要`锚元[···]`来**均势**`耗元[···]`」——「平衡」是动词，被换成名词「均势」，句子不通。
这不是模型能写出来的句子，是正则替换的产物。「平衡」是 `CLOSED_STRUCTURAL` 里**唯一**的日常汉语词。

### 证据链 B —「当前当前时空效能」+ 第2/第4段同词不同脸

```
banned-terms.ts:58                     流年 → "当前时空效能"（纯字符串替换）
  → compliance-terms.ts:611-640        ZH_STRUCTURE_SOFT_REPLACE
  → compliance-terms.ts:706-708        replaceZhTokenGlobal（在 sanitizePaymentAuditLeaks 里）
  ⇒ 模型写「当前流年」 → 「当前当前时空效能」
```

`collapseChainedSoftReplaceArtifacts`（`term-marking.ts:955`）只折叠「软译+软译」相邻，**不管「用户原词 + 自带限定语的软译」**，所以双字病活了下来。

而双字病还有**连带伤害**：`wrapBareKeepCnSoftTerms`（`term-marking.ts:316-338`）本来会把「当前时空效能」重新包成 `⟦t:year|…⟧` → 渲染成金字「岁环[···]」；但它的正则带汉字 lookbehind `(?<![\u4e00-\u9fff])`，被前面多出来的「当」「前」挡住 → **本该是金字「岁环[···]」的依据，退化成裸露的 SaaS 词。**

> 这就是你测试里第2段显示「当前当前时空效能」、第4段显示「岁环[···]」的**唯一原因**——不是两个 bug，是一个。

### 修法（架构级，一次堵一片）

1. **给渲染层加「层」的概念**：`body` / `evidence` / `legacy`。body 层永不镀金；evidence 层放开密度。
2. **合规网不撤，只换出口**：body 层的裸词仍然拦，但**替换成白话**（`sanitizeNonMarkerSegment`），**不是替换成金字**。
3. **数据层同步焊死**：第2段的字段本来就分了层（`relationship_conclusion`/`direction` = 正文；`structural_basis`/`timing` = 依据），在 sanitize 时就把正文里的标记剥掉 + **响亮告警**。
4. `legacy` = 完全等于改动前的行为 → **Glyph / Match / 底座零回归**（它们还没接双层制）。

---

## 一、改动清单

| # | 文件 | 位置 | 一句话 |
|---|---|---|---|
| P1.1 | `lib/llm/sanitize/term-marking.ts` | 346-357 | 「平衡」移出 auto-mark 扫描集 |
| P1.2 | 同上 | 308 后 | 新增 `degradeMarkersToPlain`（标记→贴题白话） |
| P1.3 | 同上 | 955-977 | 新增 `collapseDuplicatedSoftPrefix` 并接进 collapse 链 |
| P1.4 | 同上 | 698 前 | 新增 `export type MarkLayer` |
| P2.1 | `lib/llm/sanitize/compliance-terms.ts` | 28-64 / 81-110 | 转出口补 `degradeMarkersToPlain` + `MarkLayer` |
| P2.2 | 同上 | 799 后 | 新增 `prepareBodyTextForGlossaryRender`（正文层准备） |
| P3.1 | `components/cross-product/GlossaryText.tsx` | 6-15 | import |
| P3.2 | 同上 | 245-246 | 新增 `MAX_PAREN_MARKS_EVIDENCE = 3` |
| P3.3 | 同上 | 321-361 | `MarkedInline` 加 `layer` |
| P4 | `components/cross-product/RichReadingText.tsx` | 22-29 / 31-68 / 123-272 | 加 `dualLayer`，依据块走 evidence 层 + 独立 dedupe |
| P5 | `components/poju/PojuChat.tsx` | 133-142 | `renderAiContent` 打开 `dualLayer` |
| P6.1 | `lib/llm/deepseek/breakthrough-core.ts` | 638-640 | 新增 `scrubBodyField`（剥标记 + 告警） |
| P6.2 | 同上 | 645-688 | `sanitizeBreakthroughCoreMapped` 按层分流 |
| P6.3 | 同上 | 780-797 | `first_question` 走正文层 |
| P6.4 | 同上 | 141-142 | 删掉「first_question 可打标」的许可 |
| P7 | `scripts/test-poju-segment2-dual-layer.ts` | 新建 | 冒烟验收 |
| P8 | `package.json` | scripts | 挂 `test:poju-dual-layer` |

---

## 二、Patch

### P1.1 · `lib/llm/sanitize/term-marking.ts:346-357` — 「平衡」不再自动镀金

**Before**
```ts
/**
 * UI 兜底扫描集：合规高危 + 闭集全量 + 天干五行合称 + 神煞 i18n 全表（含孤鸾煞等）。
 * 按长度降序，避免短词先吃掉长词。
 */
const BARE_AUTO_MARK_HAN = [
  ...new Set([
    ...HIGH_RISK_COMPLIANCE_HAN,
    ...CLOSED_SET_REPLACE_IDS,
    ...STEM_ELEMENT_COMPOUNDS,
    ...allShenshaHanSurfaces(),
  ]),
].sort((a, b) => b.length - a.length);
```

**After**
```ts
/**
 * 与闭集表面撞名的【日常汉语词】—— 永不自动补标。
 * 「平衡」是 CLOSED_STRUCTURAL 里唯一的日常词，且常作动词：自动补标会把模型写的白话
 * 「需要重新调整平衡」改写成金字「…调整均势[···]」，甚至把动词换成名词（"来均势耗元"）。
 * 显式 ⟦t:balanced_self|…⟧ 仍正常渲染 —— 这里只关掉"猜"，不动闭集。
 */
const AUTO_MARK_EXCLUDE_HAN: ReadonlySet<string> = new Set(["平衡"]);

/**
 * UI 兜底扫描集：合规高危 + 闭集全量 + 天干五行合称 + 神煞 i18n 全表（含孤鸾煞等）。
 * 按长度降序，避免短词先吃掉长词。
 */
const BARE_AUTO_MARK_HAN = [
  ...new Set([
    ...HIGH_RISK_COMPLIANCE_HAN,
    ...CLOSED_SET_REPLACE_IDS,
    ...STEM_ELEMENT_COMPOUNDS,
    ...allShenshaHanSurfaces(),
  ]),
]
  .filter((han) => !AUTO_MARK_EXCLUDE_HAN.has(han))
  .sort((a, b) => b.length - a.length);
```

> **为什么不直接从 `CLOSED_STRUCTURAL` 删「平衡」**：查过了，`CLOSED_SET_REPLACE_IDS` 还被
> `lib/glossary/term-glossary.ts:51` 的 `CLOSED_HAN_ID_SET` 消费。这里只关 auto-mark，血溅面最小。

---

### P1.2 · `lib/llm/sanitize/term-marking.ts:308` 之后（`stripMarkersForPrompt` 下方）— 新增正文层降级器

`stripMarkersForPrompt` 返回的是 **SSOT 软译（金字）**，正文层不能用它。新增：

```ts
/**
 * 正文层降级：⟦t:id|贴题白话⟧ / ⟦t:id|软译|贴题白话⟧ → **只留贴题白话**（无软译、无金字、无 [···]）。
 * 与 stripMarkersForPrompt 的区别：那个留金字给 prompt/history，这个留白话给用户正文。
 * 模型没写贴题白话时退到软译，并留痕 —— 静默兜底 = 失败永远看不见。
 */
export function degradeMarkersToPlain(text: string, locale = "en"): string {
  if (!text?.includes("⟦t:")) return text ?? "";
  TERM_MARKER_PATTERN.lastIndex = 0;
  return text.replace(TERM_MARKER_PATTERN, (raw, rawId: string, slot2: string, slot3?: string) => {
    const id = normalizeTermMarkerId(rawId);
    const isThreeSlot = (raw.match(/\|/g) || []).length >= 2;
    const contextual = unescapeMarkerPart(isThreeSlot ? (slot3 ?? "") : slot2).trim();
    if (contextual) return contextual;
    console.warn("[term-marking] body marker has no contextual plain — fell back to soft label", { id });
    return termOf(id, locale) || id;
  });
}
```

---

### P1.3 · `lib/llm/sanitize/term-marking.ts:955-977` — 折叠重复限定语

**Before**（片段末尾）
```ts
  result = result.replace(
    /(?:你的能量结构|稳定支持力|有利特质|当前阶段气候|当前时空效能)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥金木水火土]/g,
    MINGLI_STACK_SOFT_PHRASE,
  );
  return result;
}
```

**After**（在 `collapseChainedSoftReplaceArtifacts` **上方**加函数，并在其末尾调用）
```ts
/**
 * 软译词自带限定语 → 用户原句的限定语变重复：「当前流年」→「当前当前时空效能」。
 * 这一步不修，双字病还会顶掉 wrapBareKeepCnSoftTerms 的汉字 lookbehind，
 * 让本该变成金字「岁环[···]」的依据退化成裸露的 SaaS 词（第2段实测症状）。
 */
const DUP_SOFT_PREFIX_ZH = ["当前", "你的", "这个", "目前"] as const;

export function collapseDuplicatedSoftPrefix(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const p of DUP_SOFT_PREFIX_ZH) {
    out = out.replace(new RegExp(`${p}(?=${p})`, "g"), "");
  }
  return out;
}

/** Collapse abutting soft-replace glosses left by older token-chain sanitize / auto-mark. */
export function collapseChainedSoftReplaceArtifacts(text: string): string {
  // …（中间不动）…
  result = result.replace(
    /(?:你的能量结构|稳定支持力|有利特质|当前阶段气候|当前时空效能)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥金木水火土]/g,
    MINGLI_STACK_SOFT_PHRASE,
  );
  result = collapseDuplicatedSoftPrefix(result);
  return result;
}
```

> 接进 `collapseChainedSoftReplaceArtifacts` 而不是各处单独调 —— 它已经被
> `compliance-terms.ts:711`（第2段 scrub 路径）和 `term-marking.ts:479/488`（autoMark 路径）调用，一处修改两条链受益。
> 标记区安全：`当前⟦t:year|…` 的 lookahead 匹配不到 `当前当前`。

---

### P1.4 · `lib/llm/sanitize/term-marking.ts:698` 之前 — 层类型

```ts
/**
 * 双层交付的渲染层身份：
 * - body     正文层 —— 零金字。标记降级成贴题白话；裸词走「替换成白话」的合规网。
 * - evidence 依据层 —— 金字集中、默认折叠、允许"不好读"，密度上限放宽到 ≤3。
 * - legacy   未接双层制的老界面（Glyph / Match / 底座）—— 行为与改动前 100% 一致。
 */
export type MarkLayer = "body" | "evidence" | "legacy";
```

`prepareTextForGlossaryRender`（698-705）**不动** —— 它继续服务 evidence / legacy。

---

### P2.1 · `lib/llm/sanitize/compliance-terms.ts` — 转出口

- 在 **import 块**（28-64）里，`degradeMarkersToPlain,` 插在 `detectBrokenMarkers,` 之后；`type MarkLayer,` 插在 `type TermEntry,` 附近。
- 在 **export 块**（81-110）里，`degradeMarkersToPlain,` 和 `prepareBodyTextForGlossaryRender,` 与 `type MarkLayer,` 加在 `prepareTextForGlossaryRender,` 旁边。

---

### P2.2 · `lib/llm/sanitize/compliance-terms.ts:799` 之后 — 正文层准备

放在 `sanitizeDeliveryBodyPart` 下面（它需要模块私有的 `sanitizeNonMarkerSegment`，**必须写在这个文件**，写进 term-marking 会成环）：

```ts
/**
 * 正文层渲染准备（双层制）：零金字。
 * 1) id 归一（拦自造 slug）
 * 2) 标记 → 贴题白话（不镀金、不加 [···]）
 * 3) 裸命理词仍然拦 —— 但**替换成白话**，不是替换成金字（合规网不撤，只换出口）
 * 正文里出现标记 = 模型违反「正文零标记」，必须响亮，不许静默降级。
 */
export function prepareBodyTextForGlossaryRender(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const normalized = normalizeTermMarkerIds(text, locale);
  if (normalized.includes("⟦t:")) {
    console.warn(
      "[glossary] BODY MARKER LEAK — 正文层出现标记，已降级为白话。金字只该进「依据与推理」。",
      { sample: normalized.match(/⟦t:[^⟧]+⟧/g)?.slice(0, 3) },
    );
  }
  return sanitizeNonMarkerSegment(degradeMarkersToPlain(normalized, locale), locale);
}
```

> **合规安全性说明（必读）**：`sanitizeChatResponse`（`compliance-terms.ts:852-856`）**只审计不改写**，
> 所以 opening / collecting / tracking 的聊天回复目前**唯一**的裸词网就是 UI 的 `autoMarkBareTerms`。
> 因此正文层**不能**简单关掉网 —— 上面第 3 步用 `sanitizeNonMarkerSegment` 顶上，裸「大运」→「当前这个阶段」白话。
> 该函数的替换表（`ZH_STRIPE_GLOBAL_REPLACE` 501-507 / `ZH_STRUCTURE_SOFT_REPLACE` 611-640）全是命理/合规高危词，
> 对普通白话是 no-op，不会啃正常句子。

---

### P3.1 · `components/cross-product/GlossaryText.tsx:6-15` — import

```ts
import {
  GLOSS_TOKEN_PATTERN,
  plainByTermId,
  stripBrokenMarkers,
  TERM_MARKER_PATTERN,
  uiTermById,
  unescapeGlossPart,
  unescapeMarkerPart,
  prepareTextForGlossaryRender,
  prepareBodyTextForGlossaryRender,
  type MarkLayer,
} from "@/lib/llm/sanitize/compliance-terms";
```

### P3.2 · `components/cross-product/GlossaryText.tsx:245-246` — 依据层密度

**Before**
```ts
/** Max paren term marks rendered per paragraph (density cap). */
const MAX_PAREN_MARKS_PER_PARAGRAPH = 2;
```

**After**
```ts
/** Max paren term marks rendered per paragraph (density cap). */
const MAX_PAREN_MARKS_PER_PARAGRAPH = 2;
/**
 * 依据层：金字集中、默认折叠、允许"不好读" —— 对齐提示词的「≤3 金字」上限。
 * 用 2 会让第 3 个金字裸奔（有金字、无 [···]、点不开），实测「磨蚀」就是这么掉的。
 */
const MAX_PAREN_MARKS_EVIDENCE = 3;
```

> `MAX_PAREN_MARKS_PER_PARAGRAPH = 2` 这行**原样保留** —— `scripts/test-poju-block99-*.ts:37` 按字符串断言它。

### P3.3 · `components/cross-product/GlossaryText.tsx:321-361` — `MarkedInline` 加层

**Before**
```ts
/** Inline marked text — optional shared dedupeScope for section-level golden-term density. */
export function MarkedInline({
  text,
  locale,
  dedupeScope,
  keyBase = 0,
}: {
  text: string;
  locale: string;
  dedupeScope?: Set<string>;
  keyBase?: number;
}) {
  // Block 62/63 — UI compliance net: autoMarkBareTerms inside prepareTextForGlossaryRender (before parse).
  const prepared = prepareTextForGlossaryRender(text, locale);
```

**After**
```ts
/** Inline marked text — optional shared dedupeScope for section-level golden-term density. */
export function MarkedInline({
  text,
  locale,
  dedupeScope,
  keyBase = 0,
  layer = "legacy",
}: {
  text: string;
  locale: string;
  dedupeScope?: Set<string>;
  keyBase?: number;
  /** 双层制：body=正文零金字 / evidence=金字集中 / legacy=未接双层制的老界面（默认，零回归）。 */
  layer?: MarkLayer;
}) {
  // Block 62/63 — UI compliance net: autoMarkBareTerms inside prepareTextForGlossaryRender (before parse).
  // body 层不走这条 —— 正文零金字，裸词改走「替换成白话」的 prepareBodyTextForGlossaryRender。
  const prepared =
    layer === "body"
      ? prepareBodyTextForGlossaryRender(text, locale)
      : prepareTextForGlossaryRender(text, locale);
  const maxParenMarks =
    layer === "evidence" ? MAX_PAREN_MARKS_EVIDENCE : MAX_PAREN_MARKS_PER_PARAGRAPH;
```

再把 350 行的调用改成：
```ts
      ...parseMarkedText(chunk, locale, kb++, paraSeen, maxParenMarks),
```

> 注意：`prepareTextForGlossaryRender` 这个标识符仍留在文件里（evidence/legacy 分支），
> `scripts/test-poju-block63-acceptance.ts:34-35` 的字符串断言不会挂。

---

### P4 · `components/cross-product/RichReadingText.tsx`

**P4.1 · Props（22-29）**
```ts
type Props = {
  text: string;
  locale: string;
  className?: string;
  variant?: "body" | "poem";
  density?: "default" | "delivery";
  /**
   * 双层制开关。true：正文零金字 + 「依据与推理」块金字集中。
   * false（默认）：完全等于改动前 —— Glyph / Match / 底座不受影响。
   */
  dualLayer?: boolean;
};
```

**P4.2 · `LeadBlock`（31-68）**
```ts
function LeadBlock({
  label,
  body,
  locale,
  dedupeScope,
  blockKey,
  inQuote,
  layer,
}: {
  label: string;
  body: string;
  locale: string;
  dedupeScope: Set<string>;
  blockKey: number;
  inQuote?: boolean;
  layer: MarkLayer;
}) {
  if (!inQuote && isEvidenceLeadLabel(label)) {
    return (
      <EvidenceBlock label={label}>
        {body ? (
          <p className="reading-p">
            {/* 依据块自成一体（折叠、独立阅读）→ 用自己的 dedupe scope，
                别被正文/上一段已出现过的同名词挤成没有 [···] 的裸金字。 */}
            <MarkedInline
              text={body}
              locale={locale}
              dedupeScope={new Set<string>()}
              keyBase={blockKey}
              layer="evidence"
            />
          </p>
        ) : null}
      </EvidenceBlock>
    );
  }

  return (
    <div className={cn("reading-unit", inQuote && "reading-unit--in-quote")}>
      <div className={cn("reading-lead-block", inQuote && "reading-lead-block--pullquote")}>
        <strong className="reading-lead">{label}</strong>
      </div>
      {body ? (
        <p className="reading-p">
          <MarkedInline text={body} locale={locale} dedupeScope={dedupeScope} keyBase={blockKey} layer={layer} />
        </p>
      ) : null}
    </div>
  );
}
```
> `import type { MarkLayer } from "@/lib/llm/sanitize/compliance-terms";` 加到文件顶部 import 区。

**P4.3 · `SubheadBlock` / `BlockquoteContent`** — 各加 `layer: MarkLayer` 入参，透传给内部的 `MarkedInline`；
`BlockquoteContent` 里的 `LeadBlock` 也透传（金句框属于正文）。

**P4.4 · `RichReadingText`（123-137）**
```ts
export function RichReadingText({
  text,
  locale,
  className,
  variant = "body",
  density = "default",
  dualLayer = false,
}: Props) {
  const bodyLayer: MarkLayer = dualLayer ? "body" : "legacy";
  // …以下不动…
```
然后把 **除 179-196 依据分支之外**的每个 `<MarkedInline …/>`（145 / 199-207 / 211-217 / 218-227 / 233-239 / 246-252 / 262-268）都补 `layer={bodyLayer}`，
`SubheadBlock` / `BlockquoteContent` 补 `layer={bodyLayer}`。

**P4.5 · 依据分支（179-196）** — 一个块内共用一份 scope：
```ts
        if (isEvidenceLeadLabel(block.label)) {
          const evidenceScope = new Set<string>();
          return (
            <EvidenceBlock key={i} label={block.label}>
              {bodyChunks.map((chunk, j) =>
                chunk ? (
                  <p key={`${i}-ev-${j}`} className="reading-p">
                    <MarkedInline
                      text={chunk}
                      locale={locale}
                      dedupeScope={evidenceScope}
                      keyBase={keyBase + j}
                      layer="evidence"
                    />
                  </p>
                ) : null,
              )}
            </EvidenceBlock>
          );
        }
```

---

### P5 · `components/poju/PojuChat.tsx:133-142` — 第2段打开双层

**Before**
```ts
/* ---------- AI 文本：定稿后走 RichReadingText（金字 + 轻排版） ---------- */
function renderAiContent(text: string, locale: string, reveal?: boolean): ReactNode {
  return (
    <RichReadingText
      text={text}
      locale={locale}
      className={`pchat__reading-body${reveal ? " pchat__reading-reveal" : ""}`}
    />
  );
}
```

**After**
```ts
/* ---------- AI 文本：定稿后走 RichReadingText（双层制：正文白话 / 依据金字） ---------- */
function renderAiContent(text: string, locale: string, reveal?: boolean): ReactNode {
  return (
    <RichReadingText
      text={text}
      locale={locale}
      dualLayer
      className={`pchat__reading-body${reveal ? " pchat__reading-reveal" : ""}`}
    />
  );
}
```

> **本次只开这一处。**`components/poju/MainDeliveryView.tsx:111` 是第4段的入口，
> 它的提示词契约已经是双层的（`final-delivery.ts:355` 起「正文零标记 + **依据与推理:**」），
> 加一个 `dualLayer` 就能生效 —— 但那属于第4段，**按「每段验收后再做下一段」留到第4段开工时打开**。
> 第4段本次仍会受益：P1.1「平衡」修复是全局的，`均势[···]` 的正文泄漏会自动消失。
>
> 另注：`components/poju/MessageBubble.tsx` 全仓**没有任何文件 import 它**（孤儿组件），本次不动。

---

### P6.1 · `lib/llm/deepseek/breakthrough-core.ts:638-640` — 数据层焊死

**Before**
```ts
function scrubUserField(s: string, locale: string): string {
  return sanitizePaymentAuditLeaks(s, locale);
}
```

**After**
```ts
function scrubUserField(s: string, locale: string): string {
  return sanitizePaymentAuditLeaks(s, locale);
}

/**
 * 正文层字段（relationship_conclusion / direction / first_question）：
 * 合规清洗后【物理剥掉】所有标记，只留模型写的贴题白话。
 * 提示词禁标记不够 —— 「提示词禁 ≠ 代码禁」，出口必须代码焊死。
 * 泄漏必须响亮：静默降级 = 提示词被稀释了也没人知道。
 */
function scrubBodyField(
  s: string,
  locale: string,
  field: string,
): { text: string; leaks: number } {
  const scrubbed = scrubUserField(s, locale);
  const markers = scrubbed.match(/⟦t:[^⟧]+⟧/g);
  if (!markers?.length) return { text: scrubbed, leaks: 0 };
  console.warn(
    `[breakthrough-core] BODY MARKER LEAK — ${field} 正文层出现 ${markers.length} 个标记，已降级为白话。` +
      `模型违反「正文零标记」（见 DEEP_RECKONING_REPORT_TASK「双层 + 打标」段）。`,
    { field, sample: markers.slice(0, 3) },
  );
  return { text: degradeMarkersToPlain(scrubbed, locale), leaks: markers.length };
}
```
并在文件顶部的 `@/lib/llm/sanitize/compliance-terms` import 里加 `degradeMarkersToPlain,`。

### P6.2 · `lib/llm/deepseek/breakthrough-core.ts:645-688` — 按层分流

`sanitizeBreakthroughCoreMapped` 里，把 **正文字段**换成 `scrubBodyField`，**依据字段保持** `scrubUserField`（标记要留着给渲染层镀金）：

```ts
export function sanitizeBreakthroughCoreMapped(
  mapped: {
    breakthrough_core: BreakthroughCore;
    investigation_agenda: AgendaItem[];
  },
  locale: string,
): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
  violations: ComplianceViolation[];
  body_marker_leaks: number;
} {
  const core = mapped.breakthrough_core;
  let bodyLeaks = 0;
  const body = (s: string, field: string): string => {
    const r = scrubBodyField(s, locale, field);
    bodyLeaks += r.leaks;
    return r.text;
  };

  const breakthrough_core: BreakthroughCore = {
    ...core,
    // ↓ 正文层：零标记
    relationship_conclusion: body(core.relationship_conclusion, "relationship_conclusion"),
    breakthrough_directions: core.breakthrough_directions.map((d, i) => ({
      ...d,
      direction: body(d.direction, `directions[${i}].direction`),
      // ↓ 依据层：标记保留，渲染层负责镀金 + [···]
      structural_basis: scrubUserField(d.structural_basis, locale),
      ...(d.timing != null ? { timing: scrubUserField(d.timing, locale) } : {}),
      what_would_confirm: scrubUserField(d.what_would_confirm, locale),
    })),
    ...(core.first_question ? { first_question: body(core.first_question, "first_question") } : {}),
  };

  // …investigation_agenda / auditBlob / violations 原样不动…

  if (bodyLeaks > 0) {
    console.warn(`[breakthrough-core] 本轮共 ${bodyLeaks} 处正文标记被降级 —— 持续出现则回查提示词第 89 行是否被稀释。`);
  }
  return { breakthrough_core, investigation_agenda, violations, body_marker_leaks: bodyLeaks };
}
```
> 返回值多一个字段是**加法**，`parseSanitizeBreakthroughCore`（701-728）只读 `.violations` / `.breakthrough_core`，不用改。

### P6.3 · `lib/llm/deepseek/breakthrough-core.ts:785` — `first_question` 走正文层

**Before**
```ts
  const scrubbedQ = scrubUserField(first_question, locale);
```
**After**
```ts
  // first_question 是发给用户的正文 —— 零金字。
  const scrubbedQ = scrubBodyField(first_question, locale, "first_question").text;
```

### P6.4 · `lib/llm/deepseek/breakthrough-core.ts:141-142` — 拆掉与双层制打架的许可

**Before**
```
# 打标要点（仅对 first_question）
需要时用 \`⟦t:<闭集slug>|软译|白话?⟧\`；白话只进第3格；禁自造 id。议程 label 不打标。
```

**After**
```
# 零标记（硬约束）
first_question 与议程 label 都是【正文层】——**一个标记都不许写**，全部白话。
本次调用没有注入实例闭集，你写的任何 slug 都是猜的；代码会剥掉标记，只会让句子变难读。
```

> 为什么必须删：`buildAgendaBridgePrompt`（242-275）的 system 只有
> `POJU_IDENTITY` + `buildOutputPolicyForPoju()` + `AGENDA_BRIDGE_TASK` —— **没有注入实例闭集**。
> 模型无表可查却被许可打标 → 必然自造 slug → `normalizeTermMarkerIds` 降级 → 一句难读的残句。
> 且这条许可与「正文零标记」直接冲突（单一事实源：双层制说了算）。
> 改写只给原则与后果，**不给正例**。

---

### P7 · 新建 `scripts/test-poju-segment2-dual-layer.ts`

```ts
/**
 * 第2段双层呈现 · 冒烟验收
 *
 *   pnpm exec tsx scripts/test-poju-segment2-dual-layer.ts
 */
import fs from "node:fs";
import path from "node:path";
import { autoMarkBareTerms, collapseDuplicatedSoftPrefix, degradeMarkersToPlain } from "@/lib/llm/sanitize/term-marking";
import { prepareBodyTextForGlossaryRender, prepareTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n===== POJU 第2段 · 双层呈现 =====\n");

  // ① 「平衡」不再被镀金（实测症状：需要重新调整平衡 → …均势[···]）
  const balance = autoMarkBareTerms("卡住你的不是同事，而是你的系统需要重新调整平衡。", "zh");
  assert("『平衡』不再 auto-mark", !balance.includes("⟦t:balanced_self"));
  assert("『平衡』原词保留", balance.includes("调整平衡"));

  // ② 真术语仍然镀金（不能矫枉过正）
  assert("『壬水』仍 auto-mark", autoMarkBareTerms("日主见壬水偏旺。", "zh").includes("⟦t:"));
  assert("『孤鸾煞』仍 auto-mark", autoMarkBareTerms("盘里有孤鸾煞牵制。", "zh").includes("⟦t:"));

  // ③ 双字病
  assert("当前当前 折叠", collapseDuplicatedSoftPrefix("当前当前时空效能引动") === "当前时空效能引动");
  assert("你的你的 折叠", collapseDuplicatedSoftPrefix("你的你的能量结构") === "你的能量结构");
  assert("正常句不动", collapseDuplicatedSoftPrefix("当前这个阶段很关键") === "当前这个阶段很关键");

  // ④ 正文层零金字
  const bodyIn = "你需要的是⟦t:yong_shen|一段没人打扰的清晨⟧，不是硬撑。";
  const bodyOut = prepareBodyTextForGlossaryRender(bodyIn, "zh");
  assert("body 层剥掉标记", !bodyOut.includes("⟦t:"));
  assert("body 层留下贴题白话", bodyOut.includes("一段没人打扰的清晨"));
  assert("body 层不吐软译金字", !bodyOut.includes("锚元"));

  // ⑤ 正文层的合规网没撤（裸词 → 白话，不是 → 金字）
  const leak = prepareBodyTextForGlossaryRender("你今年走大运。", "zh");
  assert("body 层裸『大运』被替换", !leak.includes("大运"));
  assert("body 层裸词不镀金", !leak.includes("⟦t:"));

  // ⑥ 依据层仍然镀金
  const ev = prepareTextForGlossaryRender("你今年走大运。", "zh");
  assert("evidence/legacy 层仍 auto-mark", ev.includes("⟦t:"));

  // ⑦ 降级器只吐白话
  assert(
    "degradeMarkersToPlain 取第3格",
    degradeMarkersToPlain("⟦t:shi_shen|流展|你擅长把想法讲出来⟧", "zh") === "你擅长把想法讲出来",
  );

  // ⑧ 接线（防止漏改）
  const glossary = read("components/cross-product/GlossaryText.tsx");
  const rich = read("components/cross-product/RichReadingText.tsx");
  const chat = read("components/poju/PojuChat.tsx");
  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("GlossaryText 有 layer", glossary.includes("layer = \"legacy\"") && glossary.includes("MAX_PAREN_MARKS_EVIDENCE = 3"));
  assert("GlossaryText 保留旧常量(老测试断言)", glossary.includes("MAX_PAREN_MARKS_PER_PARAGRAPH = 2"));
  assert("RichReadingText 有 dualLayer", rich.includes("dualLayer") && rich.includes('layer="evidence"'));
  assert("PojuChat 打开 dualLayer", /<RichReadingText[\s\S]{0,240}dualLayer/.test(chat));
  assert("breakthrough-core 有 scrubBodyField", core.includes("scrubBodyField"));
  assert("AGENDA_BRIDGE 不再许可打标", !core.includes("# 打标要点（仅对 first_question）"));

  console.log(
    "\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
```

### P8 · `package.json` scripts

```json
"test:poju-dual-layer": "tsx scripts/test-poju-segment2-dual-layer.ts",
```

---

## 三、验收（第2段收尾）

**自动**
```bash
pnpm exec tsx scripts/test-poju-segment2-dual-layer.ts   # 全 PASS
pnpm exec tsx scripts/test-term-closed-set.ts            # 不受影响（没动闭集）
pnpm lint && pnpm build                                   # 零回归
```

**人工（跑一遍真实第2段）**

1. 「你为什么卡在这里」正文里 **0 个金字、0 个 `[···]`**，通篇白话；
2. 「破局方向一/二/三」标题行 **0 个金字**；
3. 每条方向下的 **▸ 依据与推理** 展开后：金字最多 3 个，**每个都带 `[···]` 且点得开**（旧版第 3 个裸奔）；
4. 全文搜「均势」→ **0 命中**（除非用户命盘真的判到 balanced_self 并被显式打标进依据）；
5. 全文搜「当前当前」「你的你的」→ **0 命中**；
6. 依据里出现流年相关时，显示 **岁环[···]** 而不是「当前时空效能」；
7. 结尾第一个议程提问：**0 个金字**，纯白话真问题；
8. 控制台无 `BODY MARKER LEAK` —— 若有，说明模型仍在正文打标，**这正是我们要能看见的东西**（别去关告警，去收提示词）。

**零回归抽查**：Glyph 报告 / Match 报告 / 命主基础分析各开一份 —— 金字表现应与改动前**完全一致**（它们走 `legacy`）。

---

## 四、我查证过 vs 我推断的（诚实标注）

**查证过（有代码行号）**
- 提示词已要求正文零标记；`平衡` 在闭集 → auto-mark → `均势`；`流年 → 当前时空效能` 的字符串替换与双字病；`wrapBareKeepCnSoftTerms` 的汉字 lookbehind 会被双字病顶掉；`sanitizeChatResponse` 只审计不改写；`MessageBubble` 无人 import；`CLOSED_SET_REPLACE_IDS` 还被 `term-glossary.ts:51` 消费。

**推断（需要你跑一遍确认）**
- 你截图里「磨蚀」没有 `[···]` 我归因于 `MAX_PAREN_MARKS_PER_PARAGRAPH=2`（第 3 个金字降级）。也可能是跨段 `dedupeScope` 造成的。P3.2 + P4.5 两条都改了，**两种成因都覆盖**，但哪一条是真凶要看实测。

---

## 五、本次没做（下一份文档再动）

1. **术语四表并行**（铁律 #10 已破）：`身弱` 同时有 `pojulife-terms.ts` 的「需养」、`banned-terms.ts:49-58` 的「能量供给容易跟不上」、`term-glossary-closed.ts:343` 的「燃料容易跟不上」、`base-analysis-stream-prompt.ts:133` 提示词里硬写的第四种。你测试里第2段写「需养」第4段写「燃料容易跟不上」就是它。**收口要等你的 157 术语落地**，现在动会撞车。
2. **第3段议程收集**（`state-machine.ts:259-303`「有说话就算收到」+ `investigation-agenda.ts:84-91` 的 `answer` 永远 undefined）。
3. **第4段 ReportStructured / PDF 重做**。
4. **顺手记一笔**：`scripts/test-poju-block95-segment2-presentation.ts:36-37` 和
   `scripts/test-poju-block99-*.ts:38-39` 断言的字符串（`禁止抠词替换` / `错误示范（禁止）` / `首问（first_question`）
   在现在的 `breakthrough-core.ts` 里**已经不存在** —— 这两个脚本本来就是红的，不是本次改坏的，别去追。
