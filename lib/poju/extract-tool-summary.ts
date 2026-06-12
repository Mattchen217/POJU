import type { ToolName } from "@/lib/poju/types";

/**
 * Normalize stored tool result payload for POJU LLM injection (Step 5).
 */
export function extractToolSummary(tool: ToolName, raw_data: unknown): Record<string, unknown> {
  const data =
    raw_data && typeof raw_data === "object" && !Array.isArray(raw_data)
      ? (raw_data as Record<string, unknown>)
      : { raw: raw_data };

  switch (tool) {
    case "match":
      return {
        synergy_type: data.synergy_type ?? data.compatibility_level,
        summary: data.summary,
        key_strengths: Array.isArray(data.strengths) ? data.strengths : data.key_strengths,
        key_challenges: Array.isArray(data.challenges) ? data.challenges : data.key_challenges,
        relationship_description: data.relationship_description,
        match_id: data.match_id,
      };

    case "syncro": {
      const matrix = data.matrix ?? data.full_matrix;
      let matrixKeyCount = 0;
      if (matrix && typeof matrix === "object") {
        matrixKeyCount = Object.keys(matrix as object).length;
      }
      return {
        task_description: data.task_description,
        locale: data.locale,
        is_free: data.is_free,
        matrix_key_count: matrixKeyCount,
        full_matrix: matrix ?? null,
        true_solar_time_diff:
          data.true_solar_time_diff ??
          (typeof data._meta === "object" && data._meta && "true_solar_time_diff_minutes" in (data._meta as object)
            ? (data._meta as { true_solar_time_diff_minutes?: number }).true_solar_time_diff_minutes
            : undefined),
        user_location_summary: data.user_location_summary ?? data.user_location,
      };
    }

    case "glyph":
      return {
        question: data.question,
        glyph_drawn: data.glyph_drawn ?? data.glyph_level ?? data.sign_number,
        meaning:
          data.meaning ??
          data.meaning_for_question ??
          data.classical_voice,
        reflection: data.reflection ?? data.exploration,
        reading_id: data.reading_id,
        sign_number: data.sign_number,
      };

    default:
      return data;
  }
}
