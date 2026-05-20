import { NextResponse } from "next/server";
import signsData from "../../../../public/oracle/data/signs.json";
import {
  detectDangerousGlyphQuestion,
  formatReadingApiError,
  GLYPH_SAFETY_FALLBACK,
  validateAndFinalizeReading,
} from "@/lib/glyph/reading-response";
import {
  generateGlyphReading,
  GLYPH_READING_NOT_WIRED,
} from "@/lib/llm/services/glyph-reading-service";
import { getLanguageDirective, parseAppLocale } from "@/lib/prompts/language-directive";
import type { SignData } from "@/types/oracle";

export const maxDuration = 120;
export const runtime = "nodejs";

const ALL_SIGNS = signsData as SignData[];

interface RequestBody {
  sign_number: number;
  level: string;
  user_birth: {
    year: number;
    month: number;
    day: number;
    shichen: string;
  };
  user_question: string;
  locale?: unknown;
  profile_id?: string;
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

    if (detectDangerousGlyphQuestion(body.user_question)) {
      return NextResponse.json({ reading: GLYPH_SAFETY_FALLBACK });
    }

    const signData = ALL_SIGNS.find((s) => s.sign_number === body.sign_number);
    if (!signData) {
      return NextResponse.json({ error: "Sign not found" }, { status: 404 });
    }

    const { reading: rawReading, meta } = await generateGlyphReading({
      sign: signData,
      question: body.user_question.trim(),
      locale,
      profile_id: body.profile_id,
      user_birth: body.user_birth,
    });

    const reading = validateAndFinalizeReading(rawReading, {
      question: body.user_question,
      locale,
    });

    return NextResponse.json({
      reading,
      language: langDirective.outputLanguage,
      meta,
    });
  } catch (error) {
    const message = formatReadingApiError(error);
    console.error("[oracle/full-reading]", error);

    if (message.includes(GLYPH_READING_NOT_WIRED)) {
      return NextResponse.json(
        {
          error: "glyph_reading_not_ready",
          message:
            "Glyph v5 DeepSeek reading is being migrated. Complete Step 5 to enable full readings.",
        },
        { status: 503 },
      );
    }

    if (message.includes("Invalid LLM response format")) {
      return NextResponse.json(
        { error: "Model returned non-JSON output. Please retry." },
        { status: 502 },
      );
    }

    if (message.includes("missing required fields") || message.includes("word count out of range")) {
      return NextResponse.json(
        { error: "Model response missing required reading fields." },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: `Failed to generate reading: ${message}` }, { status: 500 });
  }
}
