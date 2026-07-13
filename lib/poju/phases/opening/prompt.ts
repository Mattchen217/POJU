/**
 * Opening phase (segment 1) — prompt surface.
 * Task rules live in opening-phase-v6; shared identity lives in shared/prompt-prefix.
 */
export {
  POJU_V6_OPENING_PHASE_RULES,
  buildOpeningTaskBlockV6,
  callOpeningPhaseV6,
} from "@/lib/llm/phases/opening-phase-v6";

export { buildPojuSystemPromptV6Sync as openingSharedPromptPrefix } from "@/lib/poju/shared/prompt-prefix";
