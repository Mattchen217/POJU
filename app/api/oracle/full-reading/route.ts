import { NextResponse } from "next/server";
import signsData from "../../../../public/oracle/data/signs.json";
import {
  detectDangerousGlyphQuestion,
  formatReadingApiError,
  GLYPH_SAFETY_FALLBACK,
} from "@/lib/glyph/reading-response";
import { generateGlyphReading } from "@/lib/llm/services/glyph-reading-service";
import { getLanguageDirective, parseAppLocale } from "@/lib/prompts/language-directive";
import type { SignData } from "@/types/oracle";
import type { UserProfile } from "@/lib/profile/types";

export const maxDuration = 120;
export const runtime = "nodejs";

const ALL_SIGNS = signsData as SignData[];

interface RequestBody {
  sign_number: number;
  level?: string;
  user_question: string;
  locale?: unknown;
  profile_id?: string;
  user_profile?: UserProfile | null;
  base_analysis?: unknown | null;
  conversation_history?: Array<{ role: string; content: string }>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const locale = parseAppLocale(body.locale);
    const langDirective = getLanguageDirective({
      locale,
      userInput: body.user_question,
      conversationHistory: body.conversation_history,
    });

    if (!body.sign_number || !body.user_question?.trim()) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    if (!body.profile_id?.trim()) {
      return NextResponse.json(
        { error: "profile_id required (send user_profile + base_analysis from client)" },
        { status: 400 },
      );
    }

    if (detectDangerousGlyphQuestion(body.user_question)) {
      return NextResponse.json({ reading: GLYPH_SAFETY_FALLBACK });
    }

    const signData = ALL_SIGNS.find((s) => s.sign_number === body.sign_number);
    if (!signData) {
      return NextResponse.json({ error: "Sign not found" }, { status: 404 });
    }

    const { reading, meta } = await generateGlyphReading({
      sign: signData,
      question: body.user_question.trim(),
      locale,
      profile_id: body.profile_id,
      user_profile: body.user_profile ?? null,
      base_analysis: body.base_analysis ?? null,
    });

    return NextResponse.json({
      reading,
      language: langDirective.outputLanguage,
      meta,
    });
  } catch (error) {
    const message = formatReadingApiError(error);
    console.error("[oracle/full-reading]", error);

    if (message.includes("missing_openrouter_api_key")) {
      return NextResponse.json(
        { error: "Server missing OPENROUTER_API_KEY for DeepSeek readings." },
        { status: 500 },
      );
    }

    if (message.includes("not valid JSON") || message.includes("missing required")) {
      return NextResponse.json(
        { error: "Model response invalid. Please retry.", message },
        { status: 502 },
      );
    }

    if (message.includes("base_analysis")) {
      return NextResponse.json({ error: "profile_not_ready", message }, { status: 400 });
    }

    return NextResponse.json({ error: `Failed to generate reading: ${message}` }, { status: 500 });
  }
}
