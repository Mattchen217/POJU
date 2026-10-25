import { NextResponse } from "next/server";
import { z } from "zod";

import { runMatchClarificationTurn } from "@/lib/match/clarification/match-clarification-service";
import type { MatchPersonFacts } from "@/lib/match/clarification/match-person-facts";
import { parseAppLocale } from "@/lib/prompts/language-directive";

export const runtime = "nodejs";
export const maxDuration = 60;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
  options: z.array(z.string()).optional(),
});

const PersonSchema = z.object({
  label: z.enum(["Match A", "Match B"]),
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23).optional(),
  gender: z.enum(["M", "F", "X"]),
});

const BodySchema = z.object({
  locale: z.unknown().optional(),
  messages: z.array(MessageSchema).max(40),
  prior_fields: z
    .object({
      relationship_type: z.string().optional(),
      concern_focus: z.string().optional(),
      concrete_matter: z.string().optional(),
    })
    .optional()
    .nullable(),
  person_a: PersonSchema.optional().nullable(),
  person_b: PersonSchema.optional().nullable(),
  after_gate_supplement: z.boolean().optional(),
});

function asPerson(raw: z.infer<typeof PersonSchema> | null | undefined): MatchPersonFacts | null {
  if (!raw) return null;
  return {
    label: raw.label,
    year: raw.year,
    month: raw.month,
    day: raw.day,
    hour: raw.hour,
    gender: raw.gender,
  };
}

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const locale = parseAppLocale(parsed.data.locale);
    const prior = parsed.data.prior_fields
      ? {
          relationship_type: parsed.data.prior_fields.relationship_type?.trim() ?? "",
          concern_focus: parsed.data.prior_fields.concern_focus?.trim() ?? "",
          concrete_matter: parsed.data.prior_fields.concrete_matter?.trim() ?? "",
        }
      : null;

    const result = await runMatchClarificationTurn({
      locale,
      messages: parsed.data.messages,
      prior_fields: prior,
      person_a: asPerson(parsed.data.person_a),
      person_b: asPerson(parsed.data.person_b),
      after_gate_supplement: Boolean(parsed.data.after_gate_supplement),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/match/clarify] error:", e);
    if (message.includes("missing_openrouter_api_key") || message.includes("OpenRouter")) {
      return NextResponse.json(
        { error: "clarify_failed", message: "Server missing OPENROUTER_API_KEY." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "clarify_failed", message }, { status: 500 });
  }
}
