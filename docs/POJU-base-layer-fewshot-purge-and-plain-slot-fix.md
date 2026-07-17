# 底座 · 正例清除 + 白话槽双闸

> **一件事**：让底座停止吐"所有用户都一样"的模板内容。两个病同源 —— **提示词给了正例，模型就照抄；白话槽没定义，模型就抄软译。**
>
> **动手前**：`git clone https://github.com/Mattchen217/POJU` 拉最新 main。行号基于本次拉取。
>
> **优先级**：**排在第3段之前**。底座是四产品共同上游；它常量化，第2段的"真算"就锚在常量上，同质化测试必挂 —— 而且挂的不是第2段。

---

## 零、两个病，一个根

### 病 A · 提示词给了正例 → 逐字照抄（铁律 #1 现行犯）

`lib/base-analysis/generate-core-judgments.ts:108-112`：
```
正例（机制读数 · 下游可直接用）：
  ✓ "identity_anchor": "供给端靠连接放大；硬撑独扛时输出会断。"
  ✓ "drive_mechanism": "吸收转化与协同合作是主要推进方式；硬输出反而加速透支。"
  ✓ "structural_gap": "调节阀偏弱——信息未齐就容易锁死决策。"
  ✓ "balance_anchor": "补稳定供给、减持续消耗，比加新任务更有效。"
```
实测输出：**这四条一字不差。** 剩下两条（`exchange_mode` / `leverage_state`）恰好是**没给正例的那两条** —— 它们才是模型自己写的。

**根因不是模型爱抄。** 看它的 reasoning：

> 「调节阀**可能指**水（印星）或金（官杀）？」／「杠杆状态，**可能指**当前大运或原局中杠杆的强弱」

**这六个字段，提示词从头到尾没有给过一句定义。** 模型在猜字段是什么意思，正例是它唯一的语义来源 —— 除了照抄别无选择。
**所以正解是：把定义写出来，然后把正例删掉。只删不补，模型会更乱。**

**顺带一个尴尬事实**：`buildCoreJudgmentsFromStructured`（代码兜底，`core-judgments.ts:150-153`）对 weak 命盘输出「借力生长型（木）：能量靠连接与节奏放大，硬撑则折」—— 跟那条正例是同一句话的两种说法。**这次 medium 调用烧的 token，产出 = 代码免费就能给的东西。**

### 病 B · 白话槽被抄成软译 → tooltip 用这个词解释这个词

底座报告 13 个标记，**12 个的白话槽里填的是软译词本身**：

| 模型写的 | 渲染出来 |
|---|---|
| `⟦t:weak_self\|需养⟧` | 金字「需养」→ 点开 →「需养」 |
| `⟦t:zheng_yin\|供源⟧` `⟦t:shi_shen\|流展⟧` `⟦t:fire\|发散⟧` `⟦t:earth\|承托⟧` `⟦t:water\|润流⟧` `⟦t:wood\|舒展⟧` | 同上 |
| `⟦t:yong_shen\|润流⟧`（抄成了 **water** 的软译） | 「锚元」→ 点开 →「润流」——用一个没解释的金字解释另一个 |
| `⟦t:day_master\|如河畔垂柳般的柔韧核心⟧` | 唯一真白话 —— 而它是 `base-analysis-stream-prompt.ts:152` 正例「如**盆景**般需精准滋养的柔韧生长力」换了个植物 |

`term-marking.ts:692`：
```ts
const plainOut = plain || glossOf(id, loc) || soft;   // ← 模型写了就赢
```
`buildTermMarkingPromptBlock:859` 的设计意图本来是对的（"漏写 → UI 回退静态 gloss"），但模型**不留空** —— 它从注入的术语表（`term-marking.ts:870-872`，**带软译列**）里抄一个填进去 → 非空 → 回退永远不触发。

**每个 slug 在 `pojulife-terms.ts` 里都有现成的 SSOT 白话，一个都没用上：**
```
weak_self  → 内在能量敏感内敛，倾向于温和吸纳、保存实力。
yong_shen  → 最能带来内在平衡与支持的关键能量点。
zheng_guan → 代表内在秩序、契约精神、社会规则与天然责任感。
```

**底座只有八字、没有用户情景 →「贴题白话」在这一层是伪需求**（铁律 #4）。代码从 SSOT 填。
**只有第2/4段和其他产品有用户情景，"贴题"才成立** —— 那里保留模型实时写。

---

## 一、改动清单

| # | 文件 | 位置 | 一句话 |
|---|---|---|---|
| P1.1 | `lib/base-analysis/generate-core-judgments.ts` | 90-117 | 删 4 条正例，补 6 个字段定义（zh） |
| P1.2 | 同上 | 118-137 | 同上（en） |
| P1.3 | 同上 | 50-80 | `hasCoreJudgmentsBlackspeak` 增「≈正例/≈兜底模板」检测 |
| P1.4 | 同上 | 196-218 | 命中照抄 → 同参数无感重发（上限 3） |
| P2.1 | `lib/llm/sanitize/term-marking.ts` | 673-695 | `rewriteMarkersWithSsotSoft` 加「白话槽=软译词 → 判空」闸 |
| P2.2 | 同上 | 822-874 | `buildTermMarkingPromptBlock` 加 `ssotPlainOnly` 模式（底座用） |
| P3.1 | `lib/llm/prompts/base-analysis-stream-prompt.ts` | 150-152 | 白话槽规则改成「**留空**，系统填」；删 ✓ 正例 |
| P3.2 | 同上 | 96 / 115 | 删「正例方向 / Good direction」 |
| P3.3 | 同上 | 105 / 124 | 删收尾式 ✓ 正例，只留反例 |
| P4 | `lib/llm/compliance/banned-terms.ts` | 286 / 289 / 302 / 306 | 同上（这份被**所有**产品注入，优先级最高） |
| P5 | `scripts/test-base-layer-no-fewshot.ts` | 新建 | 冒烟：全仓无正例 + 白话槽闸生效 |

---

## 二、Patch

### P1.1 · `generate-core-judgments.ts:90-117` — 删正例，补定义

**Before**（`const system = zh ? ...` 整块）
```
# core_judgments = 【机制读数】给机器的中立判断层（不是诗意、不是术语复述）

把 structured 译成【具体、可被下游直接引用】的机制读数。

规则：
1) 只输出 JSON；字段仅：identity_anchor, drive_mechanism, structural_gap, balance_anchor, exchange_mode, leverage_state
2) 【禁止】输出 refs / climate_now（代码已算好）
3) 只展开 structured，【禁止】改判强弱/用神方向/喜忌/格局
4) 无比喻套话、无职业/婚恋场景、无年龄/干支纪年
5) 每字段 1 句——写【机制】（供给/消耗/缺口/杠杆），不要抽象意境

【禁止】裸干支、日主、身弱/身强、用神/喜神/忌神、刑冲合害原词。

反例（术语复述 / 空诗意 / 把消耗当驱动）：
  ✗ "identity_anchor": "乙木日主，根基偏弱，依赖水木生扶。"
  ✗ "identity_anchor": "像一场温柔却坚定的苏醒。"
  ✗ "drive_mechanism": "表达与创造是主引擎"（当 strength 偏弱且食伤为忌时——泄身通道是消耗，不是驱动）
正例（机制读数 · 下游可直接用）：
  ✓ "identity_anchor": "供给端靠连接放大；硬撑独扛时输出会断。"
  ✓ "drive_mechanism": "吸收转化与协同合作是主要推进方式；硬输出反而加速透支。"
  ✓ "structural_gap": "调节阀偏弱——信息未齐就容易锁死决策。"
  ✓ "balance_anchor": "补稳定供给、减持续消耗，比加新任务更有效。"

自检（写完每条后自问）：
- 能量供给偏弱时，【泄身的通道不是驱动源，是消耗源】——drive_mechanism 别把消耗当驱动。
- 每条判断必须与 structured 的强弱/用神方向一致，不得自相矛盾。
- 下游能否直接写成「锚元不足 + 耗元偏重 → …」式依据？不能 → 重写。
```

**After**
```
# core_judgments = 【机制读数】给机器的中立判断层（不是诗意、不是术语复述）

把 structured 译成【具体、可被下游直接引用】的机制读数。

## 六个字段各自读什么（这是定义，不是可选项）

- identity_anchor —— **这套系统靠什么维持自己**。读 day_master 五行 + strength：
  供给从哪来、在什么条件下会断。写"运转条件"，不写性格形容词。
- drive_mechanism —— **什么动作能真的推进它**。读 pattern + 在场十神 + strength：
  哪条通道是推进、哪条是消耗。⚠️ 供给偏弱时，泄身通道是**消耗**，不是驱动 —— 别把消耗写成驱动。
- structural_gap —— **它最先在哪里失效**。读 ji_shen + strength + natal_relations：
  过载时先垮的是哪个环节。写失效点，不写"缺点"。
- balance_anchor —— **补哪一路能把它拉回可用区**。读 yong_shen + xi_shen：
  只写"补什么方向"，**不写做什么动作**（行动是下游第4段的活，这里越界会锁死下游）。
- exchange_mode —— **它跟外界怎么换能量**。读在场十神的进/出两侧：
  需要外界给什么、最擅长给出什么。
- leverage_state —— **哪一个条件成熟时收益最大**。读 yong_shen 得力与否 + natal_relations：
  写"条件"，不写"时机"，不写"你应该"。

## 硬规则

1) 只输出 JSON；字段仅上述六项，每项 1 句。
2) 【禁止】输出 refs / climate_now（代码已算好）。
3) 只展开 structured，【禁止】改判强弱/用神方向/喜忌/格局。
4) 【禁止】裸干支、日主、身弱/身强、用神/喜神/忌神、刑冲合害原词。
5) 【禁止】比喻、职业/婚恋场景、年龄/干支纪年、行动清单。
6) **每条必须能被换成另一个命盘时失效** —— 六条里有任何一条换盘还成立，那条就是套话，重写。
7) refs 里的 shensha_instances 与 natal_relations 是这盘**独有**的算料：
   至少 structural_gap 与 leverage_state 必须落到其中具体条目上，不能只用强弱/喜忌三标签。

## 反例（照这个方向避）

  ✗ "identity_anchor": "乙木日主，根基偏弱，依赖水木生扶。"（术语复述 + 裸干支）
  ✗ "identity_anchor": "像一场温柔却坚定的苏醒。"（空诗意，无机制）
  ✗ "drive_mechanism": "表达与创造是主引擎"（当供给偏弱、泄身为忌时：把消耗当驱动）
  ✗ "balance_anchor": "多做冥想、每天早起半小时。"（越界写成行动清单）
  ✗ 任何一条读起来像「大部分人都这样」的句子。
```

> **为什么这么改**：原提示词六个字段**从没定义过**，正例是它们唯一的语义来源 —— 模型的 reasoning 里明写「调节阀**可能指**水还是金？」。删正例而不补定义，只会让它猜得更野。
> **反例保留、正例清零**（铁律 #1：正例会被逐字照抄，反例不会）。
> 新增第 7 条把 `refs` 里的神煞/关系接上 —— 那是这盘**独有**的算料，现在一条都没被消化。

### P1.2 · `generate-core-judgments.ts:118-137` — 英文块同款

**Before** 里删掉：
```
Bad: poetic abstraction, chart jargon, or calling a drain channel the "drive" when supply is weak.
Good: "Supply scales via connection; solo forcing cuts output." / "Absorption + collaboration is the main propulsion; hard output accelerates drain."
```
**After**：`Good:` 整行**删除**；`Bad:` 保留并补齐与中文对齐的六个字段定义（同 P1.1 结构，英文表述）。

### P1.3 · `generate-core-judgments.ts:50-80` — 照抄门禁

`hasCoreJudgmentsBlackspeak` 现在只拦裸词，4 条逐字抄正例它一条都不拦（铁律 #5：静默通过）。新增：

```ts
/**
 * 提示词里的任何常量串一旦出现在输出里 = 照抄 = 这个用户拿到的是别人的读数。
 * 铁律 #1：正例会被逐字照抄。正例已删，这道闸负责它以后别再长回来。
 * 同时比对代码兜底模板 —— 输出 ≈ 兜底 = 这次 LLM 调用白烧，也该重发。
 */
export function looksCopiedFromPromptOrTemplate(
  interpretive: Record<string, string>,
  fallback: CoreJudgments,
): { copied: boolean; hits: string[] } {
  const hits: string[] = [];
  const norm = (s: string) => s.replace(/[\s。；;,，.…—\-"'「」“”]/g, "");
  for (const [key, value] of Object.entries(interpretive)) {
    const v = norm(value);
    if (v.length < 8) {
      hits.push(`${key}: too short to be a readout`);
      continue;
    }
    const tpl = norm(String((fallback as Record<string, unknown>)[key] ?? ""));
    // 与代码兜底几乎一致 → LLM 没带来任何东西
    if (tpl && (v === tpl || v.includes(tpl) || tpl.includes(v))) {
      hits.push(`${key}: ≈ template fallback`);
    }
  }
  return { copied: hits.length > 0, hits };
}
```

> **注意**：不再需要维护一份"正例串清单"—— 正例已经从提示词里删干净了，清单会漂移（铁律 #10）。
> 这道闸只比对**代码兜底模板**（唯一的、代码生成的、必然存在的那份），照抄兜底 = 照抄套话，二者同源。

### P1.4 · `generate-core-judgments.ts:196-218` — 命中就同参数重发

**Before**
```ts
    const interpretive = parseLlmInterpretiveJson(result.text ?? "");
    if (!interpretive) { … return { judgments: fallback, source: "template_fallback" }; }

    const joined = Object.values(interpretive).join("\n");
    if (hasCoreJudgmentsBlackspeak(joined)) { … }
```

**After** — 把整个 try 块包进「同参数无感重发」循环（铁律 #8），并把照抄判为失败：

```ts
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { system, user } = buildCoreJudgmentsLlmPrompt(input.structured, input.locale);
      const result = await openRouterChatCompletion({ /* …同参数不变… */ });

      const interpretive = parseLlmInterpretiveJson(result.text ?? "");
      if (!interpretive) {
        console.warn(`[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — parse failed, resending same params`);
        continue;
      }
      if (hasCoreJudgmentsBlackspeak(Object.values(interpretive).join("\n"))) {
        console.warn(`[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — blackspeak, resending same params`);
        continue;
      }
      const copy = looksCopiedFromPromptOrTemplate(interpretive, fallback);
      if (copy.copied) {
        console.warn(
          `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — 疑似照抄/套话，同参数重发`,
          { hits: copy.hits },
        );
        continue;
      }
      const merged: CoreJudgments = { ...interpretive, climate_now, refs };
      if (!isCoreJudgments(merged)) {
        console.warn(`[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — shape invalid, resending same params`);
        continue;
      }
      return { judgments: merged, source: "llm" };
    } catch (e) {
      console.warn(`[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — call failed, resending same params`, {
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  console.warn("[fallback] core_judgments — 3 次均未拿到合格读数，落代码模板。**这份底座是套话，四产品都会受影响。**");
  return { judgments: fallback, source: "template_fallback" };
```

> 同参数、同 slug、同 effort、不降质（铁律 #8）。上限用尽才落模板，且**响亮**（铁律 #5）。

---

### P2.1 · `lib/llm/sanitize/term-marking.ts:673-695` — 白话槽闸

在 `rewriteMarkersWithSsotSoft` **上方**新增：

```ts
/** SSOT 全部软译词（全 locale）—— 用来识别"模型把软译抄进了白话槽"。 */
const ALL_SOFT_LABEL_SURFACES: ReadonlySet<string> = new Set(
  POJU_TERMS.flatMap((t) => Object.values(t.term))
    .map((s) => String(s).trim())
    .filter(Boolean),
);

/**
 * 白话槽里填的是软译词（或术语原词）= 没解释，等于"用这个词解释这个词"。
 * 实测底座 13 个标记 12 个如此（⟦t:weak_self|需养⟧ → tooltip 弹出「需养」）。
 * 判空 → 让 SSOT definition 顶上。留痕，别静默（铁律 #5）。
 */
export function isNonExplanatoryPlain(plain: string, id: string, loc: string): boolean {
  const p = plain.trim();
  if (!p) return true;
  if (p === termOf(id, loc)) return true;                    // 抄了自己的软译
  if (p.length <= 6 && ALL_SOFT_LABEL_SURFACES.has(p)) return true; // 抄了别的术语的软译
  return false;
}
```

`rewriteMarkersWithSsotSoft:692`：

**Before**
```ts
      const plainOut = plain || glossOf(id, loc) || soft;
```
**After**
```ts
      // 白话槽 = 软译词 → 视为没写，让 SSOT 固定白话顶上（铁律 #4：代码能定的别让模型做）
      const usable = isNonExplanatoryPlain(plain, id, loc) ? "" : plain;
      if (plain && !usable) {
        console.warn("[term-marking] 白话槽抄了软译词，已回落 SSOT 定义", { id, wrote: plain });
      }
      const plainOut = usable || glossOf(id, loc) || soft;
```

> 这道闸**对全部产品生效**（底座 / 第2段 / 第4段 / Match / Glyph）—— 第2/4段的模型会犯同样的懒，
> 它们那里"贴题白话"是真需求，但**没写就该退回 SSOT，而不是拿软译凑数**。

### P2.2 · `term-marking.ts:814-874` — 底座专用「不写白话槽」模式

`TermMarkingPromptOptions` 加一档：
```ts
export type TermMarkingPromptOptions = {
  principlesOnly?: boolean;
  /**
   * 底座专用：这一层【没有用户情景】→「贴题白话」是伪需求。
   * 模型只选 slug，白话由代码从 pojulife-terms.definition 填（固定模板 · 5 语言已齐）。
   */
  ssotPlainOnly?: boolean;
};
```

`buildTermMarkingPromptBlock` 里，当 `ssotPlainOnly === true` 时 `rules` 用：
```
## 打标记规则（底座 · 只选 slug）
1. 格式固定：`⟦t:<slug>|⟧` —— **竖线保留，后面留空**。软译词和白话解释都由系统从术语表填入。
2. 你唯一要做的是**选对 slug**。这一层没有用户的具体处境，任何"贴题白话"都是你编的，会被丢弃。
3. **正文零标记**；标记只出现在「依据与推理」；一段依据 ≤3 金字。
4. **slug 必须取自上表**；自造 id = 拒绝；闭集里没有 → 不打标、直接白话讲。
5. 守六条语义红线（不预测/不算命/不占卜/不决吉凶/不恐吓/不超自然承诺）。
```

> ⚠️ **格式必须是 `⟦t:slug|⟧`，不能是 `⟦t:slug⟧`** —— `TERM_MARKER_PATTERN`（`term-marking.ts:146-147`）要求至少一个 `|`，
> 没有竖线整个标记会被当破损标记剥掉，金字直接消失。
>
> 另：`ssotPlainOnly` 时下表的**软译列要撤掉**（改成只留 `slug | 禁/术语示例` 两列）—— 那一列正是模型没主意时的抄袭源。

底座调用处（`base-analysis-stream-prompt.ts` 里 `buildTermMarkingPromptBlock(...)` 的调用）加 `{ ssotPlainOnly: true }`。

---

### P3 · `lib/llm/prompts/base-analysis-stream-prompt.ts` — 拆正例

**P3.1 · 行 150-152**

**Before**
```
6. **贴题白话 = 用户可见** — `⟦t:<slug>|<贴题白话>⟧` 的【贴题白话】适用与正文【完全相同】的禁词规则：…
   - ✗ `⟦t:day_master|乙木⟧`  ✗ `⟦t:day_master|如盆景般需精准滋养的乙木⟧`  ✗ `⟦t:shi_shen|将感受化为产出的食神⟧`
   - ✓ `⟦t:day_master|如盆景般需精准滋养的柔韧生长力⟧`  ✓ `⟦t:shi_shen|把感受化为产出的通道⟧`
```
**After**
```
6. **白话槽留空 · 系统填** — 格式 `⟦t:<slug>|⟧`（竖线保留、后面不写）。
   这一层是四产品共用的中立底座，**没有这位用户的具体处境**——任何"贴题白话"都是你编的，
   系统会丢弃并用术语表里的固定释义覆盖。你唯一要做的是**选对 slug**。
   - ✗ `⟦t:day_master|乙木⟧`（裸干支）
   - ✗ `⟦t:weak_self|需养⟧`（把软译抄进白话槽 = 用这个词解释这个词）
   - ✗ `⟦t:shi_shen|将感受化为产出的食神⟧`（白话里留了术语原词）
```
> ✓ 那行**整行删除** —— 实测模型把「如盆景般需精准滋养的柔韧生长力」改成「如**河畔垂柳**般的柔韧核心」交差（换个植物）。
> 反例保留（反例不会被抄）。

**P3.2 · 行 96 / 115 — 删「正例方向 / Good direction」**

**Before（96）**
```
- **正例方向:** 「你的核心能量偏高频输出，执行锋芒强，但长期缓冲弱——需要规则网格约束蒸发」——只谈机制，不编情节。
```
**After（96）**
```
- **只谈机制，不编情节**：说这套系统怎么运转、在什么条件下失效；不说他是谁、做什么、会遇到什么。
```
**Before（115）**
```
- **Good direction:** "Core energy leans high-frequency output with sharp execution edge but weak long buffer—needs a rule grid to limit evaporation"—mechanism only, no plot.
```
**After（115）**
```
- **Mechanism only, no plot**: describe how the system runs and where it fails; never who he is, what he does, or what will happen to him.
```

**P3.3 · 行 105 / 124 — 删收尾式 ✓ 正例**

**Before（105）**
```
- **黑名单 = 字面禁止**：否定式/对比式/引用式同样违规。✗「你不是一台引擎」✗「不像散热片」→ 请正面直说。✓「你的力量来自吸收与转化，而不是自我消耗。」
```
**After（105）**
```
- **黑名单 = 字面禁止**：否定式/对比式/引用式同样违规。✗「你不是一台引擎」✗「不像散热片」→ 想说"他不靠硬撑"，就**直接正面说**，别拿禁词当反面参照。
```
（124 行英文同款：删掉 `✓ "Your power comes from absorption and conversion, not self-burn."`）

> 实测这条正例的后果：报告写出「你的价值不在硬扛，而在**吸收、消化**，再温柔地还给世界」——同构变体。

---

### P4 · `lib/llm/compliance/banned-terms.ts:286 / 289 / 302 / 306` — **优先级最高**

这份 block 被**所有**产品注入，污染面最大。

**Before（286 / 289）**
```
要表达「你不靠硬撑」→【直接正面说】，不要拿禁词当反面例子。
  ✓「你的力量来自吸收与转化，而不是自我消耗。」
…
【收尾】禁「这不是命运/不是命定」否定式。✓「这是你的能量配置读数。怎么用它，取决于你自己。」
```
**After**
```
要表达「你不靠硬撑」→【直接正面说】，不要拿禁词当反面例子。用这个盘自己的机制说，不要套用任何现成句式。
…
【收尾】禁「这不是命运/不是命定」否定式。收尾句由系统统一追加，你不用写。
```
（302 / 306 英文同款。）

> **收尾句的正确归宿是代码**：它是固定文案（铁律 #4：代码能定的别让模型做），
> 而且现在同时写在 `banned-terms.ts:289` 和 `base-analysis-stream-prompt.ts:65` 两处（铁律 #10）。
> 落地：`base-analysis-stream-prompt.ts:65` 那条"末尾一句短收束"的指令也删掉，改由 `prepare-display-pipeline.ts` 在文末追加常量。
> **本次可先只删正例、留 65 行的指令**，代码追加拆到"底座收尾"那批一起做 —— 但 `banned-terms` 这两条 ✓ 必须现在就删。

---

### P5 · 新建 `scripts/test-base-layer-no-fewshot.ts`

```ts
/**
 * 底座 · 正例清除 + 白话槽双闸 · 冒烟
 *   pnpm exec tsx scripts/test-base-layer-no-fewshot.ts
 */
import fs from "node:fs";
import path from "node:path";
import { rewriteMarkersWithSsotSoft } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

/** 铁律 #1 守卫：这些文件里不许再长出正例。 */
const PROMPT_FILES_NO_POSITIVE_EXAMPLES = [
  "lib/base-analysis/generate-core-judgments.ts",
  "lib/llm/prompts/base-analysis-stream-prompt.ts",
  "lib/llm/compliance/banned-terms.ts",
];

function main(): void {
  console.log("\n===== 底座 · 正例清除 + 白话槽 =====\n");

  // ① 全仓正例扫查
  for (const f of PROMPT_FILES_NO_POSITIVE_EXAMPLES) {
    const src = read(f);
    assert(`${f} 无「正例」段`, !src.includes("正例"));
    assert(`${f} 无「Good:」/「Good direction」`, !/Good:|Good direction/.test(src));
    // ✓ 后面直接跟内容句（不是规则符号）= 正例
    assert(`${f} 无 ✓ 内容示范句`, !/✓\s*[「"'`]/.test(src));
  }

  // ② core_judgments 六字段有定义
  const gcj = read("lib/base-analysis/generate-core-judgments.ts");
  for (const k of ["identity_anchor", "drive_mechanism", "structural_gap", "balance_anchor", "exchange_mode", "leverage_state"]) {
    assert(`${k} 有定义（—— 读什么）`, new RegExp(`${k}\\s*——`).test(gcj));
  }
  assert("有照抄门禁", gcj.includes("looksCopiedFromPromptOrTemplate"));
  assert("有同参数重发", gcj.includes("MAX_ATTEMPTS"));
  assert("神煞/关系必须落地", gcj.includes("shensha_instances") && gcj.includes("natal_relations"));

  // ③ 白话槽闸：软译抄进白话槽 → 回落 SSOT
  const lazy = rewriteMarkersWithSsotSoft("⟦t:weak_self|需养⟧", "zh");
  assert("『需养』被判空", !/\|需养\|需养⟧/.test(lazy));
  assert("回落到 SSOT 定义", lazy.includes("内在能量敏感内敛"));

  const wrongSoft = rewriteMarkersWithSsotSoft("⟦t:yong_shen|润流⟧", "zh");
  assert("抄错别人的软译也被判空", !wrongSoft.includes("|润流⟧"));
  assert("锚元回落 SSOT", wrongSoft.includes("最能带来内在平衡与支持"));

  // ④ 真白话不许被误杀
  const good = rewriteMarkersWithSsotSoft("⟦t:day_master|如河畔垂柳般的柔韧核心⟧", "zh");
  assert("真贴题白话保留", good.includes("如河畔垂柳般的柔韧核心"));

  // ⑤ 空槽仍然回落（底座新格式）
  const empty = rewriteMarkersWithSsotSoft("⟦t:zheng_guan|⟧", "zh");
  assert("⟦t:slug|⟧ 回落 SSOT", empty.includes("代表内在秩序"));

  // ⑥ 底座提示词走 ssotPlainOnly
  const basePrompt = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("底座启用 ssotPlainOnly", basePrompt.includes("ssotPlainOnly"));

  console.log("\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`));
  if (failures.length) process.exit(1);
}

main();
```

`package.json`：
```json
"test:base-no-fewshot": "tsx scripts/test-base-layer-no-fewshot.ts",
```

---

## 三、验收

**自动**
```bash
pnpm exec tsx scripts/test-base-layer-no-fewshot.ts   # 全 PASS
pnpm lint && pnpm build
```

**人工 —— 这一条是真正的验收，别跳**

拿 **3 个差异很大的命盘**（建议：一个 weak / 一个 strong / 一个 balanced，用神各不同）各跑一次底座，然后：

1. 把三份 `core_judgments` 并排贴出来 —— **六个字段没有任何一句是重复的**；
2. 三份里搜「供给端靠连接放大」「吸收转化与协同合作」「调节阀偏弱」「补稳定供给、减持续消耗」→ **0 命中**（正例已死）；
3. 每份的 `structural_gap` / `leverage_state` **点到了这盘独有的神煞或本命关系**，而不是只说强弱喜忌；
4. 三份叙事读起来**像三个不同的人**（这是备忘录里那条「同质化测试」，现在才第一次具备通过的可能）；
5. 展开任意「依据与推理」，随便点一个金字 —— **弹出的是解释，不是同一个词**；
6. 控制台看 `[core_judgments] attempt` —— 偶发重发正常；若某个盘连撞 3 次落了模板，**那个盘要单独看**（说明定义还不够把它逼出差异）。

---

## 四、我查证过 vs 我推断的

**查证过（有行号）**
- 4 条正例逐字出现在实测输出里；`exchange_mode`/`leverage_state` 恰好是没给正例的两条；
- 提示词六个字段**从无定义**，模型 reasoning 明写在猜；
- 正例内容 ≈ `buildCoreJudgmentsFromStructured` 代码兜底；
- 13 个标记 12 个白话槽 = 软译词；`⟦t:yong_shen|润流⟧` 抄错成 water 的软译；
- `term-marking.ts:692` `plain || glossOf || soft` 的优先级；`TERM_MARKER_PATTERN:146` 要求至少一个 `|`；
- `pojulife-terms.ts` 里每个相关 slug 的 SSOT definition 都在、都没被用上。

**推断（需实测）**
- P1.1 补的六个字段定义能不能真把差异逼出来 —— 定义是我写的，**得靠三盘对照验**。若某个字段三盘还是撞车，那是定义没写到点上，回来改定义，**不要退回加正例**。

---

## 五、本次没做

1. `core_judgments` 加**锚点字段**（`{ reading, anchored_on: ["ji_shen:火","strength:weak"] }`）—— 是 schema 变更，动四产品，单独一份；
2. `refs` 里 `day_master/strength/yong_shen/xi_shen/ji_shen/pattern` 六项与 structured 完全重复（`base-analysis-context.ts:142-158` 两份都注入）—— 清冗余，随 schema 那份一起；
3. 收尾句改由代码追加（铁律 #4 + #10）—— 随"底座收尾"那批；
4. `身弱` 的 4 张脸 / `流年` 的 2 张脸（铁律 #10）—— **等你的 157 术语落地**，现在动会撞车。
