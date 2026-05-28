import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import type { MatchSession } from "@/lib/match/types";
import type { SyncroSession } from "@/lib/syncro/types";
import type { SignData } from "@/types/oracle";

export function extractMatchSummary(session: MatchSession): Record<string, unknown> {
  const r = session.report;
  return {
    match_id: session.match_id,
    compatibility_level: r.conclusion.compatibility_level,
    compatibility_score: session.compatibility_score,
    summary: r.conclusion.summary,
    strengths: r.conclusion.strengths.slice(0, 3),
    challenges: r.conclusion.challenges.slice(0, 3),
    relationship_description: r._meta.relationship_description,
  };
}

export function extractSyncroSummary(session: SyncroSession): Record<string, unknown> {
  return {
    session_id: session.session_id,
    task_description: session.task_description,
    locale: session.locale,
    is_free: session.is_free,
    user_location: session.user_location,
    matrix: session.matrix,
    matrix_key_count: Object.keys(session.matrix ?? {}).length,
  };
}

export function extractGlyphSummary(input: {
  reading_id: string;
  question: string;
  glyph: SignData;
  reading: GlyphReadingContent;
}): Record<string, unknown> {
  return {
    reading_id: input.reading_id,
    question: input.question,
    glyph_level: input.glyph.level,
    sign_number: input.glyph.sign_number,
    classical_voice: input.reading.classical_voice?.slice(0, 400),
    meaning_for_question: input.reading.meaning_for_question?.slice(0, 400),
  };
}
