/**
 * Salvage Call A from parallel accumulated_content (===dims=== / ===spine=== / ===voice===).
 * Used when the background worker streamed LLM output but died before writing terminal job state.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import {
  fallbackVoiceFromDims,
  finalizeMergedCallA,
  mergeSegment2APartials,
  parseDimsPartial,
  parseSpinePartial,
  parseVoiceResponse,
} from "@/lib/llm/deepseek/segment2-a-parallel";
import { attachMetaphysicsPackToBreakthroughCore } from "@/lib/poju/attach-metaphysics-pack";
import { validateBreakthroughCoreSpine } from "@/lib/llm/deepseek/segment2-spine-readiness";

export type Segment2ParallelSalvageResult =
  | { ok: true; breakthrough_core: BreakthroughCore }
  | { ok: false; reason: string };

function extractSection(blob: string, label: "dims" | "spine" | "voice"): string {
  const re = new RegExp(`===${label}===\\s*([\\s\\S]*?)(?====|$)`, "i");
  const m = blob.match(re);
  return (m?.[1] ?? "").trim();
}

export function salvageSegment2ParallelAccumulated(
  accumulated_content: string,
  locale: string,
  base_analysis: unknown,
): Segment2ParallelSalvageResult {
  const blob = accumulated_content.trim();
  if (blob.length < 200) {
    return { ok: false, reason: "accumulated_too_short" };
  }

  const dimsText = extractSection(blob, "dims");
  const spineText = extractSection(blob, "spine");
  const voiceText = extractSection(blob, "voice");

  if (dimsText.length < 40 || spineText.length < 40) {
    return { ok: false, reason: "missing_dims_or_spine_section" };
  }

  try {
    const dims = parseDimsPartial(dimsText);
    const spine = parseSpinePartial(spineText);
    let response = "";
    if (voiceText.length > 10) {
      try {
        response = parseVoiceResponse(voiceText);
      } catch {
        response = fallbackVoiceFromDims(dims, spine.situation_conclusion, locale);
      }
    } else {
      response = fallbackVoiceFromDims(dims, spine.situation_conclusion, locale);
    }

    const merged = mergeSegment2APartials({ dims, spine, response });
    const { breakthrough_core: sanitizedCore } = finalizeMergedCallA(merged, locale);
    const spineCheck = validateBreakthroughCoreSpine(sanitizedCore);
    if (!spineCheck.ok) {
      return { ok: false, reason: spineCheck.reason };
    }

    const breakthrough_core = attachMetaphysicsPackToBreakthroughCore(
      sanitizedCore,
      base_analysis,
    );
    return { ok: true, breakthrough_core };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg || "salvage_parse_failed" };
  }
}
