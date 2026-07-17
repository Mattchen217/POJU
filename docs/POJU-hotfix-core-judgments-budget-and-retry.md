# 🔴 HOTFIX · core_judgments 截断 + 双层重发 → 底座页面卡死

> **一件事**:让底座恢复「2 次调用」并且页面能出报告。
>
> **动手前**:`git clone https://github.com/Mattchen217/POJU` 拉最新 main(`8178d6f` 桥那次)。行号基于本次拉取。
>
> **这是我上一份补丁(`底座 · 正例清除 + 白话槽双闸`)引入的回归,不是老账。**

---

## 零、病根(实测证据链)

生产截图:**7 次调用,Input 全 1,083、Output 全 900、`Finish Reason` 全 `length`。**
Output **恰好等于** `generate-core-judgments.ts:242` 的 `max_tokens: 900` —— 每一次都是被截断的。

```
删掉正例(上一份补丁)
  → 模型不再照抄 4 条现成答案,开始真推导 6 个字段
  → reasoning_effort:"medium" 的 reasoning token 计入 900 预算
  → reasoning 吃光 900 → finish_reason:length → content 一个 token 都没吐
  → openrouter-retry.ts:10   MAX_EMPTY_CONTENT_RESEND = 3   ← 传输层内层同参数重发 3 次
  → 3 次全一样(确定性失败)→ 抛 openrouter_empty_after_resend
  → generate-core-judgments.ts:232  MAX_ATTEMPTS = 3        ← 我的外层又套一圈
  → 3 × 3 = 最多 9 次
  → route.ts:188  const cj = await generateCoreJudgmentsForProfile(...)  ← 阻塞在叙事流之前
  → 页面卡死,叙事永远开不了
```

生产日志里的 `attempt 2/3 — call failed { reason: 'openrouter_empty_after_resend' }` —— **就是我的外层在吃内层已经用尽的错误,然后再来一轮。**

### 对照基线(铁律 #6)

| 调用 | max_tokens |
|---|---|
| 底座叙事 `route.ts:212` | **10,000** |
| 违规修补 `repair-violations.ts:215` | 1,400 |
| **core_judgments** | **900** ← 唯一要做真推导的,给得最少 |

### 三个错,都记在我头上

1. **铁律 #7,第四版。** 900 是「照抄时代」的胃口。删掉正例＝任务变重,预算没跟上。(前三版:90s超时 / 12000token / max_attempts:1)
2. **铁律 #8 用错场景。** 同参数重发是**概率性失败**的解药;`finish_reason=length` 是**确定性失败** —— 重发 100 次还是 length。我没修好失败,只是把它乘以了 9。
3. **没查传输层就套循环。** `openrouter-shared.ts:416` 早有内层重发,options 里本就有 `max_attempts`(`:98`)。

---

## 一、改动清单

| # | 文件 | 位置 | 一句话 |
|---|---|---|---|
| P1 | `lib/base-analysis/generate-core-judgments.ts` | 242 | `max_tokens: 900 → 4000`(上限,不是预付) |
| P2 | 同上 | 279-287 | 外层不再重试 `openrouter_empty_after_resend`(终态) |
| P3 | 同上 | 250 后 | `finish_reason==="length"` 响亮告警 |
| P4 | 同上 | 228-292 | 总超时兜底 —— 绝不拖住叙事流 |
| P5 | `scripts/test-core-judgments-budget.ts` | 新建 | 守卫:预算够 + 不双层重发 |
| P6 | `package.json` | scripts | 挂 `test:cj-budget` |

---

## 二、Patch

### P0 · import(P2/P4 需要)

`generate-core-judgments.ts:15-17`

**Before**
```ts
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";
```
**After**
```ts
import {
  openRouterChatCompletion,
} from "@/lib/llm/openrouter-shared";
import { isEmptyResponseError } from "@/lib/llm/openrouter-retry";
```

---

### P1 + P3 + P4 · 整个 `generateCoreJudgmentsForProfile` 换掉

`generate-core-judgments.ts:228-292`(从 `const refs = buildCoreJudgmentsRefsFromStructured` 到函数结尾的 `return { judgments: fallback, source: "template_fallback" };` + `}`)

**After —— 整段替换**

```ts
  const refs = buildCoreJudgmentsRefsFromStructured(input.structured);
  const climate_now = buildClimateNowFromStructured(input.structured, input.locale);
  const fallback = buildCoreJudgmentsFromStructured(input.structured, input.locale);

  // 总超时:core_judgments 是 Layer1 给机器的,它失败【不该】让用户看不到 Layer2 报告。
  // route.ts:188 目前是 await 在叙事流【之前】的 —— 在改成并行之前,这道闸是页面不卡死的唯一保证。
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new Error("core_judgments_total_timeout")),
    CORE_JUDGMENTS_TOTAL_TIMEOUT_MS,
  );
  input.signal?.addEventListener("abort", () => ctrl.abort(input.signal?.reason), { once: true });
  const deadline = Date.now() + CORE_JUDGMENTS_TOTAL_TIMEOUT_MS;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (Date.now() > deadline) {
        console.warn(
          `[core_judgments] 总超时用尽(attempt ${attempt}/${MAX_ATTEMPTS})—— 落代码模板,绝不拖住叙事流。`,
        );
        break;
      }
      try {
        const { system, user } = buildCoreJudgmentsLlmPrompt(input.structured, input.locale);
        const result = await openRouterChatCompletion({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.35,
          max_tokens: CORE_JUDGMENTS_MAX_TOKENS,
          json_mode: true,
          reasoning_effort: "medium",
          session_id: input.session_id,
          call_type: "core_judgments",
          phase_name: "core_judgments_medium",
          signal: ctrl.signal,
        });

        // 【确定性失败】必须响亮 —— 这是 2026-07 那次「7 次调用 + 页面卡死」的唯一真信号,
        // 当时它被 "call failed" 那句糊掉了整整一轮排查(铁律 #5)。
        if (result.finish_reason === "length") {
          console.warn(
            `[core_judgments] ⚠️ finish_reason=length —— max_tokens(${CORE_JUDGMENTS_MAX_TOKENS}) 被吃光。` +
              `这是【确定性失败】:同参数重发多少次都还是 length。要【加预算】,不是加重试。`,
            { text_preview: (result.text ?? "").slice(0, 80) },
          );
        }

        const interpretive = parseLlmInterpretiveJson(result.text ?? "");
        if (!interpretive) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — parse failed, resending same params`,
            { finish_reason: result.finish_reason },
          );
          continue;
        }
        if (hasCoreJudgmentsBlackspeak(Object.values(interpretive).join("\n"))) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — blackspeak, resending same params`,
          );
          continue;
        }
        const copy = looksCopiedFromPromptOrTemplate(interpretive, fallback);
        if (copy.copied) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — 疑似照抄/套话,同参数重发`,
            { hits: copy.hits },
          );
          continue;
        }
        const merged: CoreJudgments = { ...interpretive, climate_now, refs };
        if (!isCoreJudgments(merged)) {
          console.warn(
            `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — shape invalid, resending same params`,
          );
          continue;
        }
        return { judgments: merged, source: "llm" };
      } catch (e) {
        // 传输层(openrouter-shared.ts:416)已经同参数重发过 MAX_EMPTY_CONTENT_RESEND=3 次了。
        // 外层【绝不能】再套一圈 —— 那不是"重试",那是把 3 次变成 9 次(实测就是这么烧出 7 次调用的)。
        // 连续空回复 = 确定性失败(多半 max_tokens 不够,reasoning 吃光预算),重发解决不了。
        if (isEmptyResponseError(e)) {
          console.warn(
            "[core_judgments] 传输层重发已用尽(openrouter_empty_after_resend)—— 外层不再重试,直接落模板。" +
              "【多半是 max_tokens 不够,先查 finish_reason 是不是 length,别加重试。】",
          );
          break;
        }
        if (ctrl.signal.aborted) {
          console.warn("[core_judgments] 已中止(超时或上游取消)—— 落模板。");
          break;
        }
        console.warn(
          `[core_judgments] attempt ${attempt}/${MAX_ATTEMPTS} — call failed, resending same params`,
          { reason: e instanceof Error ? e.message : String(e) },
        );
      }
    }
  } finally {
    clearTimeout(timer);
  }

  console.warn(
    "[fallback] core_judgments 落代码模板。**这份底座是套话,四产品都会受影响** —— 别当正常情况放过。",
  );
  return { judgments: fallback, source: "template_fallback" };
}
```

### P1 常量 · 放在 `LLM_INTERPRETIVE_KEYS`(约 :20)**上方**

```ts
/**
 * 预算按【真实胃口】给,不按想当然(铁律 #7 —— 我已经在 90s超时 / 12000token / max_attempts:1 上栽过三次)。
 *
 * 900 是「照抄时代」的数:当时提示词里有 4 条正例,模型抄一遍几乎不用 reasoning。
 * 正例删掉后它开始【真推导】,而 reasoning token 是【计入 max_tokens 的】——
 * 实测 7 次调用 output 全部卡死在 900、finish_reason 全部 length、content 一个字都没吐。
 *
 * 对照同仓基线:底座叙事 10,000(route.ts:212)、违规修补 1,400(repair-violations.ts:215)。
 * max_tokens 是【上限不是预付】—— 给宽不花钱,给窄会把整条链锁死。
 */
const CORE_JUDGMENTS_MAX_TOKENS = 4000;

/** 外层重试次数。注意:传输层自己还有 MAX_EMPTY_CONTENT_RESEND=3,两层会相乘 —— 见下方 catch。 */
const MAX_ATTEMPTS = 3;

/** core_judgments 失败不该让用户看不到报告 —— route.ts:188 目前 await 在叙事流之前。 */
const CORE_JUDGMENTS_TOTAL_TIMEOUT_MS = 45_000;
```

> 原来在函数体里的 `const MAX_ATTEMPTS = 3;`(:232)**删掉**,提到模块级。

---

### P5 · 新建 `scripts/test-core-judgments-budget.ts`

```ts
/**
 * core_judgments 预算 + 重发层数 · 守卫
 *   pnpm exec tsx scripts/test-core-judgments-budget.ts
 *
 * 守的是 2026-07 那次事故:删正例 → 模型真推导 → reasoning 吃光 max_tokens(900)
 * → finish_reason=length → 空 content → 传输层重发 3 次 × 外层 3 次 = 9 次 → 页面卡死。
 */
import fs from "node:fs";
import path from "node:path";
import { MAX_EMPTY_CONTENT_RESEND } from "@/lib/llm/openrouter-retry";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

function main(): void {
  console.log("\n===== core_judgments · 预算与重发层数 =====\n");
  const src = read("lib/base-analysis/generate-core-judgments.ts");

  // ① 预算必须够真推导(900 是照抄时代的数)
  const m = src.match(/CORE_JUDGMENTS_MAX_TOKENS\s*=\s*([\d_]+)/);
  const budget = m ? Number(m[1]!.replace(/_/g, "")) : 0;
  assert(`max_tokens 常量存在(实得 ${budget})`, budget > 0);
  assert(`max_tokens ≥ 3000(reasoning 计入预算)`, budget >= 3000);
  assert("函数里不再硬写 max_tokens: 900", !/max_tokens:\s*900/.test(src));

  // ② 不许两层重发相乘
  assert("外层遇 empty_after_resend 不再重试", src.includes("isEmptyResponseError"));
  assert("catch 里有 break(终态)", /isEmptyResponseError[\s\S]{0,400}break;/.test(src));
  console.log(`  · 传输层内层重发 = ${MAX_EMPTY_CONTENT_RESEND} 次(openrouter-retry.ts)——外层不得再乘`);

  // ③ 确定性失败必须响亮
  assert('finish_reason=length 有告警', src.includes('finish_reason === "length"'));
  assert("parse 失败时把 finish_reason 一起打出来", /parse failed[\s\S]{0,160}finish_reason/.test(src));

  // ④ 不许拖住叙事流
  assert("有总超时", src.includes("CORE_JUDGMENTS_TOTAL_TIMEOUT_MS"));
  assert("超时用 AbortController 硬中止", src.includes("ctrl.abort"));

  // ⑤ 上一份补丁不能被这次改坏
  assert("照抄门禁还在", src.includes("looksCopiedFromPromptOrTemplate"));
  assert("六字段定义还在", /identity_anchor\s*——/.test(src));
  assert("正例没长回来", !src.includes("正例") && !/Good:/.test(src));

  console.log(
    "\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
```

### P6 · `package.json`
```json
"test:cj-budget": "tsx scripts/test-core-judgments-budget.ts",
```

---

## 三、验收

```bash
pnpm exec tsx scripts/test-core-judgments-budget.ts     # 全 PASS
pnpm exec tsx scripts/test-base-layer-no-fewshot.ts     # 仍全 PASS
pnpm exec tsx scripts/test-keepcn-bridge-ssot.ts        # 仍全 PASS
pnpm exec tsx scripts/test-poju-segment2-dual-layer.ts  # 仍全 PASS
pnpm lint && pnpm build
```

**生产验收 —— 跑一次底座,盯 OpenRouter 后台:**

1. **调用次数 = 2**(core_judgments 1 + 叙事 1)。看到 3 次以上就是还在重发,**先看 finish_reason,别急着加重试**;
2. **`Finish Reason` = `stop`,不是 `length`**;
3. **Output ≠ max_tokens**(等于上限就是又被截断了);
4. 页面**出报告**,不卡在 preparing;
5. 日志里**没有** `finish_reason=length` 告警、**没有** `落代码模板`。
   若出现 `落代码模板` —— 那份底座是套话,**四产品都会受影响,别当正常放过**。

---

## 四、这次学到的,建议加进备忘录铁律 #8

> **同参数无感重发只对【概率性失败】有效。**
> 对【确定性失败】(`finish_reason=length` / 预算不够 / 提示词自相矛盾),重发只是把一次失败乘以 N。
> **分辨方法:连续 N 次结果完全一样(同样的 output token 数、同样的 finish_reason)= 确定性失败 → 去改配置,不是加重试。**
>
> **推论:套重试循环之前,先查传输层有没有自己的重试。** `openRouterChatCompletion` 的 options 里就有 `max_attempts`(`openrouter-shared.ts:98`),内层还有 `MAX_EMPTY_CONTENT_RESEND=3`(`openrouter-retry.ts:10`)。**两层会相乘。**

---

## 五、没做(下一批)

**`route.ts:188` 的 `await` 应该并行化。** core_judgments(Layer1 给机器)和叙事(Layer2 给人)是两个互不依赖的调用,串行 await 纯粹是为了 SSE 的 `send("core_judgments")` 顺序。改成并行:叙事立刻开流,core_judgments 在后台跑完再 send —— 用户第一个字的等待时间直接砍掉一整个 medium 调用。

**本次只加超时兜住**,因为并行会动客户端的 SSE 事件顺序契约,得先看 `useStreamingAnalysis.ts` 是不是依赖 `core_judgments` 先到。**改一个出一片,单独一批做。**
