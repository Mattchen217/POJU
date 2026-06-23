/**
 * Step I — AI 主动开场（东方破局顾问定位）
 */
import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

function buildOpeningTaskBlock(input: PhaseLLMInput): string {
  const q = input.session.original_question;
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));

  if (deliveryHandoff) {
    return `# 当前任务：交付页转入 · 主动开场

用户刚从工具交付页（Match / Glyph / Syncro）付费进入 POJU，并已看过完整交付内容。
系统注入块里已有合盘/卦象/时机等全部资料；下方「原始问题」是用户想深入的方向。

## 用户的原始问题
"${q}"

## 你的开场要做到

像一位已经读过全部资料的老师，**先给一个有洞见的回应**——点出 1–2 个最关键的结构或张力（勿复述全文），让用户感到你真正看懂了。再自然承接到 POJU 对话，邀请他多说一点或选一个想深入的焦点。

- **严禁**「我听到了/我明白了」式套路开场；**不要**固定「总结→承接→提问」三段骨架
- 可以给点拨，但**不要**在此给出完整行动方案或操作指令
- 若要问，最多 1 个从对话自然长出的问题，不要像问卷

## 风格

- 总字数 180–420 字（中文）/ 140–300 词（英文）；可引用命盘或工具结论中的至少 1 条具体细节
- 自然叙述、像人说话；不要列要点清单；不要说「我能帮你」之类的空承诺

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "你的主动开场消息",
  "suggested_phase": null,
  "action_requested": "continue_chat",
  "context_updates": {}
}`;
  }

  return `# 任务：理解判断门（Deep Judge）

你是 POJU——那位有温度、直指要害的智者（见身份头与知识根基）。在为这位用户启动深度测算之前，
你要先像一位"想真正听懂你的事才肯下判断"的老师那样判断：
他把「困境/问题」讲清楚到**足以锚定一次深度命理推演**了吗？
（要严谨，但不冷——你审的是"我听懂了吗"，不是把他当考生。）

## 用户的原始问题
"${q}"

## 你审的是「问题清晰度」，不是「八字真伪」
- 八字四柱由本地引擎确定性算出，永远完整合法 —— 绝不质疑、绝不说"八字信息不全"。
- 你只审：用户的【处境描述】是否清晰到能让你判断"这个局卡在哪、与他命盘哪条结构相关"。

## 内部评分维度（不输出给用户）
- 问题指向：他想破的到底是哪一件事？是否具体到一个焦点？
- 处境锚点：有没有至少一个可抓的事实（时间跨度 / 触发事件 / 当前状态 任一）？
- 可推演性：凭现有信息，你能不能产出一条不空泛的「关系结论」？

## 判定与动作
- 足够（sufficient=true）：哪怕只有一两句但指向明确（如"卡了三年想转行但不敢"），立即放行。
  response 给一个真实、有洞见的回应（锚命盘真实结构，自然用 ⟦t:⟧ 包术语），自然过渡到"我来为你深入看一下"。
  suggested_phase = "collecting_context"。
- 不足（sufficient=false）：信息太薄、无法锚定推演时，只温和追问【那一个】最关键的缺口（最多一句）。
  绝不审讯式连环问、绝不生成脊柱、绝不生成议程。suggested_phase = null（留在 opening）。

## 红线
- 最多追问 1 次；一个本就清楚的问题立即放行，不为凑"完整度"硬卡。
- 不暴露打分/机制；说人话，像一位想把你的事弄清楚才肯下判断的老师。
- 不套"我听到了/我明白了"开头。

## 输出 JSON（response 第一个键）
{
  "response": "...",
  "understanding": { "sufficient": true|false, "missing": "若不足，缺哪一类背景，一句话；足够则空字符串" },
  "suggested_phase": "collecting_context" | null,
  "action_requested": "continue_chat",
  "context_updates": {}
}`;
}

export async function callOpeningPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  let baseMessages = formatPhaseMessageHistory(input.session.messages);
  if (baseMessages.length === 0) {
    baseMessages = [{ role: "user", content: "__OPENING__" }];
  }
  const { system, messages } = await buildPhaseTransportInput(
    input,
    buildOpeningTaskBlock(input),
    baseMessages,
  );

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "chat_flash",
      temperature: 0.55,
      max_tokens: 6000,
      thinking_effort: "xhigh",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const understanding =
    parsed.understanding && typeof parsed.understanding === "object"
      ? {
          sufficient: Boolean((parsed.understanding as { sufficient?: unknown }).sufficient),
          missing: String((parsed.understanding as { missing?: unknown }).missing ?? ""),
        }
      : { sufficient: true, missing: "" };

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  const suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;
  const suggested_phase =
    understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested) ? suggested : null;

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  const action_requested: PojuV4ActionRequested | null =
    rawAction === "continue_chat" || rawAction === "show_birth_form" ? rawAction : "continue_chat";

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  return {
    response,
    suggested_phase,
    action_requested,
    context_updates,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: undefined,
    understanding,
  };
}
