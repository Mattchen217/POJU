import { NextResponse } from "next/server";
import {
  getLanguageDirective,
  parseAppLocale,
} from "@/lib/prompts/language-directive";

/**
 * POJU 多轮对话 LLM 入口（Fix 03）。
 * 当前仓库尚未接入 Anthropic；已预置 locale → `getLanguageDirective()` 供后续接模型时复用。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    locale?: unknown;
    question?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  };
  const locale = parseAppLocale(body.locale);
  const lang = getLanguageDirective({
    locale,
    userInput: typeof body.question === "string" ? body.question : undefined,
    conversationHistory: body.conversationHistory,
  });
  return NextResponse.json(
    {
      error: "POJU agent LLM is not wired in this deployment.",
      outputLanguage: lang.outputLanguage,
    },
    { status: 501 },
  );
}
