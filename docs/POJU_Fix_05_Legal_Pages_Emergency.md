# POJU 修复文档 #05 (最终版) · 法律页面紧急修复 🚨 P0

> **背景**: Fix 02 + Fix 04 已要求修复法律页面,但 Cursor 多次遗漏
>
> **本最终版整合 5 大改动**:
> - 🔴 Disclaimer 完整填充 (P0)
> - 🔴 主体称呼:"POJU" → "pojulife" (公司主体) ⭐ 新
> - 🔴 AI 技术叙事策略性升级 ⭐ 新
> - 🔴 第三方 LLM 隐私合规处理 ⭐ 新
> - 🔴 中文占位符 + 代码块格式 + 其他遗留
>
> **关键原则**:
> - 公司/责任主体 = `pojulife`
> - 产品名 = `POJU` / `Glyph` / `Syncro`
> - 三件套整体 = `the Services` 或 `pojulife`

---

## 关键概念厘清(给 Cursor 必读)

```
法律文档中,3 种"POJU"用法必须分开:

类型 A: 公司/品牌主体 (法律责任人)
  ✓ 用 "pojulife"
  例子:
    "pojulife is provided as is"
    "pojulife's developers are not liable"
    "pojulife uses large language models"
    "pojulife was built differently"

类型 B: 产品名(三件套之一)
  ✓ 用 "POJU"(大写)
  例子:
    "POJU Breakthrough Sessions"
    "When you start a POJU session"

类型 C: 网站/服务整体(指代 3 个产品)
  ✓ 用 "the Services" 或 "pojulife"
  例子:
    "By using the Services" (指 3 件套整体)
```

---

## Phase 1: Disclaimer 完整填充 🔴🔴🔴

### 当前状态
访问 `/disclaimer` 页面**完全空白**,只有 Header + Footer。

### 必须填充以下完整内容(已升级主体称呼 + AI 技术叙事)

```markdown
Version 1.0

# Important Disclaimer

*Last updated: October 30, 2025*

pojulife is an AI-powered platform offering tools for 
self-reflection, decision support, and rhythm awareness. 
This page explains what pojulife is — and what it is not.

---

## What pojulife does

pojulife uses advanced language models to generate structured 
reflection reports and conversations across three tools:

- **POJU** — Deep conversations for hard questions
- **Glyph** — Quick reflections through archetypal patterns
- **Syncro** — Daily rhythm awareness

These tools integrate:

- Decision psychology research
- Behavioral economics frameworks
- Philosophical traditions (including Eastern philosophy)
- Mindfulness and time-perception research

The reports and conversations are designed to help you:

- Look at a question from new angles
- Notice patterns in your situation
- Consider actions you may not have considered
- Reflect on what matters

---

## What pojulife does NOT do

pojulife does NOT provide:

**Predictions about your future**  
pojulife is not a fortune-teller. The patterns and 
frameworks describe common human situations, not future 
events.

**Medical advice**  
If you have health concerns, please consult a licensed 
medical professional. pojulife's reflections cannot 
replace medical evaluation.

**Mental health treatment**  
If you're experiencing suicidal thoughts, severe anxiety, 
depression, or other mental health crises, please contact:

- US: 988 (Suicide & Crisis Lifeline) — available 24/7
- Worldwide: findahelpline.com

pojulife is for self-reflection, not therapy.

**Legal advice**  
For legal matters, consult a licensed attorney in your 
jurisdiction.

**Financial advice**  
For investment, tax, or financial planning, consult a 
certified financial advisor.

**Spiritual or religious guidance**  
pojulife references philosophical traditions as frameworks 
for thinking, not as religious teaching or spiritual 
authority.

---

## How to read pojulife's outputs

pojulife's outputs are best treated as:

- **One perspective among many** — not the only correct view
- **A starting point for reflection** — not a conclusion
- **A thinking tool** — not a decision-maker
- **Educational and reflective** — not authoritative

The decisions in your life remain entirely yours. You are 
the only person who can decide what's right for you.

---

## On AI technology

pojulife is powered by advanced language models built on 
the Transformer architecture — the foundational technology 
behind modern AI systems.

Our service integrates leading large language models from 
multiple providers, including Anthropic's Claude, OpenAI's 
GPT, and Google's Gemini, depending on the task and quality 
requirements.

Our core value lies not in any single AI model, but in:

- The integration of philosophical frameworks with modern 
  decision science
- The proprietary knowledge architecture refined over 
  thousands of hours
- The conversational design that adapts to your specific 
  question and moment
- The careful prompt engineering that produces grounded, 
  reflective responses rather than generic answers

While we strive for high quality, please note:

- AI can make factual errors
- AI may misinterpret cultural or historical references
- AI does not "understand" your situation the way a human 
  friend or counselor would
- AI outputs should not be trusted as definitive

Always apply your own judgment to what pojulife generates.

---

## On framework references

pojulife references philosophical and psychological 
traditions including:

- Eastern philosophical frameworks (archetypal patterns, 
  contemplative practices, temporal observations)
- Decision psychology
- Behavioral economics
- Mindfulness research

These are referenced as **research subjects and frameworks 
for thinking**, not as belief systems pojulife endorses or 
claims authority over.

pojulife does not predict outcomes based on these traditions. 
We use them as one of several frameworks the AI considers 
when generating reflection reports and conversations.

---

## Liability limitation

pojulife is provided "as is" for entertainment, educational, 
and reflection purposes.

By using pojulife, you acknowledge:

- You are solely responsible for decisions you make
- pojulife's developers are not liable for outcomes 
  resulting from your decisions
- You will not use pojulife as a substitute for 
  professional advice in medical, legal, financial, or 
  mental health matters

---

## Questions

If you're unsure how to interpret a pojulife output:  
support@easternos.com

If you're in distress:  
988 (US) or findahelpline.com (worldwide)
```

---

## Phase 2: Privacy Policy 修复 🔴🔴

### Task 2.1: 主体称呼升级

**审视所有【公司主体】指代,改为 `pojulife`**:

```diff
- POJU was built differently.
+ pojulife was built differently.

- We're not a company that sells data because we don't 
- collect data.
+ pojulife is not a company that sells data because we 
+ don't collect data.
```

(逐句审视,确保每个【作为主语的 POJU】都改为 `pojulife`)

### Task 2.2: 修复中文占位符

```diff
- Last updated: [日期]
+ Last updated: October 30, 2025

- Physical address (if required by your jurisdiction):
- [待律师确定后填入]
+ [整段删除 — 早期个人开发者不需要物理地址]
```

### Task 2.3: 删除所有 ``` ``` 代码块格式

**重要**: 当前页面有【至少 12 处】 ``` ``` 代码块,必须全部转为正常 markdown。

#### 转换示例:第 1 节

```diff
- ## 1. What We Collect
- 
- ```
- Minimal, by design:
- 
- · Device fingerprint (one-way hash)
-   Used to restore your paid session if you refresh.
- ```

+ ## 1. What We Collect
+ 
+ Minimal, by design:
+ 
+ - **Device fingerprint** (one-way hash) — Used to restore 
+   your paid session if you refresh.
+ 
+ - **Payment records** (no personal info) — Amount, 
+   timestamp, payment processor session ID. Kept for 
+   7 years for tax compliance.
+ 
+ - **Email** (only when you explicitly provide it) — Used 
+   to deliver PDF readings. Deleted within 24 hours after 
+   sending.
+ 
+ - **Aggregated usage stats** (anonymous) — Total sessions, 
+   not per-user behavior.
```

**对所有章节(1-12)做同样处理**:删除 ``` ``` ,改为标准 markdown。

### Task 2.4: 修复支付处理器表述

```diff
- · Payment is handled by Stripe (or an alternative processor).

+ · Payment is handled by our payment processor (currently 
+   DodoPayments, with Stripe planned as we grow).
```

```diff
- · Payment records (no personal info)
-   Amount, timestamp, Stripe session ID.

+ · Payment records (no personal info) — Amount, timestamp, 
+   payment processor session ID. Kept for 7 years for tax 
+   compliance.
```

### Task 2.5: 简化第 11 节 Contact

```diff
- ## 11. Contact
- 
- ```
- For privacy questions:
- privacy@easternos.com
- 
- For general questions:
- support@easternos.com
- 
- For legal matters:
- legal@easternos.com
- 
- Physical address (if required by your jurisdiction):
- [待律师确定后填入]
- ```

+ ## 11. Contact
+ 
+ For privacy questions: privacy@easternos.com  
+ For general questions: support@easternos.com  
+ For legal matters: legal@easternos.com
```

### Task 2.6: 第 9 节 CCPA 标题简化

```diff
- ## 9. Your Rights (CCPA — California Residents)
+ ## 9. Your Rights (California Residents)
```

### Task 2.7: 第 7 节 AI Model Data Handling 完整重写 ⭐⭐⭐ 关键

**当前内容删除,替换为以下完整新版本**:

```markdown
## 7. AI Model Data Handling

When you use pojulife, your conversations are processed 
by AI models from leading providers, depending on the 
specific task and quality requirements:

- **Anthropic Claude** — Primary model for POJU sessions 
  and Glyph reflections
- **OpenAI GPT** — May be used for embedding (knowledge 
  base vectorization) and supplementary tasks
- **Google Gemini** — May be used as a fallback or for 
  specialized tasks

### What this means for your data

While **pojulife does not store your conversations** 
(they live encrypted on your device), your inputs are 
transmitted to these AI providers for processing. This 
is unavoidable — the AI cannot generate responses without 
receiving your inputs.

### How we minimize this

We have configured the following protections:

- **Zero Data Retention (ZDR)** is enabled on Anthropic's 
  Claude API. This is a paid contractual guarantee that 
  Anthropic does not save your API requests or responses, 
  does not use them for training, and does not allow human 
  review.

- **No training on your data**: We have opted out of any 
  data sharing for AI model training across all providers 
  we use.

- **Minimum data principle**: We send only what's needed 
  for the specific task. Your name, email, and other 
  personal identifiers are never sent to AI providers.

### Third-party privacy policies

When pojulife uses an AI provider's service, that 
provider's privacy policy applies to the API transaction:

- Anthropic Privacy Policy: https://www.anthropic.com/privacy
- OpenAI Privacy Policy: https://openai.com/privacy/
- Google Privacy Policy: https://policies.google.com/privacy

We choose providers with strong privacy commitments and 
configure each integration with the strictest available 
privacy settings.

### Your trust matters

pojulife doesn't store your data because we don't need to. 
We choose AI providers carefully because we know your 
inputs flow through them. We pay extra for ZDR contracts 
because your privacy is the entire foundation of pojulife.
```

### Task 2.8: 第 6 节第三方服务列表精简

**当前列出的 8 个第三方,需精简**:

```diff
- ## 6. Third-Party Services
- 
- ```
- Services we use and their privacy policies:
- 
- · Anthropic (Claude API) ...
- · OpenAI ...
- · ElevenLabs ...
- · Stripe ...
- · Resend ...
- · Vercel ...
- · Supabase ...
- · FingerprintJS ...
- ```

+ ## 6. Third-Party Services
+ 
+ pojulife uses a minimal set of third-party services to 
+ deliver the product. Each is chosen for strong privacy 
+ practices, and we configure each integration with the 
+ strictest available privacy settings.
+ 
+ - **AI providers** — See Section 7 for details on AI 
+   model data handling
+ 
+ - **DodoPayments** — Payment processing. They handle your 
+   payment method; we never see card details.  
+   Privacy: https://dodopayments.com/privacy
+ 
+ - **Vercel** — Hosting. Standard web server logs (IP, 
+   user agent, URL) for delivery and security.  
+   Privacy: https://vercel.com/legal/privacy-policy
+ 
+ - **Resend** — Email delivery (planned, when you request 
+   PDFs). Auto-deletes messages after 30 days.  
+   Privacy: https://resend.com/legal/privacy-policy
+ 
+ Additional services may be added as we grow. We will 
+ update this list and notify users of material changes.
```

(删除 OpenAI / ElevenLabs / Stripe / Supabase / FingerprintJS 单独条目,因为实际不一定都用)

---

## Phase 3: Terms of Service 修复 🔴🔴

### Task 3.1: 主体称呼升级

```diff
- POJU provides AI-powered insights drawing from 
- Eastern philosophical traditions.

+ pojulife provides AI-powered decision support drawing 
+ from philosophical and psychological frameworks 
+ (including Eastern philosophy, decision psychology, 
+ and behavioral economics).
```

```diff
- The POJU brand, logo, "Three ways in. One way through." 
- tagline, and all product interface elements are owned 
- by POJU.

+ The pojulife brand, logo, "Three ways in. One way through." 
+ tagline, and all product interface elements are owned by 
+ pojulife.
```

### Task 3.2: 修复中文占位符

```diff
- Last updated: [日期]
+ Last updated: October 30, 2025

- These Terms are governed by the laws of [州名待律师确定，
- 推荐 Delaware], United States...
+ These Terms are governed by the laws of the State of 
+ Delaware, United States...

- Any disputes will be resolved in the courts of [地点待律师].
+ Any disputes will be resolved in the courts of Delaware.
```

### Task 3.3: 删除所有 ``` ``` 代码块格式

同 Phase 2,把所有 ``` ``` 改为标准 markdown。

### Task 3.4: 第 2 节"Eastern philosophical texts"优化

```diff
- All outputs are generated by AI models trained on 
- Eastern philosophical texts and modern research.

+ All outputs are generated by AI models that integrate 
+ philosophical frameworks, psychological research, and 
+ decision science.
```

### Task 3.5: 第 3 节支付处理器更新

```diff
- · Payment is handled by Stripe (or an alternative 
-   processor). We never see your card details.

+ · Payment is handled by our payment processor. We never 
+   see your card details.
```

### Task 3.6: 第 3 节 Session 期限修复 ⭐ 重要

```diff
- Your POJU Session, once purchased, stays accessible on 
- your device until you manually end it. There is no 
- expiration.

+ Your POJU Session is accessible for 30 days from 
+ purchase. You can return anytime within that window 
+ to continue your conversation. After 30 days, the 
+ conversation content is automatically deleted (your 
+ order record remains for tax compliance).
```

### Task 3.7: 第 4 节加入 5-minute refund window ⭐

```diff
- ## 4. Refunds
- 
- We offer refunds under the following conditions:
- 
- · Technical failure prevented you from accessing your 
-   Session: full refund within 7 days of purchase
- · You have not yet started the conversation: full refund 
-   within 24 hours
- · Duplicate charge (paid twice by mistake): full refund

+ ## 4. Refunds
+ 
+ We offer refunds under the following conditions:
+ 
+ **5-minute window: Automatic full refund**  
+ Click "Refund" within 5 minutes of starting your session 
+ for an immediate full refund. No questions asked.
+ 
+ **Technical failure**  
+ If a technical issue prevented you from accessing your 
+ Session: full refund within 7 days of purchase.
+ 
+ **Duplicate charge**  
+ Paid twice by mistake: full refund, immediately.
+ 
+ **Unstarted session**  
+ Full refund within 24 hours if you have not yet started 
+ the conversation.
```

---

## Phase 4: Contact 页面小升级

### Task 4.1: 标题升级

```diff
- # Contact POJU
+ # Contact pojulife
```

### Task 4.2: 引言句保持

```
"We're a small team. Every email is read and answered 
 by a real person."
```

(已经 OK,不需要改)

### Task 4.3: Logo 升级

```diff
- POJU LIFE  (大写,Header logo)
+ pojulife    (小写)
```

---

## Phase 5: 全站 Footer 品牌升级

### 任务: 所有页面统一

```diff
- POJU
- easternos.com
- 
- ...links...
- 
- © 2026 POJU. All rights reserved.

+ pojulife
+ easternos.com
+ 
+ ...links...
+ 
+ © 2026 pojulife. All rights reserved.
```

注意:
- "POJU" → "pojulife" (品牌名)
- 全小写
- 不要写成 "PojuLife" 或 "POJU LIFE"

---

## 给 Cursor 的最终执行指令

```markdown
# 任务: POJU Fix 05 (最终版) - 法律页面紧急修复

## 阅读
@docs/POJU_Fix_05_Legal_Pages_Emergency.md (本文档)

## 关键概念

3 种"POJU"用法必须分开:
  - 公司主体 → "pojulife"
  - 产品名 → "POJU"(大写)
  - 三件套整体 → "the Services" 或 "pojulife"

## 实施顺序

### Phase 1 (P0 - 紧急): Disclaimer 完整填充
  - /disclaimer 页面当前完全空白
  - 用本文档 Phase 1 提供的完整内容填充
  - 主体称呼用 "pojulife"
  - 包含完整的 "On AI technology" 章节
  - 用 prose 类增强排版

### Phase 2 (P0 - 紧急): Privacy Policy 修复
  - 主体称呼升级 (POJU → pojulife)
  - 修复中文占位符(2 处)
  - 删除所有 ``` ``` 代码块格式
  - 第 7 节 AI Model Data Handling 完整重写
  - 第 6 节第三方服务列表精简
  - 修复支付处理器表述
  - 第 9 节 CCPA 标题简化

### Phase 3 (P0 - 紧急): Terms of Service 修复
  - 主体称呼升级
  - 修复中文占位符(3 处)
  - 删除所有 ``` ``` 代码块格式
  - 第 1 节 + 第 2 节"Eastern philosophical"表述优化
  - 第 3 节支付处理器表述更新
  - 第 3 节 Session 期限改为 30 天
  - 第 4 节加入 5-minute refund window
  - 第 8 节 Governing Law 简化(填 Delaware)

### Phase 4: Contact 页面小升级
  - 标题: "Contact POJU" → "Contact pojulife"
  - Header logo "POJU LIFE" → "pojulife"
  - Footer logo "POJU LIFE" → "pojulife"

### Phase 5: 全站 Footer 品牌升级
  - 所有页面 Footer:
    "POJU" → "pojulife"
    "© 2026 POJU" → "© 2026 pojulife"

## 严格要求

🚫 不要保留任何中文占位符
🚫 不要保留任何 ``` ``` 代码块格式
🚫 不要把"pojulife"写成"PojuLife"或"POJU LIFE"
🚫 不要在 Disclaimer 写"I Ching"等具体典籍

✅ Disclaimer 主体用 "pojulife"
✅ 产品名 "POJU"/"Glyph"/"Syncro" 仍是大写或首字母大写
✅ AI 技术叙事强调 Transformer + 多厂商
✅ 完成后截图给我验证

## 验证清单

完成后必须检查:

Disclaimer 页面:
  □ 不再空白,有完整内容
  □ 标题: "Important Disclaimer"
  □ 主体用 "pojulife"(不是 "POJU")
  □ 包含 "On AI technology" 章节
  □ 提到 Transformer 架构
  □ 提到 Anthropic / OpenAI / Google
  □ Last updated 显示日期
  □ 没有 ``` ``` 代码块
  □ 不写 "I Ching" 等具体典籍

Privacy Policy:
  □ 没有 [日期] 中文占位符
  □ 没有 [待律师确定后填入] 中文备注
  □ 所有内容用标准 markdown
  □ 第 7 节 AI Model Data Handling 完整重写
  □ 提到 Anthropic / OpenAI / Google
  □ 强调 ZDR(Zero Data Retention)
  □ 第三方服务列表精简
  □ 第 11 节 Contact 简化

Terms of Service:
  □ 没有 [日期] 中文占位符
  □ 没有 [州名待律师确定] 中文备注
  □ 没有 [地点待律师] 中文备注
  □ 没有 ``` ``` 代码块
  □ 主体称呼升级为 "pojulife"
  □ 第 1 节 Eastern philosophical 表述已优化
  □ 第 3 节 Session 期限改为 30 天
  □ 第 4 节有 5-minute refund window
  □ 第 8 节 Governing Law: Delaware

Contact:
  □ 标题: "Contact pojulife"
  □ Logo: "pojulife"

全站:
  □ Footer 显示 "pojulife"
  □ Copyright "© 2026 pojulife"
```

---

## 完成后的合规与品牌状态

```
合规状态:
  ✅ 法律页面 100% 完成
  ✅ 主体称呼一致(pojulife)
  ✅ 中文占位符全部清除
  ✅ AI 多厂商透明披露 (GDPR 合规)
  ✅ 5-minute refund window 写入 Terms
  ✅ Session 30 天与架构一致

品牌状态:
  ✅ 技术叙事升级(Transformer + 多 LLM)
  ✅ 不依赖单一 AI 厂商
  ✅ 显得【技术更厉害】
  ✅ 用户感知:不是简单 ChatGPT 套壳

支付审核:
  ✅ 通过 DodoPayments 概率:极高
  ✅ 后期 Stripe 概率:高
```
