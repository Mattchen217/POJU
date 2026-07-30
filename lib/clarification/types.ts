/** Shared clarification module types (product-agnostic shell). */

export type ClarificationRole = "user" | "assistant";

export type ClarificationMessage = {
  role: ClarificationRole;
  content: string;
  /** Assistant-only quick replies (2–3 strings). */
  options?: string[];
};

/** Match clarification structured fields (product config). */
export type MatchClarificationFields = {
  relationship_type: string;
  concern_focus: string;
  concrete_matter: string;
};

export type ClarificationTurnResult = {
  response: string;
  options?: string[];
  understanding_sufficient: boolean;
  fields: MatchClarificationFields;
  /** Deterministic gate summary when sufficient (server-built). */
  summary_for_confirm?: string;
};

/** Birth + gender facts for Match A / Match B (clarification context). */
export type { MatchPersonFacts } from "@/lib/match/clarification/match-person-facts";

