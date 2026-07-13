/**
 * Shared prompt prefix (identity / red lines / closed instance set).
 * Phase-specific task blocks stay in each phase's prompt module.
 */
export {
  buildPojuSystemPromptV6Sync,
  buildPhaseTurnContextV6,
  buildPhaseTransportInputV6,
  shouldInjectDirectedRelationsV6,
  buildDirectedRelationAuditAllowlistV6,
  loadBaseAnalysisForSessionV6,
  POJU_V6_DIRECTED_RELATION_PHASES,
} from "@/lib/llm/phases/oriental-prompt-context-v6";
