import { NextResponse } from "next/server";

import { generateMatchAnalysis } from "@/lib/llm/services/match-analysis-service";
import {
  fingerprintText,
  withDeliveryIdempotency,
} from "@/lib/llm/services/delivery-idempotency";
import { parseAppLocale } from "@/lib/prompts/language-directive";
import type { UserProfile } from "@/lib/profile/types";

export const runtime = "nodejs";
/**
 * Single Match LLM round must finish under this budget.
 * Do not raise without also capping audit/repair second calls (see match-analysis-service).
 */
export const maxDuration = 300;

type RequestBody = {
  a_profile_id?: string;
  b_profile_id?: string;
  relationship_description?: string;
  locale?: unknown;
  a_user_profile?: UserProfile | null;
  a_base_analysis?: unknown | null;
  b_user_profile?: UserProfile | null;
  b_base_analysis?: unknown | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const locale = parseAppLocale(body.locale);

    const aId = body.a_profile_id?.trim();
    const bId = body.b_profile_id?.trim();
    const relationship = body.relationship_description?.trim();

    if (!aId || !bId || !relationship) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    if (aId === bId) {
      return NextResponse.json({ error: "same_profile" }, { status: 400 });
    }

    if (relationship.length < 10) {
      return NextResponse.json({ error: "relationship_too_short" }, { status: 400 });
    }

    const idempotencyKey = `match-report:${aId}:${bId}:${fingerprintText(relationship)}`;

    const payload = await withDeliveryIdempotency(idempotencyKey, async () => {
      const result = await generateMatchAnalysis({
        a_profile_id: aId,
        b_profile_id: bId,
        relationship_description: relationship,
        locale,
        a_user_profile: body.a_user_profile ?? null,
        a_base_analysis: body.a_base_analysis ?? null,
        b_user_profile: body.b_user_profile ?? null,
        b_base_analysis: body.b_base_analysis ?? null,
      });
      return {
        success: true as const,
        report: result.report,
        meta: result.meta,
      };
    });

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/match/analyze] error:", e);

    if (message.includes("missing_openrouter_api_key") || message.includes("OpenRouter")) {
      return NextResponse.json(
        { error: "analysis_failed", message: "Server missing OPENROUTER_API_KEY." },
        { status: 500 },
      );
    }

    if (
      message.includes("base_analysis") ||
      message.includes("Profile not found") ||
      message.includes("Profile payload missing")
    ) {
      return NextResponse.json({ error: "profile_not_ready", message }, { status: 400 });
    }

    if (message.includes("not valid JSON") || message.includes("Missing required section")) {
      return NextResponse.json({ error: "analysis_failed", message }, { status: 502 });
    }

    if (message.includes("different profiles")) {
      return NextResponse.json({ error: "same_profile", message }, { status: 400 });
    }

    return NextResponse.json({ error: "analysis_failed", message }, { status: 500 });
  }
}
