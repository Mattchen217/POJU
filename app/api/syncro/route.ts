import { NextResponse } from "next/server";
import {
  getLanguageDirective,
  parseAppLocale,
} from "@/lib/prompts/language-directive";

/**
 * Syncro LLM 入口（Fix 03）。无文字输入时仅使用界面 locale（Priority 1）。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    locale?: unknown;
  };
  const locale = parseAppLocale(body.locale);
  const lang = getLanguageDirective({ locale });
  return NextResponse.json(
    {
      error: "Syncro LLM is not wired in this deployment.",
      outputLanguage: lang.outputLanguage,
    },
    { status: 501 },
  );
}
