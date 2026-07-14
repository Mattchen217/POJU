/**
 * Segment 2 — prompt surface.
 * Task body from breakthrough-core; shared identity from prompt-prefix.
 * Delivery readability (paren-supplement term style) is owned by DEEP_RECKONING_TASK.
 */
export {
  DEEP_RECKONING_TASK,
  buildBreakthroughCorePrompt,
} from "@/lib/llm/deepseek/breakthrough-core";

export { buildPojuSystemPromptV6Sync as segment2SharedPromptPrefix } from "@/lib/poju/shared/prompt-prefix";
