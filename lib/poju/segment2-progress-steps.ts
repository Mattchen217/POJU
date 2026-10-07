/**
 * Segment-2 Call A wait UI — map runner stage → user-facing progress line.
 * Steps mirror real work: A0 plan → dims∥spine → VOICE → finalize.
 */

export const SEGMENT2_CALL_A_PROGRESS_STEPS = [
  "starting",
  "a0_plan",
  "dims_spine",
  "voice",
  "finalize",
] as const;

export type Segment2CallAProgressStep = (typeof SEGMENT2_CALL_A_PROGRESS_STEPS)[number];

export function isSegment2CallAProgressStep(raw: string | null | undefined): raw is Segment2CallAProgressStep {
  return (
    typeof raw === "string" &&
    (SEGMENT2_CALL_A_PROGRESS_STEPS as readonly string[]).includes(raw)
  );
}

/**
 * Prefer server `current_stage`; fall back to parallel accum blob markers
 * (===dims=== / ===spine=== / ===voice===) when stage was not stamped.
 */
export function deriveSegment2CallAProgressStep(
  accumulated_content: string,
  current_stage?: string | null,
): Segment2CallAProgressStep {
  if (isSegment2CallAProgressStep(current_stage)) return current_stage;

  const blob = accumulated_content ?? "";
  const voiceIdx = blob.indexOf("===voice===");
  if (voiceIdx >= 0) {
    const voiceBody = blob.slice(voiceIdx + "===voice===".length).trim();
    if (voiceBody.length > 0) return "voice";
  }
  const dimsIdx = blob.indexOf("===dims===");
  const spineIdx = blob.indexOf("===spine===");
  if (dimsIdx >= 0 || spineIdx >= 0) {
    const dimsBody =
      dimsIdx >= 0
        ? blob.slice(dimsIdx + "===dims===".length, spineIdx >= 0 ? spineIdx : undefined).trim()
        : "";
    const spineBody =
      spineIdx >= 0
        ? blob
            .slice(
              spineIdx + "===spine===".length,
              voiceIdx >= 0 ? voiceIdx : undefined,
            )
            .trim()
        : "";
    if (dimsBody.length > 0 || spineBody.length > 0) return "dims_spine";
  }
  return "starting";
}
