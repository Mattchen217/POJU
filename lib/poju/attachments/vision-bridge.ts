/**
 * Path B: DeepSeek (low) writes a vision task brief → MiniMax M3 extracts → text report.
 * Prompts: rules only — no positive examples / few-shots.
 */

import {
  openRouterChatCompletion,
  type OpenRouterChatMessage,
  type OpenRouterMultimodalContent,
} from "@/lib/llm/openrouter-shared";

const VISION_MODEL = "minimax/minimax-m3";

const TASK_BRIEF_SYSTEM = `你是 Pivot 破局会话中的视觉任务调度。用户会提供一段文字问题（可能已锚定具体困境），并上传了图像材料。
你的唯一输出：一段给视觉模型执行的「特征提取任务说明」（纯文本）。
约束：
- 只在 Pivot 破局业务范围内：围绕用户所述具体问题/困境，提取图像中与回答该问题相关的可见信息。
- 要求视觉模型客观描述可见特征；不要让视觉模型下人生结论或替代破局方案。
- 若用户明确要求结合图像中的身体、手部、面部等可见维度，任务说明必须覆盖用户所问维度，不得拒答。
- 禁止在输出中使用任何示例问法、示例图片描述或示范问答。
- 不要输出对用户的回复；不要输出 JSON；只输出任务说明正文。`;

export async function generateVisionTaskBrief(input: {
  userText: string;
  dilemmaHint?: string | null;
  locale: string;
  signal?: AbortSignal;
}): Promise<string> {
  const userParts = [
    `用户文字：${input.userText.trim() || "（无文字）"}`,
    input.dilemmaHint?.trim() ? `已锚定困境摘要：${input.dilemmaHint.trim()}` : "",
    `界面语言：${input.locale}`,
  ].filter(Boolean);

  const result = await openRouterChatCompletion({
    messages: [
      { role: "system", content: TASK_BRIEF_SYSTEM },
      { role: "user", content: userParts.join("\n") },
    ],
    temperature: 0.3,
    max_tokens: 1200,
    reasoning_effort: "low",
    call_type: "attachment_vision_brief",
    phase_name: "attachment_vision",
    route_path: "once",
    provider: { allow_fallbacks: true },
    signal: input.signal,
    timeout_ms: 60_000,
  });

  const brief = result.text?.trim();
  if (!brief) throw new Error("vision_task_brief_empty");
  return brief;
}

export async function extractVisionReport(input: {
  taskBrief: string;
  imageDataUrl: string;
  signal?: AbortSignal;
}): Promise<string> {
  const content: OpenRouterMultimodalContent[] = [
    { type: "text", text: input.taskBrief },
    { type: "image_url", image_url: { url: input.imageDataUrl } },
  ];

  const messages: OpenRouterChatMessage[] = [
    {
      role: "user",
      content,
    },
  ];

  const result = await openRouterChatCompletion({
    messages,
    model: VISION_MODEL,
    temperature: 0.2,
    max_tokens: 4000,
    reasoning_effort: "off",
    call_type: "attachment_vision_m3",
    phase_name: "attachment_vision",
    route_path: "once",
    provider: { allow_fallbacks: true },
    signal: input.signal,
    timeout_ms: 120_000,
  });

  const report = result.text?.trim();
  if (!report) throw new Error("vision_report_empty");
  return report;
}

export async function runVisionBridge(input: {
  userText: string;
  imageDataUrl: string;
  dilemmaHint?: string | null;
  locale: string;
  signal?: AbortSignal;
}): Promise<string> {
  const brief = await generateVisionTaskBrief({
    userText: input.userText,
    dilemmaHint: input.dilemmaHint,
    locale: input.locale,
    signal: input.signal,
  });
  return extractVisionReport({
    taskBrief: brief,
    imageDataUrl: input.imageDataUrl,
    signal: input.signal,
  });
}
