import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildPojuDriftJudgeSystemPrompt,
  buildPojuGuidedTemplatePrompt,
  buildPojuPhase3SystemPrompt,
  buildPojuPhase5SystemPrompt,
} from "@/lib/prompts/poju-phase-prompts";
import { getLanguageDirective, parseAppLocale } from "@/lib/prompts/language-directive";
import type { SessionMessage, SessionState } from "@/lib/poju/types";
import {
  POJU_GEMINI_MODEL,
  pojuDriftGenerationConfig,
  pojuMainGenerationConfig,
} from "@/lib/llm/gemini-poju-config";

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

type Part = { text?: string; thought?: boolean };

/** 思考链片段可能出现在 parts 中；只拼接对用户可见的 text。 */
function extractPublicModelText(response: { candidates?: Array<{ content?: { parts?: Part[] } }> }): string {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  const chunks: string[] = [];
  for (const p of parts) {
    if (p.thought) continue;
    if (typeof p.text === "string" && p.text.length) chunks.push(p.text);
  }
  return chunks.join("").trim();
}

function recentTranscript(messages: SessionMessage[], maxPairs = 8): string {
  const tail = messages.slice(-maxPairs * 2);
  return tail
    .map((m) => `${m.role === "user" ? "User" : "POJU"}: ${m.text}`)
    .join("\n\n")
    .slice(0, 12000);
}

/**
 * 规则层判定 drift 后由 LLM 二次确认（不启用思考模式，JSON 输出）。
 * @returns `false` = 仍同主题（放行）；`true` = 离题（拒绝）；`null` = 未调用或解析失败。
 */
export async function confirmRuleBasedDriftWithLLM(
  anchor: string,
  incoming: string,
  locale: string,
): Promise<boolean | null> {
  const genAI = getGeminiClient();
  if (!genAI) return null;
  const appLocale = parseAppLocale(locale);
  const model = genAI.getGenerativeModel({
    model: POJU_GEMINI_MODEL,
    systemInstruction: buildPojuDriftJudgeSystemPrompt(anchor, incoming, appLocale),
  });
  try {
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Return only one JSON object." }] }],
      generationConfig: pojuDriftGenerationConfig({ temperature: 0.1, maxOutputTokens: 128 }) as import("@google/generative-ai").GenerationConfig,
    });
    const raw = res.response as unknown as { candidates?: Array<{ content?: { parts?: Part[] } }> };
    const text = extractPublicModelText(raw) || (res.response as { text?: () => string }).text?.() || "";
    const json = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim()) as { sameTopic?: boolean };
    if (typeof json.sameTopic === "boolean") {
      return !json.sameTopic;
    }
  } catch {
    return null;
  }
  return null;
}

export async function generatePojuPhaseReply(params: {
  session: SessionState;
  locale: string;
  userInput: string;
  templateReply: string;
  phaseBefore: number;
  phaseAfter: number;
}): Promise<string | null> {
  const { session, locale, userInput, templateReply, phaseBefore, phaseAfter } = params;
  const genAI = getGeminiClient();
  if (!genAI) return null;

  const appLocale = parseAppLocale(locale);
  const lang = getLanguageDirective({
    locale: appLocale,
    userInput,
    conversationHistory: session.messages.map((m) => ({
      role: m.role,
      content: m.text,
    })),
  });

  const deepPhase =
    (phaseBefore === 3 && phaseAfter === 3) || (phaseBefore === 5 && phaseAfter === 5);
  const system = deepPhase
    ? `${phaseAfter === 5 ? buildPojuPhase5SystemPrompt(session, appLocale) : buildPojuPhase3SystemPrompt(session, appLocale)}

${lang.directive}

If you cannot comply, output the fallback verbatim:
---
${templateReply}
---
Otherwise write the best POJU reply (no meta-commentary).`
    : `${buildPojuGuidedTemplatePrompt(session, appLocale, phaseBefore, phaseAfter, templateReply)}

${lang.directive}`;

  const model = genAI.getGenerativeModel({
    model: POJU_GEMINI_MODEL,
    systemInstruction: system,
  });

  const history = recentTranscript(session.messages);
  const userBlock = `Recent conversation:\n${history}\n\nLatest user message:\n${userInput}`;

  const genCfg = pojuMainGenerationConfig({
    temperature: deepPhase ? 0.65 : 0.55,
    maxOutputTokens: deepPhase ? 2200 : 1200,
  });

  try {
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userBlock }] }],
      // thinkingConfig 在官方 REST 已支持；@google/generative-ai 的 GenerationConfig 类型尚未声明该字段。
      generationConfig: genCfg as import("@google/generative-ai").GenerationConfig,
    });
    const raw = res.response as unknown as { candidates?: Array<{ content?: { parts?: Part[] } }> };
    const text = extractPublicModelText(raw) || res.response.text().trim();
    if (text.length > 12) return text;
  } catch {
    return null;
  }
  return null;
}
