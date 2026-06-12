import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import type { MatchSession } from "@/lib/match/types";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { SyncroSession } from "@/lib/syncro/types";
import type { SignData } from "@/types/oracle";

function trimText(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Full Match payload for POJU delivery handoff (both charts + report). */
export async function extractMatchHandoffPayload(
  session: MatchSession,
): Promise<Record<string, unknown>> {
  const r = session.report;
  const [profileA, profileB] = await Promise.all([
    getStoredProfile(session.a_profile_id),
    getStoredProfile(session.b_profile_id),
  ]);

  return {
    handoff_source: "delivery_page",
    match_id: session.match_id,
    a_profile_id: session.a_profile_id,
    b_profile_id: session.b_profile_id,
    primary_profile_id: session.a_profile_id,
    synergy_type: r.conclusion.synergy_type,
    resonance_index: session.resonance_index,
    relationship_description: session.relationship_description,
    summary: r.conclusion.summary,
    strengths: r.conclusion.strengths.slice(0, 5),
    challenges: r.conclusion.challenges.slice(0, 5),
    report_sections: {
      analysis_a: {
        title: r.analysis_a.title,
        summary: r.analysis_a.summary,
        detail: trimText(r.analysis_a.detail, 1200),
      },
      analysis_b: {
        title: r.analysis_b.title,
        summary: r.analysis_b.summary,
        detail: trimText(r.analysis_b.detail, 1200),
      },
      combined: {
        title: r.combined.title,
        summary: r.combined.summary,
        detail: trimText(r.combined.detail, 1200),
        five_elements_interaction: trimText(r.combined.five_elements_interaction, 800),
      },
      conclusion: {
        title: r.conclusion.title,
        summary: r.conclusion.summary,
        detail: trimText(r.conclusion.detail, 1200),
      },
      recommendations: {
        title: r.recommendations.title,
        summary: r.recommendations.summary,
        actions: r.recommendations.actions.slice(0, 4).map((a) => ({
          title: a.title,
          detail: trimText(a.detail, 400),
        })),
      },
    },
    profile_a_base_analysis: hasBaseAnalysisPayload(
      normalizeBaseAnalysisInput(profileA?.base_analysis),
    )
      ? profileA?.base_analysis
      : null,
    profile_b_base_analysis: hasBaseAnalysisPayload(
      normalizeBaseAnalysisInput(profileB?.base_analysis),
    )
      ? profileB?.base_analysis
      : null,
  };
}

export function extractMatchSummary(session: MatchSession): Record<string, unknown> {
  const r = session.report;
  return {
    match_id: session.match_id,
    synergy_type: r.conclusion.synergy_type,
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
    handoff_source: "delivery_page",
    reading_id: input.reading_id,
    question: input.question,
    glyph_level: input.glyph.level,
    sign_number: input.glyph.sign_number,
    classical_voice: input.reading.classical_voice?.slice(0, 800),
    meaning_for_question: input.reading.meaning_for_question?.slice(0, 800),
    hidden_tension: input.reading.hidden_tension?.slice(0, 400),
    your_moment: input.reading.your_moment?.slice(0, 400),
    exploration: input.reading.exploration?.text?.slice(0, 800),
    reflection_question: input.reading.reflection_question?.slice(0, 400),
  };
}
