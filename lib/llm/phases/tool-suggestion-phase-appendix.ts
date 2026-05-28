import {
  buildNewCycleDetectionBlock,
  buildToolSuggestionJsonSchemaExtra,
  buildToolSuggestionRules,
} from "@/lib/llm/prompts/tool-suggestion-rules";
import { getActiveCycle } from "@/lib/poju/cycle-manager";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";
import { resolveTimezoneForToolRules } from "@/lib/poju/tool-suggestion";

export function buildToolSuggestionPhaseAppendix(
  input: PhaseLLMInput,
  options: { includeNewCycleDetection: boolean },
): string {
  const active_cycle = getActiveCycle(input.session);
  const tz = resolveTimezoneForToolRules(input);
  const parts = [
    buildToolSuggestionRules({ active_cycle, user_location: { timezone: tz } }),
  ];
  if (options.includeNewCycleDetection) {
    parts.unshift(buildNewCycleDetectionBlock(active_cycle));
  }
  parts.push(
    `\n## tool_suggestion / cycle 字段（追加到本阶段 JSON）\n${buildToolSuggestionJsonSchemaExtra(options.includeNewCycleDetection)}`,
  );
  return parts.join("\n\n");
}
