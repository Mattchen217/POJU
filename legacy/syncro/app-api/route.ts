import { NextResponse } from "next/server";
import {
  getSyncroLanguageDirective,
  parseAppLocale,
} from "@/lib/prompts/language-directive";

/**
 * Syncro LLM 入口（Fix 03）。矩阵文案语言以 task_description 为准。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    locale?: unknown;
    task_description?: string;
  };
  const locale = parseAppLocale(body.locale);
  const lang = getSyncroLanguageDirective(
    locale,
    typeof body.task_description === "string" ? body.task_description : "",
  );
  return NextResponse.json(
    {
      error: "Syncro LLM is not wired in this deployment.",
      outputLanguage: lang.outputLanguage,
    },
    { status: 501 },
  );
}
