# POJU / pojulife — Prefix 缓存省钱工程 规范

> 本文件是**保护性规范**。任何对提示词、LLM 调用链、会话结构的改动，都**必须先读本文件**，并通过文末「改动前自检清单」。破坏本规范 = 直接推高 token 成本（多轮聊天尤其严重）。

最后更新：2026-06 · 适用模型：`deepseek/deepseek-v4-pro`（经 OpenRouter）

---

## 1. 这个功能是什么

DeepSeek 在 OpenRouter 上支持 **prefix 缓存（前缀缓存）**：当一次请求的**输入前缀**与之前某次请求**逐 token 相同**时，相同的那段前缀按缓存价计费（远低于全价），只有「新增/变化的部分 + 输出」按全价算。

对 POJU 这种**多轮聊天**，每轮都重发「系统提示词（含命主 base_analysis 大块）+ 全部历史消息」。如果前缀能命中缓存，第 2 轮起省下的就是整个系统提示词的钱。这就是「省钱工程」。

**命中需要同时满足三件事：**
1. **同一上游供应商**（`OPENROUTER_PROVIDER_ONLY` → `provider.only` + `allow_fallbacks: false`；`session_id` body 参数**不**钉供应商）。
2. **前缀逐 token 相同**（靠提示词「静态在前、动态在后」）。
3. **缓存未过期**（供应商侧 TTL，分钟级，非永久）。

---

## 2. 管线（已实现，勿破坏）

| 环节 | 位置 | 作用 |
|---|---|---|
| 供应商钉选 | `openRouterProviderExtras()` ← `OPENROUTER_PROVIDER_ONLY` | `provider.only` + `allow_fallbacks: false`，同 session 固定上游 |
| session key | `openRouterRequestExtras(session_id)` + `cache-session-id.ts` | 请求体 `session_id`（观测/分组；**不**钉供应商） |
| provider 黑名单 | `OPENROUTER_PROVIDER_IGNORE` | 与 ONLY 合并为 `ignore` |
| 命中观测 | `openRouterChatCompletion()` → `logOpenRouterPrefixCacheMetrics` | `[openrouter] prefix cache HIT/Miss cached=… ratio=…` |

### 各产品 session key（`cache-session-id.ts`）
| 产品 | 函数 | key 形态 |
|---|---|---|
| POJU 聊天 | `pojuCacheSessionId(sessionId)` | `<sessionId>` |
| POJU base-analysis | `baseAnalysisCacheSessionId(profileId)` | `base-analysis-<profileId>` |
| Glyph | `glyphCacheSessionId(readingId, profileId)` | `glyph-<readingId>` / `glyph-profile-<profileId>` |
| Match | `matchCacheSessionId(aId, bId)` | `match-<小id>-<大id>`（排序后，保证对称稳定） |
| Syncro | `syncroProfileCacheSessionId` / `syncroBatchCacheSessionId` | `syncro-profile-<id>` / `syncro-<id>-<computeStartedAt>` |

---

## 3. 不可破坏的核心不变量（INVARIANTS）

### INV-1 系统提示词「静态在前，动态在后」
缓存只匹配「从第 0 token 起的最长公共前缀」。**任何每轮会变的内容，必须排在系统提示词的最后，或下沉到 user 消息**。变化点越靠前，可缓存前缀越短。

当前 POJU 拼接顺序（`oriental-prompt-context.ts` → `buildPojuSystemPrompt`）：
```
1 buildPojuCorePromptSections()      ← 静态（身份/语气/排版/方法/政策/守则）✓
2 buildCurrentDateContext(new Date()) ← 仅日期，当天稳定，每天午夜重置一次 ⚠
3 langDirective.directive            ← 同语言对话时稳定；语言切换才变 ⚠
4 buildNorthAmericaAdaptation(locale) ← 按 locale 静态 ✓
5 buildProfileContextSection(base)    ← 最贵的稳定大块（命盘 + base_analysis）✓
6 injectionBlock                      ← 多为空 ✓
7 taskBlock                           ← 每轮全变 ✗（必须在最后）
```
**目标架构（推荐演进）**：系统提示词只保留 1/4/5/6（逐轮恒定）；把 2/3/7 + 已收集上下文/议程 全部下沉到**最后一条 user 消息**。这样系统提示词在所有轮次、所有 phase **逐字节相同** → 可缓存前缀最长、对 phase 切换免疫。

### INV-2 `base_analysis` 每个 session 内逐字节一致
- `formatBaseAnalysisForPrompt` 内 `JSON.stringify(structured)` 键序必须稳定（用插入序，勿重排）。
- `display_text` 不要每轮重生成；**session 内固定快照一次，后续轮复用**。
- 客户端每轮把 `base_analysis` 放进请求体时，发**同一份对象**，不得有空白/字段差异。

### INV-3 供应商钉选 + `session_id` 稳定
- 生产环境设 **`OPENROUTER_PROVIDER_ONLY`**（如 `DeepSeek` / `Novita` / `SiliconFlow`）——DeepSeek 前缀缓存**按供应商独立**，每轮换节点 = 永远 miss。
- `session_id` 用 `cache-session-id.ts` 生成器，**勿在路径间用不同 key**；保留用于观测，**不依赖它钉供应商**。
  - ⚠ 已知不一致：POJU **phase 路径**当前传原始 `session.session_id`，**legacy 路径**用 `pojuCacheSessionId(...)`。应统一为 `pojuCacheSessionId(...)`。
- `OPENROUTER_PROVIDER_IGNORE` 可与 ONLY 合并（ONLY 优先：`allow_fallbacks: false`）。

### INV-4 不要轻易改动「静态头」
对 `buildPojuCorePromptSections()` 及其子块（identity / plainspeak / `READING_LAYOUT_CONTRACT` / 方法 / 政策 / 品牌 / 守则 / grammar polish）的**任何字符改动或重排**，都会让**所有现存缓存一次性失效**。改动是允许的，但要知道代价：上线后需要每个 session 重新预热第 1 轮。**不要为微小措辞频繁动静态头。**

### INV-5 静态头内不得混入动态内容
静态头里**禁止**出现：时间戳/日期、随机示例、`Set`/`Map` 非确定顺序拼接、按本轮 user 输入变化的文本。任何这类内容会让「看似静态」的头其实每轮都变 → 前缀从该点断裂。

### INV-6 认清 TTL（这不是 bug）
供应商侧前缀缓存是**临时的（分钟级）**。多轮之间若间隔过长（用户思考/打字几分钟），缓存自然过期 → 第 2 轮 miss。**这是预期行为**，提示词怎么优化都消不掉。要更高命中率只能靠：缩短轮间隔 / 保活 / 接受现实。

---

## 4. 为什么「理论上第 2 轮该命中却没命中」——排查顺序

1. **看日志** `[openrouter] cache hit: cached_tokens=…`：
   - 有但偏小 → INV-1 结构问题（分叉点偏前），按目标架构下沉动态内容。
   - 完全没有 + 两轮间隔短 → 多半是「刚改过静态头（INV-4 一次性失效）」或 INV-2 base_analysis 每轮不一致。
   - 完全没有 + 两轮间隔几分钟 → INV-6 TTL 过期，非 bug。
2. **确认供应商**：`OPENROUTER_PROVIDER_ONLY` 是否已设；同 session 连发 3 轮日志里供应商名应恒定。
3. **确认 `provider.only` 生效**（INV-3）；未设 ONLY 时 OpenRouter 会在多供应商间轮转 → 缓存永远 miss。

---

## 5. 改动前自检清单（每次改提示词/调用链前过一遍）

- [ ] 我新增/改动的内容是**静态**的吗？若是动态（按轮/按用户/按时间变），是否放在了系统提示词**最后**或 user 消息里？
- [ ] 我有没有往**静态头**里插入动态内容（日期、随机、Set 顺序、按 user 输入变的文本）？（违反 INV-5）
- [ ] `base_analysis` 是否仍逐字节一致、session 内快照复用？（INV-2）
- [ ] `OPENROUTER_PROVIDER_ONLY` 是否已配置、同 session 供应商恒定？（INV-3）
- [ ] `session_id` 生成器是否仍一致？（INV-3）
- [ ] 我是否改了静态头、知道会一次性失效全部缓存？是否必要？（INV-4）
- [ ] 上线后是否看 `cached_tokens` 日志确认命中率没退化？

---

## 6. 验收

- 同一 session 多轮、跨 phase，**系统提示词字符串 byte 级相等**（建议加单测：两轮 system 相等）。
- 第 2 轮起（轮间隔短时）`cached_tokens` 显著 > 0，接近系统提示词 token 量。
- 动态内容（日期/语言/任务/议程/已收集上下文）只出现在 user 消息侧。
