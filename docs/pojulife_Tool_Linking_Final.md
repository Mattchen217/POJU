# pojulife 4 工具联动机制 · 最终实施

> **目标**:
> 1. POJU → 工具(层 2):智能建议 + 配额触发
> 2. 工具 → POJU(层 3):反向回流 + 加入 cycle
> 3. POJU 内多【破局周期】机制(同 session 可以多个 cycle)
> 4. 工具完成后自动注入 POJU(下一轮对话依据)
>
> **前提**:
> - POJU v5.0 phase 系统已实施(opening → collecting → confirmation → delivery → tracking)
> - Glyph / Syncro / Match v5.1 计算引擎已完成
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务的核心:

1. POJU 升级:1 session 支持多个【破局周期】(cycle)
   - 原 v5.0:1 session = 1 困境,新困境要新 session
   - 新版本:1 session = 多 cycle,允许同主题延伸
   
2. 每个 cycle 内有独立的工具配额:
   - Glyph / Syncro / Match 各 1 次免费推荐
   - 用户拒绝 → 该 cycle 不再推
   - delivery 完成 → 进入 tracking
   - 用户提新话题(LLM 判断) → 启动新 cycle,配额重置

3. 工具触发必须【严格识别】用户意图:
   - Match:明确二元关系 + 困惑/矛盾
   - Syncro:今天或明天的具体事件(24h 窗口)
   - Glyph:用户表达模糊或对话陷入循环

4. POJU 不引用 Archive 历史数据(保护单一破局定位)
   - 只看本 session 内发生的事
   - 包括本 cycle 内触发的工具结果

5. 工具结果自动注入 POJU(无需用户确认):
   - 工具完成 → 自动作为 system message 注入
   - POJU LLM 看到,继续原话题对话
   - 不开新话题

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X" 才进入下一步
```

---

# 第 1 部分:Step 1 - 数据结构升级(cycle)

## Step 1.1: 新增 POJUCycle 类型

文件:`lib/poju/types.ts`(扩展)

```typescript
// lib/poju/types.ts

export type AgentPhase = 
  | 'opening' 
  | 'collecting' 
  | 'confirmation' 
  | 'delivery' 
  | 'delivered'
  | 'tracking';

export type ToolName = 'glyph' | 'syncro' | 'match';

/**
 * 工具推荐记录(本 cycle 内)
 */
export interface ToolSuggestion {
  tool: ToolName;
  suggested_at: string;          // ISO date
  suggested_in_message_id: string;
  trigger_context: string;        // 触发原因(LLM 给的描述)
  user_action: 'accepted' | 'declined' | 'pending';
  
  // 如果接受了,工具完成后的数据
  tool_result_id?: string;
  tool_result_data?: any;         // 工具结果的核心数据
  tool_completed_at?: string;
  injected_to_poju?: boolean;     // 是否已注入 POJU 对话
}

/**
 * 破局周期(cycle)
 * 一个 POJU session 可以有多个 cycle
 */
export interface POJUCycle {
  cycle_id: string;
  cycle_index: number;            // 1, 2, 3...
  
  // 主题
  original_question: string;
  question_category: string;
  current_summary: any;           // 用户确认的处境汇总
  
  // 时间
  started_at: string;
  delivery_completed_at?: string;
  
  // 工具配额(每个 cycle 独立)
  tool_suggestions: ToolSuggestion[];
  
  // 行动建议(delivery 输出)
  delivered_actions?: Array<{
    action_id: string;
    category: string;
    text: string;
    status: 'pending' | 'completed' | 'skipped' | 'modified';
    timing?: string;
  }>;
  
  // 状态
  is_delivered: boolean;
  is_active: boolean;             // 当前活跃 cycle
}

/**
 * POJU session 完整状态
 */
export interface POJUSessionState {
  session_id: string;
  user_id: string;
  selected_profile_id: string;
  locale: string;
  created_at: string;
  expires_at: string;             // 30 天后
  
  // 当前 phase
  current_phase: AgentPhase;
  
  // ⭐ 新增:cycles 数组
  cycles: POJUCycle[];
  active_cycle_id: string;        // 当前活跃 cycle
  
  // 消息历史(保持不变)
  messages: any[];
  
  // 完整 context(跨 cycle 共享:命主等)
  shared_context: any;
}
```

## Step 1.2: cycle 管理工具函数

文件:`lib/poju/cycle-manager.ts`(新建)

```typescript
// lib/poju/cycle-manager.ts

import { v4 as uuidv4 } from 'uuid';
import type { POJUCycle, POJUSessionState, ToolName, ToolSuggestion } from './types';

/**
 * 创建新 cycle(用户提新困境 / session 启动)
 */
export function createNewCycle(input: {
  original_question: string;
  question_category?: string;
  cycle_index: number;
}): POJUCycle {
  return {
    cycle_id: uuidv4(),
    cycle_index: input.cycle_index,
    original_question: input.original_question,
    question_category: input.question_category || 'unknown',
    current_summary: null,
    started_at: new Date().toISOString(),
    tool_suggestions: [],
    is_delivered: false,
    is_active: true
  };
}

/**
 * 获取当前活跃 cycle
 */
export function getActiveCycle(state: POJUSessionState): POJUCycle | null {
  return state.cycles.find(c => c.cycle_id === state.active_cycle_id) || null;
}

/**
 * 标记 cycle 完成 delivery
 */
export function markCycleDelivered(
  state: POJUSessionState,
  cycle_id: string,
  delivered_actions: any[]
): POJUSessionState {
  return {
    ...state,
    cycles: state.cycles.map(c => 
      c.cycle_id === cycle_id
        ? {
            ...c,
            delivery_completed_at: new Date().toISOString(),
            delivered_actions,
            is_delivered: true
          }
        : c
    )
  };
}

/**
 * 启动新 cycle(用户提新话题)
 */
export function startNewCycle(
  state: POJUSessionState,
  new_question: string,
  new_category?: string
): POJUSessionState {
  // 把所有现有 cycle 标记为不活跃
  const updatedCycles = state.cycles.map(c => ({ ...c, is_active: false }));
  
  // 创建新 cycle
  const newCycle = createNewCycle({
    original_question: new_question,
    question_category: new_category,
    cycle_index: state.cycles.length + 1
  });
  
  return {
    ...state,
    cycles: [...updatedCycles, newCycle],
    active_cycle_id: newCycle.cycle_id,
    current_phase: 'collecting'  // 回到收集阶段
  };
}

/**
 * 检查工具配额是否还有(当前 cycle 内)
 */
export function checkToolQuota(
  state: POJUSessionState,
  tool: ToolName
): {
  available: boolean;
  already_suggested: boolean;
  already_declined: boolean;
  already_used: boolean;
} {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) {
    return {
      available: false,
      already_suggested: false,
      already_declined: false,
      already_used: false
    };
  }
  
  const suggestions = activeCycle.tool_suggestions.filter(s => s.tool === tool);
  const declined = suggestions.some(s => s.user_action === 'declined');
  const used = suggestions.some(s => s.user_action === 'accepted' && s.tool_result_id);
  const suggested = suggestions.length > 0;
  
  // 已用过(配额耗尽)
  if (used) {
    return {
      available: false,
      already_suggested: true,
      already_declined: false,
      already_used: true
    };
  }
  
  // 已拒绝过(该 cycle 不再推)
  if (declined) {
    return {
      available: false,
      already_suggested: true,
      already_declined: true,
      already_used: false
    };
  }
  
  // 已推荐但用户没操作(pending)
  if (suggested) {
    return {
      available: false,  // 不再重复推
      already_suggested: true,
      already_declined: false,
      already_used: false
    };
  }
  
  return {
    available: true,
    already_suggested: false,
    already_declined: false,
    already_used: false
  };
}

/**
 * 记录工具推荐
 */
export function recordToolSuggestion(
  state: POJUSessionState,
  tool: ToolName,
  message_id: string,
  trigger_context: string
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;
  
  const suggestion: ToolSuggestion = {
    tool,
    suggested_at: new Date().toISOString(),
    suggested_in_message_id: message_id,
    trigger_context,
    user_action: 'pending'
  };
  
  return {
    ...state,
    cycles: state.cycles.map(c => 
      c.cycle_id === activeCycle.cycle_id
        ? { ...c, tool_suggestions: [...c.tool_suggestions, suggestion] }
        : c
    )
  };
}

/**
 * 记录用户对工具推荐的响应
 */
export function recordUserResponse(
  state: POJUSessionState,
  tool: ToolName,
  action: 'accepted' | 'declined'
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;
  
  // 找到该工具最新的 pending suggestion
  const updatedSuggestions = activeCycle.tool_suggestions.map((s, idx, arr) => {
    const isLatestPending = 
      s.tool === tool && 
      s.user_action === 'pending' &&
      idx === arr.length - 1 - [...arr].reverse().findIndex(x => 
        x.tool === tool && x.user_action === 'pending'
      );
    return isLatestPending ? { ...s, user_action: action } : s;
  });
  
  return {
    ...state,
    cycles: state.cycles.map(c => 
      c.cycle_id === activeCycle.cycle_id
        ? { ...c, tool_suggestions: updatedSuggestions }
        : c
    )
  };
}

/**
 * 注入工具结果到 cycle
 */
export function injectToolResult(
  state: POJUSessionState,
  tool: ToolName,
  result_id: string,
  result_data: any
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;
  
  const updatedSuggestions = activeCycle.tool_suggestions.map(s => {
    if (s.tool === tool && s.user_action === 'accepted' && !s.tool_result_id) {
      return {
        ...s,
        tool_result_id: result_id,
        tool_result_data: result_data,
        tool_completed_at: new Date().toISOString(),
        injected_to_poju: false  // 待注入
      };
    }
    return s;
  });
  
  return {
    ...state,
    cycles: state.cycles.map(c => 
      c.cycle_id === activeCycle.cycle_id
        ? { ...c, tool_suggestions: updatedSuggestions }
        : c
    )
  };
}

/**
 * 标记工具结果已注入对话
 */
export function markToolResultInjected(
  state: POJUSessionState,
  tool: ToolName,
  result_id: string
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;
  
  return {
    ...state,
    cycles: state.cycles.map(c => 
      c.cycle_id === activeCycle.cycle_id
        ? {
            ...c,
            tool_suggestions: c.tool_suggestions.map(s => 
              s.tool === tool && s.tool_result_id === result_id
                ? { ...s, injected_to_poju: true }
                : s
            )
          }
        : c
    )
  };
}
```

## Step 1.3: IndexedDB schema 升级

文件:`lib/db/poju-db.ts`(扩展 schema)

```typescript
// 添加 cycle 相关索引

const SCHEMA_VERSION = 7;  // 升级版本

db.version(SCHEMA_VERSION).stores({
  // ... 现有表
  
  poju_sessions: 'session_id, user_id, selected_profile_id, created_at, expires_at, current_phase, active_cycle_id',
  
  // ⭐ 新增 cycle 表(独立存储,方便查询)
  poju_cycles: 'cycle_id, session_id, cycle_index, is_active, is_delivered, started_at, delivery_completed_at',
  
  // ⭐ 工具推荐记录(独立表,方便统计)
  poju_tool_suggestions: 'suggestion_id, session_id, cycle_id, tool, user_action, suggested_at, tool_completed_at'
});
```

## 验证清单

```
□ types.ts 扩展 POJUCycle / ToolSuggestion
□ cycle-manager.ts 完整实现
□ 8 个 manager 函数:
  - createNewCycle / getActiveCycle
  - markCycleDelivered / startNewCycle
  - checkToolQuota / recordToolSuggestion
  - recordUserResponse / injectToolResult
□ IndexedDB schema 升级到 v7
□ 数据迁移:把现有 session 包装为有 1 个 cycle 的结构

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 工具触发逻辑(POJU LLM Prompt)

## Step 2.1: 扩展 collecting + tracking phase prompt

文件:`lib/llm/prompts/tool-suggestion-rules.ts`(新建)

```typescript
// lib/llm/prompts/tool-suggestion-rules.ts

export function buildToolSuggestionRules(input: {
  active_cycle: any;
  user_location?: { timezone: string };
}): string {
  const { active_cycle, user_location } = input;
  
  // 提取当前 cycle 已经推荐过/拒绝过的工具
  const suggestions = active_cycle?.tool_suggestions || [];
  const usedTools = suggestions.filter((s: any) => s.user_action === 'accepted').map((s: any) => s.tool);
  const declinedTools = suggestions.filter((s: any) => s.user_action === 'declined').map((s: any) => s.tool);
  const pendingTools = suggestions.filter((s: any) => s.user_action === 'pending').map((s: any) => s.tool);
  
  const unavailableTools = [...usedTools, ...declinedTools, ...pendingTools];
  
  // 计算"今天"和"明天"的日期范围(用于 Syncro 判断)
  const tz = user_location?.timezone || 'UTC';
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' });
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' });
  
  return `
# 工具建议机制(严格约束)

你是 POJU,主咨询师。你可以在严格条件下推荐 3 个【辅助工具】给用户.
但记住:你才是核心,工具只是【特定场景的精准补充】。

## 当前 cycle 工具配额状态

${usedTools.length > 0 ? `已使用过:${usedTools.join(', ')}(本周期不可再推)` : '尚未使用过任何工具'}
${declinedTools.length > 0 ? `已被用户拒绝:${declinedTools.join(', ')}(本周期不再推荐)` : ''}
${pendingTools.length > 0 ? `已推荐待响应:${pendingTools.join(', ')}(等待用户操作)` : ''}

⚠️ 不可推荐:${unavailableTools.length > 0 ? unavailableTools.join(', ') : '无限制'}

## 工具 1: Match(八字合盘)

### 触发条件(必须全部满足)
1. 用户【明确提到】一个具体的二元关系:
   - 配偶/老婆/老公/伴侣/对象/男友/女友
   - 父母/爸爸/妈妈/儿子/女儿
   - 老板/上司/同事/合伙人/客户/下属
   - 朋友/兄弟/姐妹

2. 围绕该关系表达【特定类型】的困惑:
   - 不理解("我不懂他/她为什么这样")
   - 矛盾("我们老是吵")
   - 选择("要不要分/合作/继续")
   - 改善("怎样才能更好")

3. 该关系是当前 cycle 的【相关主题】(不是顺口提到)

### 推荐文案模板
"听你说和[关系对象]之间的[张力/矛盾/困惑]——
 这种二元关系的深层结构,八字合盘能看得更直接。

 我邀请你做一次免费 Match,看你们俩的命局互动模式。
 需要知道他/她的:出生日期 / 出生时间(精确到时辰) / 出生地点。

 [我知道这些信息 · 现在去 Match]
 [我不知道 · 继续聊]"

## 工具 2: Syncro(方位时机)

### 触发条件(必须全部满足)
1. 用户【明确提到】一个具体未来事件:
   - 时间 + 行为(如"明天下午签合同")
   
2. ⚠️ 关键时间约束:Syncro 只算未来 24 小时
   - 用户当前时间:${now.toISOString()}
   - 用户时区:${tz}
   - 今天:${todayStr}
   - 明天:${tomorrowStr}
   
   ✓ 允许触发:用户提到的事件在【今天】或【明天】
   ✗ 不可触发:用户提到的事件超过【明天】(后天、下周、下个月...)

3. 围绕该事件表达:
   - 不确定/担忧/时机选择

### 推荐文案模板
"[具体事件] —— 这种关键时刻的方位时机,
 Syncro 可以为你算出。

 奇门遁甲实时测算,告诉你 24 小时内
 哪个时辰、哪个方位最对你。

 [现在去 Syncro · 这次免费]
 [先不去 · 继续聊]"

## 工具 3: Glyph(意象反思)

⚠️ Glyph 在 POJU 中【不是替代】,而是【认知通道的扩展】。
你是【语言通道】(理性深聊),Glyph 是【意象通道】(绕过理性)。

### 触发条件(满足任一即可)
1. 用户【明确表达陷入模糊】:
   - "我自己也说不清"
   - "就是觉得不对劲,但说不上来"
   - "我也不知道为什么"
   - "我不知道我想要什么"

2. 用户【循环表达】同一个矛盾(3+ 次相同表达)

3. 你内部判断:对话已经触达用户的语言防御
   - 继续语言追问没有新角度
   - 用户开始疲惫但又不想结束

### 推荐文案模板
"我们一直在用语言探讨。
 但有时候真正卡住我们的东西,不在语言里——在更深的意象里。

 不如借一个意象,让你自己【看见】
 你内心已经知道但还没说出来的。

 [抽一次 Glyph · 免费 · 60 秒]
 [继续聊]"

⭐ Glyph 文案原则:
- 强调"互补",不是"替代"
- 强调"绕过理性",定位独特
- 强调"让你自己看清",不是"给你答案"
- 这样保持 POJU 的权威感,Glyph 有独立价值

## 输出格式

如果决定推荐工具,在 JSON 输出中加入 tool_suggestion 字段:

\`\`\`json
{
  "response": "你的主要回复内容(可包含推荐工具的引导文案)",
  "tool_suggestion": {
    "tool": "match" | "syncro" | "glyph",
    "trigger_context": "用户说了什么具体触发了这个推荐(50 字内)",
    "value_prop": "工具能为用户提供的具体价值(80 字内)",
    "prefill": {
      // Match: { "partner_relationship": "老板", "needs_partner_info": true }
      // Syncro: { "task_description": "明天下午签合同", "event_time": "tomorrow afternoon" }
      // Glyph: { "implicit_question": "..." }
    }
  }
}
\`\`\`

如果不推荐工具,省略 tool_suggestion 字段。

## 严格规则

✗ 不要为推荐而推荐
✗ 每个 cycle 内,每个工具最多推 1 次
✗ 用户拒绝过的工具,本 cycle 不再推
✗ 推荐必须精准锚定当前对话主题
✗ Syncro 不可推荐超过 24h 的事件
✗ 不可在同一条回复中推荐 2+ 工具(每次最多 1 个)

✓ 推荐前自问:"这个工具能精确补充当前问题吗?"
✓ 用户的【拒绝】是有效信息,尊重它
✓ 没有合适场景就不推
`;
}
```

## Step 2.2: 集成到 collecting / situation / tracking phase

文件:`lib/llm/phases/collecting-phase.ts`(修改,加入工具建议)

```typescript
import { buildToolSuggestionRules } from '@/lib/llm/prompts/tool-suggestion-rules';
import { getActiveCycle } from '@/lib/poju/cycle-manager';

export async function callCollectingPhase(input: AgentInput): Promise<PhaseLLMResult> {
  const { state, user_message, selected_profile, locale } = input;
  const activeCycle = getActiveCycle(state);
  
  const system = `${ORIENTAL_COUNSELOR_BASE}

${buildLanguageGuidance(locale, user_message)}

${buildProfileContextSection(selected_profile, baseAnalysis)}

# 当前任务:问诊式收集
... (原有内容)

# ⭐ 工具建议机制
${buildToolSuggestionRules({
  active_cycle: activeCycle,
  user_location: state.user_location
})}

## 输出格式(更新)

\`\`\`json
{
  "response": "...",
  "context_updates": {...},
  "question_category": "...",
  "suggested_phase": "...",
  "tool_suggestion": {... 如果适用}
}
\`\`\`
`;
  
  // ... 原有 LLM 调用逻辑
  
  // 解析后,处理 tool_suggestion
  if (parsed.tool_suggestion) {
    // 验证配额
    const { available } = checkToolQuota(state, parsed.tool_suggestion.tool);
    if (!available) {
      console.log('[collecting] LLM suggested tool but quota unavailable, ignoring');
      delete parsed.tool_suggestion;
    } else {
      // 记录推荐
      const newState = recordToolSuggestion(
        state, 
        parsed.tool_suggestion.tool,
        'msg_' + Date.now(),
        parsed.tool_suggestion.trigger_context
      );
      // ... 应用到 state
    }
  }
  
  return {
    response: parsed.response,
    tool_suggestion: parsed.tool_suggestion,
    // ... 其他字段
  };
}
```

类似地修改 `tracking-phase.ts`:

```typescript
// tracking phase 也加入工具建议机制
// 加上一个【新 cycle 检测】

const system = `${ORIENTAL_COUNSELOR_BASE}
... (原有 tracking 内容)

# ⭐ 新 cycle 检测(关键!)

之前的 delivery 已经完成,用户现在回来。

如果用户说的内容是【全新话题】(跟原 cycle 的 ${activeCycle?.original_question} 无关):
  → 在 JSON 输出中设置 start_new_cycle: true
  → 新 cycle 的 original_question = 用户的新话题

如果用户说的是:
  - 继续讨论原话题
  - 报告行动结果
  - 问跟原话题相关的延伸问题
  → 不要设置 start_new_cycle,保持当前 cycle

# ⭐ 工具建议机制(tracking 内也可推荐,但更克制)
${buildToolSuggestionRules({
  active_cycle: activeCycle,
  user_location: state.user_location
})}

## 输出格式

\`\`\`json
{
  "response": "...",
  "start_new_cycle": false | true,
  "new_cycle_question": "用户的新话题(如果 start_new_cycle: true)",
  "tool_suggestion": {...}
}
\`\`\`
`;
```

## Step 2.3: agent.ts 处理 cycle 切换

文件:`lib/poju/agent.ts`(修改)

```typescript
export async function handleUserMessage(input: AgentInput): Promise<AgentOutput> {
  let { state, user_message, selected_profile, locale } = input;
  
  // ... 现有规则层
  
  // 调用当前 phase
  const llmResult = await callCurrentPhase({ state, user_message, selected_profile, locale });
  
  // ⭐ 处理 start_new_cycle
  if (llmResult.start_new_cycle && llmResult.new_cycle_question) {
    console.log('[agent] LLM detected new topic, starting new cycle');
    state = startNewCycle(state, llmResult.new_cycle_question);
  }
  
  // ⭐ 处理 tool_suggestion
  if (llmResult.tool_suggestion) {
    const { available } = checkToolQuota(state, llmResult.tool_suggestion.tool);
    if (available) {
      state = recordToolSuggestion(
        state,
        llmResult.tool_suggestion.tool,
        'msg_' + Date.now(),
        llmResult.tool_suggestion.trigger_context
      );
    }
  }
  
  // ⭐ 处理 delivery 完成(标记 cycle delivered)
  if (state.current_phase === 'delivery' && llmResult.main_delivery_data) {
    state = markCycleDelivered(
      state, 
      state.active_cycle_id, 
      llmResult.actions || []
    );
  }
  
  // ... 持久化 + 返回
  
  return {
    response: llmResult.response,
    tool_suggestion: llmResult.tool_suggestion,
    new_state: state,
    // ...
  };
}
```

## 验证清单

```
□ tool-suggestion-rules.ts 完整(3 工具触发逻辑)
□ Syncro 24h 时间约束实现
□ collecting / situation / tracking 三 phase 都集成
□ agent.ts 处理 start_new_cycle
□ agent.ts 处理 tool_suggestion 配额检查
□ delivery 完成时标记 cycle
□ tsc 通过

测试用例:
  □ 用户在 collecting 提到老板矛盾 → LLM 输出 Match suggestion
  □ 用户在 collecting 说"明天面试" → LLM 输出 Syncro suggestion
  □ 用户在 collecting 说"下个月签字" → LLM 不输出 Syncro(超 24h)
  □ 用户说"我说不清" → LLM 输出 Glyph suggestion
  □ 用户拒绝 Match 后 → 同 cycle 不再推 Match
  □ delivery 完成后 → tracking phase
  □ tracking 中用户提新话题 → LLM 输出 start_new_cycle: true
  □ 新 cycle 开始 → 工具配额重置

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - tool_suggestion 卡片渲染

## Step 3.1: 消息内嵌卡片组件

文件:`components/poju/ToolSuggestionCard.tsx`(新建)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

interface ToolSuggestion {
  tool: 'glyph' | 'syncro' | 'match';
  trigger_context: string;
  value_prop: string;
  prefill?: any;
}

interface Props {
  suggestion: ToolSuggestion;
  session_id: string;
  cycle_id: string;
  onResponse: (action: 'accepted' | 'declined') => void;
}

const TOOL_META = {
  match: {
    icon: 'ti-heart',
    color: 'var(--pj-teal)',
    title_key: 'tool_suggestion.match.title',
    accept_key: 'tool_suggestion.match.accept',
    decline_key: 'tool_suggestion.match.decline'
  },
  syncro: {
    icon: 'ti-compass',
    color: 'var(--pj-gold)',
    title_key: 'tool_suggestion.syncro.title',
    accept_key: 'tool_suggestion.syncro.accept',
    decline_key: 'tool_suggestion.syncro.decline'
  },
  glyph: {
    icon: 'ti-cards',
    color: 'var(--pj-following)',
    title_key: 'tool_suggestion.glyph.title',
    accept_key: 'tool_suggestion.glyph.accept',
    decline_key: 'tool_suggestion.glyph.decline'
  }
};

export function ToolSuggestionCard({ suggestion, session_id, cycle_id, onResponse }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const [responded, setResponded] = useState(false);
  
  const meta = TOOL_META[suggestion.tool];
  
  function handleAccept() {
    if (responded) return;
    setResponded(true);
    onResponse('accepted');
    
    // 跳转到工具,带 prefill + 回流参数
    const params = new URLSearchParams({
      from_poju_session: session_id,
      from_poju_cycle: cycle_id,
      ...flattenPrefill(suggestion.prefill)
    });
    
    router.push(`/${locale}/${suggestion.tool}/start?${params.toString()}`);
  }
  
  function handleDecline() {
    if (responded) return;
    setResponded(true);
    onResponse('declined');
  }
  
  return (
    <div className={`tool-suggestion-card tool-${suggestion.tool}`}>
      <div className="tsc-header">
        <div className="tsc-icon" style={{ color: meta.color }}>
          <i className={`ti ${meta.icon}`} />
        </div>
        <div className="tsc-tag">{t('tool_suggestion.label')}</div>
      </div>
      
      <div className="tsc-title">{t(meta.title_key)}</div>
      
      <div className="tsc-value-prop">
        {suggestion.value_prop}
      </div>
      
      {/* 特殊提示:Match 需要对方信息 */}
      {suggestion.tool === 'match' && suggestion.prefill?.needs_partner_info && (
        <div className="tsc-prerequisite">
          <i className="ti ti-info-circle" />
          <span>{t('tool_suggestion.match.needs_info')}</span>
        </div>
      )}
      
      {!responded ? (
        <div className="tsc-actions">
          <button 
            className="tsc-btn tsc-btn-accept"
            onClick={handleAccept}
          >
            <i className={`ti ${meta.icon}`} />
            {t(meta.accept_key)}
            <span className="tsc-price-tag">{t('tool_suggestion.free_in_session')}</span>
          </button>
          <button 
            className="tsc-btn tsc-btn-decline"
            onClick={handleDecline}
          >
            {t(meta.decline_key)}
          </button>
        </div>
      ) : (
        <div className="tsc-responded">
          <i className="ti ti-check" />
          <span>
            {/* 显示用户已响应的状态 */}
            {t('tool_suggestion.you_will_continue')}
          </span>
        </div>
      )}
    </div>
  );
}

function flattenPrefill(prefill: any): Record<string, string> {
  if (!prefill) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(prefill)) {
    if (typeof value === 'string') result[key] = value;
    else if (typeof value === 'boolean') result[key] = String(value);
  }
  return result;
}
```

## Step 3.2: 卡片样式(Apple 极简)

文件:`styles/tool-suggestion.css`

```css
.tool-suggestion-card {
  margin: 12px 0;
  padding: 16px 14px;
  background: var(--pj-bg-card);
  border-radius: var(--pj-radius-lg);
  position: relative;
  overflow: hidden;
}

/* 不同工具的微妙渐变 */
.tool-suggestion-card.tool-match {
  background: linear-gradient(135deg, 
    rgba(78, 205, 196, 0.06) 0%, 
    rgba(78, 205, 196, 0.02) 100%);
}

.tool-suggestion-card.tool-syncro {
  background: linear-gradient(135deg, 
    rgba(212, 165, 116, 0.06) 0%, 
    rgba(212, 165, 116, 0.02) 100%);
}

.tool-suggestion-card.tool-glyph {
  background: linear-gradient(135deg, 
    rgba(0, 217, 184, 0.06) 0%, 
    rgba(0, 217, 184, 0.02) 100%);
}

.tsc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.tsc-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tsc-icon i {
  font-size: 16px;
}

.tsc-tag {
  font-size: 10px;
  color: var(--pj-text-tertiary);
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

.tsc-title {
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  color: var(--pj-text-primary);
  margin-bottom: 6px;
}

.tsc-value-prop {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-secondary);
  line-height: var(--pj-leading-relaxed);
  margin-bottom: 14px;
}

.tsc-prerequisite {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--pj-radius-md);
  margin-bottom: 14px;
}

.tsc-prerequisite i {
  color: var(--pj-text-tertiary);
  font-size: 14px;
  margin-top: 2px;
  flex-shrink: 0;
}

.tsc-prerequisite span {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  line-height: var(--pj-leading-normal);
}

.tsc-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tsc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  font-family: inherit;
  font-size: var(--pj-text-sm);
  font-weight: var(--pj-weight-medium);
  border-radius: var(--pj-radius-md);
  cursor: pointer;
  transition: all var(--pj-duration-fast) var(--pj-ease);
  position: relative;
}

.tsc-btn-accept {
  background: linear-gradient(135deg, var(--pj-gold) 0%, var(--pj-gold-soft) 100%);
  color: var(--pj-bg-deep);
}

.tsc-btn-accept:active {
  transform: scale(0.98);
}

.tsc-price-tag {
  position: absolute;
  right: 14px;
  font-size: 10px;
  font-weight: var(--pj-weight-regular);
  opacity: 0.7;
  letter-spacing: 0.3px;
}

.tsc-btn-decline {
  background: transparent;
  color: var(--pj-text-tertiary);
  padding: 10px;
}

.tsc-btn-decline:active {
  color: var(--pj-text-primary);
}

.tsc-responded {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--pj-text-tertiary);
  font-size: var(--pj-text-sm);
}

.tsc-responded i {
  color: var(--pj-following);
}
```

## Step 3.3: 翻译

文件:`messages/en/tool_suggestion.json`

```json
{
  "tool_suggestion": {
    "label": "Suggestion",
    "free_in_session": "Free in this session",
    "you_will_continue": "Continuing the conversation...",
    
    "match": {
      "title": "Read this relationship together",
      "accept": "Open Match",
      "decline": "Skip · Continue",
      "needs_info": "You'll need their birth date, time, and location"
    },
    
    "syncro": {
      "title": "Find the right moment for this",
      "accept": "Open Syncro",
      "decline": "Skip · Continue"
    },
    
    "glyph": {
      "title": "Look through an image",
      "accept": "Draw a Glyph",
      "decline": "Skip · Continue"
    }
  }
}
```

## Step 3.4: 消息渲染集成

文件:`components/poju/MessageBubble.tsx`(修改)

```tsx
import { ToolSuggestionCard } from './ToolSuggestionCard';

export function MessageBubble({ message, sessionId, cycleId, onToolResponse }: Props) {
  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="message-content">
        {message.response}
      </div>
      
      {/* ⭐ 工具建议卡片(嵌入消息内)*/}
      {message.tool_suggestion && (
        <ToolSuggestionCard 
          suggestion={message.tool_suggestion}
          session_id={sessionId}
          cycle_id={cycleId}
          onResponse={(action) => onToolResponse(message.tool_suggestion.tool, action)}
        />
      )}
    </div>
  );
}
```

## 验证清单

```
□ ToolSuggestionCard 组件实现
□ 3 个工具的差异化样式(渐变色)
□ 卡片在消息内嵌
□ Match 特殊:显示"需要对方出生信息"提示
□ 接受/拒绝按钮
□ 响应后状态变化
□ 跳转 URL 带 from_poju_session + from_poju_cycle
□ prefill 参数传递
□ 翻译完整

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 工具页面接收 POJU 来源

## Step 4.1: 工具入口检测 from_poju

文件:`app/[locale]/(marketing)/match/start/page.tsx`(类似 syncro/glyph)

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MatchStartPage() {
  const searchParams = useSearchParams();
  const fromPojuSession = searchParams.get('from_poju_session');
  const fromPojuCycle = searchParams.get('from_poju_cycle');
  const partnerRelationship = searchParams.get('partner_relationship');
  
  const [isFreeInSession, setIsFreeInSession] = useState(false);
  
  useEffect(() => {
    if (fromPojuSession && fromPojuCycle) {
      // 验证配额(从 IndexedDB 读取)
      checkPojuQuota('match', fromPojuSession, fromPojuCycle).then(setIsFreeInSession);
    }
  }, [fromPojuSession]);
  
  return (
    <div className="match-start-page">
      {fromPojuSession && (
        <div className="poju-context-banner">
          <i className="ti ti-arrow-left" />
          <span>
            {isFreeInSession 
              ? "Coming from POJU · Free this time"
              : "Coming from POJU · $4.99 (quota used)"}
          </span>
        </div>
      )}
      
      {/* 原 Match start 内容 */}
      {partnerRelationship && (
        <div className="prefilled-context">
          About your relationship with: <strong>{partnerRelationship}</strong>
        </div>
      )}
      
      {/* 表单 / 选项 ... */}
    </div>
  );
}
```

## Step 4.2: 配额检查工具

文件:`lib/poju/tool-quota-check.ts`(新建)

```typescript
import { getPojuSession } from '@/lib/db/poju-db';
import { getActiveCycle, checkToolQuota } from './cycle-manager';
import type { ToolName } from './types';

/**
 * 检查工具在 POJU session 中是否还有免费配额
 */
export async function checkPojuQuota(
  tool: ToolName,
  session_id: string,
  cycle_id: string
): Promise<boolean> {
  try {
    const session = await getPojuSession(session_id);
    if (!session) return false;
    
    // cycle_id 必须匹配当前活跃 cycle
    if (session.active_cycle_id !== cycle_id) {
      return false;
    }
    
    const quota = checkToolQuota(session, tool);
    return quota.available;
  } catch (e) {
    console.error('[check-poju-quota] error', e);
    return false;
  }
}
```

## Step 4.3: 工具完成回流

文件:`components/match/MatchCompletedView.tsx`(完成页修改)

```tsx
export function MatchCompletedView({ report }: { report: any }) {
  const searchParams = useSearchParams();
  const fromPojuSession = searchParams.get('from_poju_session');
  
  // ⭐ 如果是从 POJU 来的,显示返回 banner
  if (fromPojuSession) {
    return (
      <>
        {/* 顶部:返回 POJU banner */}
        <div className="return-to-poju-banner">
          <button onClick={() => returnToPoju(fromPojuSession, report)}>
            <i className="ti ti-arrow-left" />
            <span>Return to POJU with this analysis</span>
          </button>
        </div>
        
        {/* 报告内容(完整显示)*/}
        <MatchReportContent report={report} />
        
        {/* 底部 CTA:再次提醒返回 */}
        <div className="return-cta">
          <button 
            className="primary-btn-large" 
            onClick={() => returnToPoju(fromPojuSession, report)}
          >
            Back to POJU · Continue conversation
          </button>
        </div>
      </>
    );
  }
  
  // 普通完成页(非 POJU 来源)
  return (
    <>
      <MatchReportContent report={report} />
      
      {/* 底部 CTA:跳转到 POJU(层 3 反向回流)*/}
      <CrossProductCTA productId="match" report={report} />
    </>
  );
}

async function returnToPoju(session_id: string, report: any) {
  // 1. 注入工具结果到 POJU session
  await injectToolResultToPoju({
    session_id,
    tool: 'match',
    result_id: report.id,
    result_data: extractMatchSummary(report)
  });
  
  // 2. 跳转回 POJU session
  router.push(`/${locale}/poju/session/${session_id}`);
}
```

## 验证清单

```
□ 工具页面接收 from_poju_session / from_poju_cycle
□ 显示"Coming from POJU"banner
□ 配额检查显示"Free this time" vs "$4.99"
□ 完成页面顶部+底部都有返回 banner
□ 返回时调用 injectToolResultToPoju
□ 跳转回 POJU session

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - 工具结果自动注入 POJU

## Step 5.1: 注入服务

文件:`lib/poju/inject-tool-result.ts`(新建)

```typescript
import { updatePojuSession, getPojuSession } from '@/lib/db/poju-db';
import { injectToolResult } from './cycle-manager';
import type { ToolName } from './types';

export async function injectToolResultToPoju(input: {
  session_id: string;
  tool: ToolName;
  result_id: string;
  result_data: any;
}): Promise<void> {
  const session = await getPojuSession(input.session_id);
  if (!session) throw new Error('POJU session not found');
  
  // 更新 cycle 数据(标记工具完成)
  const updatedState = injectToolResult(
    session, 
    input.tool, 
    input.result_id, 
    input.result_data
  );
  
  await updatePojuSession(input.session_id, updatedState);
  
  console.log(`[inject-tool-result] ${input.tool} result injected to session ${input.session_id}`);
}

/**
 * 提取工具数据的核心摘要(给 POJU LLM 看)
 */
export function extractToolSummary(tool: ToolName, raw_data: any): any {
  switch (tool) {
    case 'match':
      return {
        a_profile: raw_data.a_summary,
        b_profile: raw_data.b_summary,
        compatibility_level: raw_data.conclusion?.compatibility_level,
        key_strengths: raw_data.conclusion?.strengths?.slice(0, 3),
        key_challenges: raw_data.conclusion?.challenges?.slice(0, 3),
        day_master_interaction: raw_data.day_master_interaction?.type,
        day_branch_relation: {
          he: raw_data.branch_interactions?.day_branch_he,
          chong: raw_data.branch_interactions?.day_branch_chong
        }
      };
    
    case 'syncro':
      // ⭐ 返回完整的 96 矩阵(让 POJU 智能筛选)
      return {
        task_description: raw_data.task_description,
        full_matrix: raw_data.matrix,  // 96 格
        true_solar_time_diff: raw_data._meta?.true_solar_time_diff_minutes,
        user_location_summary: raw_data.user_location_name
      };
    
    case 'glyph':
      return {
        question: raw_data.question,
        glyph_drawn: raw_data.glyph_name,
        meaning: raw_data.meaning_summary,
        reflection: raw_data.reflection
      };
    
    default:
      return raw_data;
  }
}
```

## Step 5.2: POJU 看到工具结果后的 prompt 处理

文件:`lib/llm/prompts/tool-result-injection.ts`(新建)

```typescript
import type { ToolName } from '@/lib/poju/types';

/**
 * 构建 system message,告诉 POJU LLM:用户刚完成了工具
 */
export function buildToolResultInjectionMessage(input: {
  tool: ToolName;
  result_data: any;
  original_question: string;  // POJU cycle 的原始问题
}): string {
  switch (input.tool) {
    case 'match':
      return buildMatchInjection(input.result_data, input.original_question);
    case 'syncro':
      return buildSyncroInjection(input.result_data, input.original_question);
    case 'glyph':
      return buildGlyphInjection(input.result_data, input.original_question);
  }
}

function buildMatchInjection(data: any, originalQuestion: string): string {
  return `[系统注入 · Match 结果]

用户刚才完成了 Match 合盘分析(你建议他/她做的)。

## 核心数据

- 合盘对象:${data.a_profile} 与 ${data.b_profile}
- 整体契合度:${data.compatibility_level}
- 日主互动:${data.day_master_interaction}
- 日支:${data.day_branch_relation.he ? '相合(夫妻宫合)' : ''} ${data.day_branch_relation.chong ? '相冲(夫妻宫冲)' : ''}

## 关键优势(3)
${data.key_strengths?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

## 关键挑战(3)
${data.key_challenges?.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

# 你接下来要做的

⭐ 你的当前 cycle 主题是:"${originalQuestion}"

回到这个主题,基于刚才看到的合盘数据,继续推进对话:
1. 简短承认看到了(不要复述全部数据)
2. 把最相关的 1-2 个洞察拉回到【原话题】
3. 询问用户接下来想从哪里继续

⛔ 不要:
- 详细复述合盘报告(用户自己看过了)
- 开始一个新的"合盘解读"话题
- 把这个分析当作新的对话起点

✓ 要:
- 把合盘洞察【应用到】原话题
- 例:原话题是"该不该跳槽",合盘显示和老婆挑战大
  → "看到你们日支冲,这可能是为什么她对你跳槽的反应让你意外。
     回到你的纠结——她的反对里,有多少是基于现实考虑,
     有多少是基于你们这种结构性差异?"
`;
}

function buildSyncroInjection(data: any, originalQuestion: string): string {
  return `[系统注入 · Syncro 结果]

用户刚才完成了 Syncro 24h 方位时机分析(你建议他/她做的)。

## 用户的任务
"${data.task_description}"

## 用户位置
${data.user_location_summary}
真太阳时偏移:${data.true_solar_time_diff} 分钟

## 96 格完整矩阵(供你智能筛选)

\`\`\`json
${JSON.stringify(data.full_matrix, null, 2)}
\`\`\`

# 你接下来要做的

⭐ 你的当前 cycle 主题是:"${originalQuestion}"

不要把 96 格全告诉用户!那是数据,不是回答。

你的任务:
1. 根据用户【原话题】中提到的具体时间
   (如"明天下午"、"明天 14:00"),找到对应的时辰
2. 找到这些时辰里【最适合】用户的方位 + Current level
3. 简洁告诉用户:"在你说的[那个时间],东南方位的 Open Current 最对你"
4. 把这个时空建议拉回到【原话题】的决策中

✓ 要:
- 用筛选后的 1-2 个最相关时机
- 用普通语言("下午 2-4 点向东南"),不用术语
- 拉回原话题(签合同/谈判/约会等)

⛔ 不要:
- 复述所有 96 格
- 单纯讲 Current level 不结合行动
- 让 Syncro 数据【取代】原对话

例如:
原话题:"该不该接受 offer,明天就要签"
你应该说:"看了明天的方位时机——明天下午 14-16 点,
         东南方位是你的 Open Current。
         但回到你的纠结——签字本身是个动作,
         背后是你对这份 offer 的真实评估。
         你的核心顾虑是什么?"
`;
}

function buildGlyphInjection(data: any, originalQuestion: string): string {
  return `[系统注入 · Glyph 结果]

用户刚才抽了一次 Glyph(你建议他/她做的)。

## 抽到的意象
"${data.glyph_drawn}"

## 含义
${data.meaning}

## 用户的反思
${data.reflection || '(用户没写反思)'}

# 你接下来要做的

⭐ 你的当前 cycle 主题是:"${originalQuestion}"

Glyph 的设计是【绕过理性】。
你不应该把它当成"答案",而是【一个引子】。

你的任务:
1. 不要解释 Glyph 含义(用户已经看到)
2. 把 Glyph 意象作为【投射镜】,反问用户
3. 让用户在这个意象上【说出之前说不出的】
4. 拉回原话题,但用新的视角

例如:
原话题:"我说不清楚为什么不开心"
Glyph 抽到:"Crosswind"(横风,航向受阻)
你应该说:"你抽到了横风。
         这个意象在你身上能产生什么共鸣?
         你现在生活中,有没有什么感觉【风向不对】的部分?
         不一定要立刻有答案,慢慢说。"

⭐ Glyph 之后,你的回复应该更【克制】,让用户主导。
   不是你解释 Glyph,是用户【透过 Glyph 看自己】。
`;
}
```

## Step 5.3: agent.ts 检测并注入

文件:`lib/poju/agent.ts`(修改)

```typescript
import { buildToolResultInjectionMessage } from '@/lib/llm/prompts/tool-result-injection';
import { markToolResultInjected } from './cycle-manager';

export async function handleUserMessage(input: AgentInput): Promise<AgentOutput> {
  let { state, user_message, selected_profile, locale } = input;
  
  // ⭐ 检测是否有待注入的工具结果
  const activeCycle = getActiveCycle(state);
  if (activeCycle) {
    const pendingInjection = activeCycle.tool_suggestions.find(
      s => s.tool_result_data && !s.injected_to_poju
    );
    
    if (pendingInjection && pendingInjection.tool_result_data) {
      console.log(`[agent] Injecting ${pendingInjection.tool} result to POJU`);
      
      // 构建注入消息
      const injectionMessage = buildToolResultInjectionMessage({
        tool: pendingInjection.tool,
        result_data: pendingInjection.tool_result_data,
        original_question: activeCycle.original_question
      });
      
      // 把注入消息加到 LLM messages 列表的开头(作为额外 system 上下文)
      const messagesWithInjection = [
        { role: 'system', content: injectionMessage },
        ...state.messages,
        { role: 'user', content: user_message }
      ];
      
      // 调用 LLM
      const llmResult = await callCurrentPhase({
        state,
        user_message,
        selected_profile,
        locale,
        extra_messages: messagesWithInjection  // 把注入消息传过去
      });
      
      // 标记已注入
      state = markToolResultInjected(
        state,
        pendingInjection.tool,
        pendingInjection.tool_result_id!
      );
      
      // ... 处理 llmResult
    } else {
      // 正常处理(无注入)
      const llmResult = await callCurrentPhase({...});
      // ...
    }
  }
  
  // ...
}
```

## 验证清单

```
□ inject-tool-result.ts 完整
□ extractToolSummary 3 个 tool 都正确提取
□ tool-result-injection.ts 完整(3 个 buildXxxInjection)
□ agent.ts 检测 pendingInjection
□ 注入后立即标记 injected_to_poju: true
□ POJU LLM 收到工具结果后【回到原话题】(关键验证)

测试用例:
  □ Match 注入后,POJU 引用合盘洞察 + 回到原话题
  □ Syncro 注入后,POJU 智能筛选 1-2 个时机 + 不复述 96 格
  □ Glyph 注入后,POJU 不解释,反问用户

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - 工具 → POJU 反向回流(层 3)

## Step 6.1: 工具结果页底部 CTA

文件:`components/cross-product/PojuDeepDiveCTA.tsx`(新建)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { listActivePojuSessions } from '@/lib/db/poju-db';

interface Props {
  productId: 'glyph' | 'syncro' | 'match';
  result_id: string;
  result_data: any;
}

export function PojuDeepDiveCTA({ productId, result_id, result_data }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations(`cross_product.${productId}_to_poju`);
  
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  async function handleClick() {
    // 检查用户的进行中 POJU sessions
    const sessions = await listActivePojuSessions();
    
    if (sessions.length === 0) {
      // 没有进行中 → 创建新 session
      router.push(`/${locale}/poju?from_tool=${productId}&result_id=${result_id}`);
    } else {
      // 有进行中 → 弹层让用户选
      setActiveSessions(sessions);
      setShowSessionPicker(true);
    }
  }
  
  return (
    <>
      <div className="poju-deep-dive-cta">
        <div className="pdd-content">
          <div className="pdd-title">{t('title')}</div>
          <div className="pdd-description">{t('description')}</div>
          
          <div className="pdd-price-line">
            <span className="pdd-price">$9.99</span>
            <span className="pdd-period">/ 30 days</span>
          </div>
          
          <div className="pdd-value">{t('value_prop')}</div>
        </div>
        
        <button className="pdd-cta-btn" onClick={handleClick}>
          <span>{t('button')}</span>
          <i className="ti ti-arrow-right" />
        </button>
      </div>
      
      {/* Session 选择弹层 */}
      {showSessionPicker && (
        <SessionPickerModal 
          sessions={activeSessions}
          productId={productId}
          result_id={result_id}
          onClose={() => setShowSessionPicker(false)}
        />
      )}
    </>
  );
}

function SessionPickerModal({ sessions, productId, result_id, onClose }: any) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('cross_product.session_picker');
  
  function joinExisting(session_id: string) {
    router.push(`/${locale}/poju/session/${session_id}?from_tool=${productId}&result_id=${result_id}`);
  }
  
  function createNew() {
    router.push(`/${locale}/poju?from_tool=${productId}&result_id=${result_id}`);
  }
  
  return (
    <div className="session-picker-overlay" onClick={onClose}>
      <div className="session-picker-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <i className="ti ti-x" />
        </button>
        
        <div className="picker-header">
          <div className="picker-title">{t('title')}</div>
          <div className="picker-subtitle">{t('subtitle')}</div>
        </div>
        
        <div className="existing-sessions">
          <div className="section-label">{t('existing_sessions')}</div>
          {sessions.map((session: any) => (
            <button 
              key={session.session_id}
              className="session-card"
              onClick={() => joinExisting(session.session_id)}
            >
              <div className="session-topic">
                {session.cycles?.[0]?.original_question?.slice(0, 60)}...
              </div>
              <div className="session-meta">
                <span>{session.cycles?.length} cycles</span>
                <span>·</span>
                <span>{daysLeft(session.expires_at)} days left</span>
              </div>
              <div className="session-action">
                {t('join_this')} · <span className="free">Free</span>
              </div>
            </button>
          ))}
        </div>
        
        <div className="picker-divider">
          <span>{t('or')}</span>
        </div>
        
        <button className="create-new-card" onClick={createNew}>
          <div className="create-title">{t('start_new')}</div>
          <div className="create-subtitle">{t('start_new_subtitle')}</div>
          <div className="create-price">$9.99 · 30 days</div>
        </button>
      </div>
    </div>
  );
}

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
```

## Step 6.2: 翻译

```json
{
  "cross_product": {
    "match_to_poju": {
      "title": "Want to go deeper into this relationship?",
      "description": "This Match shows you the structure. POJU helps you find what to do about it.",
      "value_prop": "Up to 30 days of deep analysis around this specific relationship",
      "button": "Open POJU"
    },
    "syncro_to_poju": {
      "title": "Want to think through this decision?",
      "description": "Syncro tells you when. POJU helps you decide whether and how.",
      "value_prop": "Up to 30 days of deep counseling around your situation",
      "button": "Open POJU"
    },
    "glyph_to_poju": {
      "title": "Want to unpack what this reflected?",
      "description": "Glyph offered an image. POJU helps you understand and act on it.",
      "value_prop": "Up to 30 days of deep conversation around what you're processing",
      "button": "Open POJU"
    },
    "session_picker": {
      "title": "How do you want to continue?",
      "subtitle": "You have ongoing POJU sessions. This new analysis can join one of them, or start fresh.",
      "existing_sessions": "Add to existing session",
      "join_this": "Join this conversation",
      "or": "OR",
      "start_new": "Start a new POJU session",
      "start_new_subtitle": "If this is a separate topic, give it its own session"
    }
  }
}
```

## Step 6.3: 样式

```css
.poju-deep-dive-cta {
  margin-top: 60px;
  padding: 32px 24px;
  background: linear-gradient(135deg,
    rgba(212, 165, 116, 0.08) 0%,
    rgba(212, 165, 116, 0.02) 100%);
  border-radius: var(--pj-radius-xl);
  text-align: center;
}

.pdd-title {
  font-size: var(--pj-text-xl);
  font-weight: var(--pj-weight-medium);
  color: var(--pj-text-primary);
  letter-spacing: var(--pj-track-tight);
  line-height: var(--pj-leading-tight);
  margin-bottom: 12px;
}

.pdd-description {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-secondary);
  line-height: var(--pj-leading-relaxed);
  margin-bottom: 18px;
  padding: 0 8px;
}

.pdd-price-line {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.pdd-price {
  font-size: var(--pj-text-2xl);
  font-weight: var(--pj-weight-medium);
  color: var(--pj-gold);
}

.pdd-period {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-tertiary);
}

.pdd-value {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  letter-spacing: 0.3px;
  margin-bottom: 24px;
}

.pdd-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  background: linear-gradient(135deg, var(--pj-gold), var(--pj-gold-soft));
  color: var(--pj-bg-deep);
  font-family: inherit;
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  border-radius: var(--pj-radius-pill);
  cursor: pointer;
}

/* === Session Picker Modal === */
.session-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: pj-fade-in var(--pj-duration-fast);
}

.session-picker-modal {
  width: 100%;
  max-width: 480px;
  background: var(--pj-bg-elevated);
  border-radius: var(--pj-radius-xl) var(--pj-radius-xl) 0 0;
  padding: 28px 20px max(32px, env(safe-area-inset-bottom));
  position: relative;
  animation: pj-slide-up var(--pj-duration-normal) var(--pj-ease);
  max-height: 80vh;
  overflow-y: auto;
}

.session-card {
  width: 100%;
  padding: 16px;
  background: var(--pj-bg-card);
  border-radius: var(--pj-radius-lg);
  margin-bottom: 8px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.session-topic {
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);
  margin-bottom: 6px;
  line-height: var(--pj-leading-normal);
}

.session-meta {
  display: flex;
  gap: 6px;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  margin-bottom: 10px;
}

.session-action {
  font-size: var(--pj-text-sm);
  color: var(--pj-gold);
}

.session-action .free {
  font-weight: var(--pj-weight-medium);
}

.picker-divider {
  text-align: center;
  margin: 20px 0;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-muted);
  letter-spacing: 1.5px;
}

.create-new-card {
  width: 100%;
  padding: 18px;
  background: linear-gradient(135deg,
    rgba(212, 165, 116, 0.12) 0%,
    rgba(212, 165, 116, 0.04) 100%);
  border-radius: var(--pj-radius-lg);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.create-title {
  font-size: var(--pj-text-base);
  font-weight: var(--pj-weight-medium);
  color: var(--pj-text-primary);
  margin-bottom: 4px;
}

.create-subtitle {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  margin-bottom: 12px;
  line-height: var(--pj-leading-normal);
}

.create-price {
  font-size: var(--pj-text-sm);
  color: var(--pj-gold);
  font-weight: var(--pj-weight-medium);
}
```

## Step 6.4: POJU 入口处理 from_tool 参数

文件:`app/[locale]/(marketing)/poju/page.tsx`(修改)

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToolResult } from '@/lib/cross-product/get-tool-result';

export default function POJUEntryPage() {
  const searchParams = useSearchParams();
  const fromTool = searchParams.get('from_tool');
  const resultId = searchParams.get('result_id');
  
  const [toolResultData, setToolResultData] = useState<any>(null);
  
  useEffect(() => {
    if (fromTool && resultId) {
      getToolResult(fromTool as any, resultId).then(setToolResultData);
    }
  }, [fromTool, resultId]);
  
  // 处理新 session 创建时的 prefill
  async function handleStartSession() {
    if (fromTool && toolResultData) {
      // 创建 session,初始 cycle 主题 = 工具数据
      const sessionId = await createPojuSessionWithToolContext({
        from_tool: fromTool,
        tool_result: toolResultData
      });
      
      router.push(`/${locale}/poju/session/${sessionId}/prepare`);
    } else {
      // 正常流程
      router.push(`/${locale}/poju/prepare`);
    }
  }
  
  // 显示 from_tool 来源的 prefill
  if (fromTool && toolResultData) {
    return (
      <div className="poju-from-tool-page">
        <div className="from-tool-banner">
          <i className="ti ti-arrow-left" />
          <span>Continuing from {fromTool}</span>
        </div>
        
        <Hero />  {/* 原 POJU Hero,复用 */}
        
        <div className="tool-context-card">
          <div className="context-label">Continuing this analysis</div>
          <div className="context-preview">
            {/* 简短预览工具结果 */}
            {renderToolPreview(fromTool, toolResultData)}
          </div>
        </div>
        
        <BeginButton 
          onClick={handleStartSession}
          price="$9.99"
          subtitle="30 days · Around this topic"
        />
      </div>
    );
  }
  
  // 默认 POJU 入口
  return <NormalPOJUEntry />;
}
```

## 验证清单

```
□ PojuDeepDiveCTA 组件
□ Session Picker Modal
□ "加入现有" vs "新建" 流程
□ POJU 入口处理 from_tool 参数
□ 新 session 初始 cycle = 工具结果
□ 加入现有 session 时,工具结果注入当前活跃 cycle

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - 端到端测试

## 关键测试用例

```
【场景 1: POJU → Match → POJU 完整闭环】

1. 用户开 POJU session,聊"和老婆经常吵架"
2. POJU LLM 检测到二元关系 + 矛盾 → 输出 Match suggestion
3. 用户点"Open Match"
4. 跳转 Match,prefill "我和老婆"
5. 显示"Coming from POJU · Free this time"
6. 完成 Match 流程,看到报告
7. 顶部 banner "Return to POJU"
8. 用户点击 → 跳转回 POJU session
9. POJU 自动注入 Match 结果(system message)
10. POJU LLM 回复:引用合盘洞察 + 回到原话题
11. 验证:Match 配额标记为 'used',本 cycle 不再推

【场景 2: Syncro 24h 时间窗口】

1. 用户在 POJU 说"下周三签合同"
   → LLM 不应推 Syncro(超 24h)
2. 用户在 POJU 说"明天 14:00 签合同"
   → LLM 应推 Syncro

【场景 3: Glyph 触发(模糊表达)】

1. 用户:"我说不清为什么不开心"
2. POJU LLM 检测 → 输出 Glyph suggestion
3. 文案应该强调"语言通道之外的意象"

【场景 4: 拒绝后不再推】

1. POJU 推 Match
2. 用户点"Skip · Continue"
3. POJU LLM 继续对话,后续不再推 Match
4. 验证:配额状态 = declined

【场景 5: 新 cycle 启动】

1. 用户完成 cycle 1 的 delivery(签字决定)
2. 进入 tracking
3. 用户:"对了,我跟老板的关系也有点紧张..."
4. POJU LLM 判断 → start_new_cycle: true
5. 新 cycle 启动,主题:"老板关系"
6. 工具配额重置(Match/Syncro/Glyph 各可推 1 次)

【场景 6: Match → POJU(没有现有 session)】

1. 用户独立做 Match,完成
2. 看到底部 CTA "Continue in POJU · $9.99"
3. 点击 → 跳转 /poju?from_tool=match&result_id=xxx
4. POJU 入口显示 from-tool banner + 预览
5. 点击 Begin → 付费 $9.99 → 创建新 session
6. 新 session 的初始 cycle = Match 结果

【场景 7: Match → POJU(有现有 session)】

1. 用户独立做 Match,完成
2. 点击 CTA
3. 检测到有 1 个进行中 session
4. 弹层显示:
   - 加入"和老婆的关系"session(免费)
   - 开始新 session($9.99)
5. 用户选"加入"
6. 跳转回该 session,Match 结果注入当前 cycle
7. POJU LLM 自动回复(连接 Match 结果到原话题)

【场景 8: 配额计算】

1. POJU session,cycle 1:
   - 推 Match → 接受 → 完成 ✓
   - 推 Syncro → 拒绝
   - Glyph 未推
2. 用户继续聊
3. cycle 1 的 delivery 完成
4. 进入 cycle 2(新话题):
   - Match 可推 1 次 ✓
   - Syncro 可推 1 次 ✓
   - Glyph 可推 1 次 ✓

【场景 9: 付费场景】

1. POJU 中已用过 Match 配额(免费用过)
2. 用户主动要求"我想再做一次 Match 看跟我妈"
3. 跳转 Match,显示 "$4.99"
4. 用户付费完成
5. 结果仍可回流 POJU(如果用户选)
```

## 验证清单

```
□ 9 个场景全部通过
□ 配额计算准确
□ 拒绝后不再推
□ 工具结果注入后 POJU 回到原话题
□ 加入现有 session vs 新建流程清晰
□ Syncro 24h 约束生效
□ Glyph 触发条件准确
□ 新 cycle 启动自动重置配额
```

---

# 完整任务清单

```
✅ Step 1: 数据结构升级(cycle / tool_suggestions)
✅ Step 2: 工具触发逻辑(POJU LLM Prompt)
✅ Step 3: tool_suggestion 卡片渲染(消息内嵌)
✅ Step 4: 工具页面接收 from_poju + 配额检查
✅ Step 5: 工具结果自动注入 POJU
✅ Step 6: 工具 → POJU 反向回流(底部 CTA + 弹层)
✅ Step 7: 端到端测试

核心实现:
  ⭐ 1 session 多 cycle(深度延伸,不破坏纯粹性)
  ⭐ 每 cycle 工具配额(免费 1 次,拒绝即停)
  ⭐ Syncro 24h 严格窗口
  ⭐ Glyph 独特定位(意象通道,不冲突 POJU)
  ⭐ 工具结果自动注入(POJU 回到原话题,不开新话题)
  ⭐ 反向回流支持加入/新建 session
  ⭐ 商业边界清晰(免费/付费)

商业价值:
  - POJU 用户感觉"买 1 送 3"
  - 工具用户被 POJU 转化
  - 跨产品引流闭环
  - LTV / 复购 / 推荐都上升
```

---

**Cursor: 完成 Step 1-7 后,pojulife 的 4 工具联动机制全面就绪,从【工具组合】升级为【智能体系】。**
