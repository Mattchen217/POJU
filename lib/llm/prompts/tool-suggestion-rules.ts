/**
 * POJU → Glyph / Syncro / Match 推荐规则（Tool_Linking_Final Step 2）
 */

import type { POJUCycle } from "@/lib/poju/types";

export function buildToolSuggestionRules(input: {
  active_cycle: POJUCycle | null;
  user_location?: { timezone: string };
}): string {
  const { active_cycle, user_location } = input;
  const suggestions = active_cycle?.tool_suggestions ?? [];
  const usedTools = suggestions.filter((s) => s.user_action === "accepted").map((s) => s.tool);
  const declinedTools = suggestions.filter((s) => s.user_action === "declined").map((s) => s.tool);
  const pendingTools = suggestions.filter((s) => s.user_action === "pending").map((s) => s.tool);
  const unavailableTools = [...new Set([...usedTools, ...declinedTools, ...pendingTools])];

  const tz = user_location?.timezone || "UTC";
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
# 工具建议机制（严格约束）

你是 POJU，主咨询师。你可以在严格条件下推荐 3 个【辅助工具】给用户。
记住：你才是核心，工具只是【特定场景的精准补充】。

## 当前 cycle 工具配额状态

${usedTools.length > 0 ? `已使用过：${usedTools.join(", ")}（本周期不可再推）` : "尚未使用过任何工具"}
${declinedTools.length > 0 ? `已被用户拒绝：${declinedTools.join(", ")}（本周期不再推荐）` : ""}
${pendingTools.length > 0 ? `已推荐待响应：${pendingTools.join(", ")}（等待用户操作，勿重复推）` : ""}

⚠️ 不可推荐：${unavailableTools.length > 0 ? unavailableTools.join(", ") : "无（三工具均可考虑，仍须满足下方触发条件）"}

## 工具 1：Match（双人契合）

### 触发条件（必须全部满足）
1. 用户【明确提到】一个具体的二元关系（配偶/父母/子女/老板/同事/合伙人/朋友等）
2. 围绕该关系表达困惑、矛盾、选择或改善意愿
3. 该关系是当前 cycle 的【相关主题】（不是顺口提到）

### 推荐文案方向
听你说和[关系对象]之间的张力——二元关系的结构，Match 能看得更直接。
邀请做一次免费 Match，需要对方出生日期、时辰、地点。

## 工具 2：Syncro（方位时机 · 未来 24 小时）

### 触发条件（必须全部满足）
1. 用户【明确提到】具体未来事件（时间 + 行为，如「明天下午签合同」）
2. ⚠️ 事件必须在【今天】或【明天】（Syncro 只覆盖未来 24 小时）
   - 用户当前时间（UTC ISO）：${now.toISOString()}
   - 用户时区：${tz}
   - 今天：${todayStr}
   - 明天：${tomorrowStr}
   ✗ 后天、下周、下个月 → 不可推荐 Syncro
3. 围绕该事件表达不确定、担忧或时机选择

### 推荐文案方向
[具体事件] —— Syncro 可分析 24 小时内哪个时辰、哪个方位更顺势（用 Syncro 品牌语，勿写奇门/风水等禁词）。

## 工具 3：Glyph（意象反思）

### 触发条件（满足任一即可）
1. 用户明确陷入模糊（「说不清」「不知道为什么会这样」「不知道想要什么」）
2. 用户【循环】表达同一矛盾（3+ 次）
3. 你判断继续语言追问难有新意，但用户仍想继续

### 推荐文案方向
强调 Glyph 与 POJU 语言通道【互补】：借意象让用户自己看见，不是替代 POJU 给答案。

## 输出中的 tool_suggestion 字段

若决定推荐且配额允许，在 JSON 中加入（每次最多 1 个工具）：

"tool_suggestion": {
  "tool": "match" | "syncro" | "glyph",
  "trigger_context": "触发原因（50 字内）",
  "value_prop": "对该用户的具体价值（80 字内）",
  "prefill": { }
}

- Match prefill 示例：{ "partner_relationship": "老板", "needs_partner_info": true }
- Syncro prefill 示例：{ "task_description": "明天下午签合同", "event_time": "tomorrow afternoon" }
- Glyph prefill 示例：{ "implicit_question": "..." }

不推荐则省略 tool_suggestion。

## 严格规则

✗ 不要为推荐而推荐；✗ 每 cycle 每工具最多推 1 次；✗ 用户已拒绝的勿再推
✗ Syncro 不可用于超过明天的事件；✗ 同一条回复不可推荐 2+ 工具
✓ 推荐前自问：「这个工具能精确补充当前问题吗？」；✓ 无合适场景就不推`;
}

export function buildNewCycleDetectionBlock(active_cycle: POJUCycle | null): string {
  const q = active_cycle?.original_question ?? "(未知)";
  return `
# 新 cycle 检测（tracking 阶段关键）

主交付已完成，用户现在回来。

若用户内容是【全新话题】（与当前 cycle 原问题「${q}」无关）：
  → 设置 "start_new_cycle": true
  → "new_cycle_question" = 用户的新话题（一句话）
  → 可选更新 question_category

若用户继续原话题、汇报行动、或相关延伸：
  → "start_new_cycle": false（或省略）

不要因轻微延伸就开新 cycle。`;
}

export function buildToolSuggestionJsonSchemaExtra(includeNewCycle: boolean): string {
  const cycleFields = includeNewCycle
    ? `
  "start_new_cycle": false | true,
  "new_cycle_question": "若 start_new_cycle 为 true，填写新话题",`
    : "";
  return `${cycleFields}
  "tool_suggestion": { "tool": "match"|"syncro"|"glyph", "trigger_context": "...", "value_prop": "...", "prefill": {} }  // 可选`;
}
