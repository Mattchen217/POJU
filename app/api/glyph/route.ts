import { NextResponse } from "next/server";
import {
  getLanguageDirective,
  parseAppLocale,
} from "@/lib/prompts/language-directive";

/**
 * Glyph 报告 LLM 入口（Fix 03）。
 * 线上完整解读当前走 `POST /api/oracle/full-reading`；本路由保留与文档一致的路径与语言指令逻辑。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    locale?: unknown;
    question?: string;
  };
  const locale = parseAppLocale(body.locale);
  const lang = getLanguageDirective({
    locale,
    userInput: typeof body.question === "string" ? body.question : undefined,
  });
  return NextResponse.json(
    {
      error: "Glyph standalone LLM route is not wired; use /api/oracle/full-reading for readings.",
      outputLanguage: lang.outputLanguage,
    },
    { status: 501 },
  );
}
