/**
 * M2.4-R2 — immutable raw answer records.
 *
 * Captured on entry to every answer path, before interpretation, and bound
 * to the question that was actually sent. Append-only; the first record for
 * a source_turn_id wins, so a replay can never rewrite what the user said.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type { AnswerEvent, AnswerInterpretationAudit, AnswerSourceRecord } from "./types";

export function answerSourceFor(
  session: POJUSessionState,
  sourceTurnId: string,
): AnswerSourceRecord | null {
  return (
    (session.intake_answer_sources ?? []).find((r) => r.source_turn_id === sourceTurnId) ?? null
  );
}

export function recordAnswerSource(
  session: POJUSessionState,
  input: {
    source_turn_id: string;
    statement: string;
    now: string;
    turn_kind: AnswerSourceRecord["turn_kind"];
  },
): POJUSessionState {
  const turnId = input.source_turn_id.trim();
  const raw = input.statement.trim();
  if (!turnId || !raw) return session;
  if (answerSourceFor(session, turnId)) return session;
  const last = session.decision_understanding?.last_sent_question ?? null;
  const record: AnswerSourceRecord = {
    source_turn_id: turnId,
    raw_user_statement: raw,
    sent_question_id: last?.plan_id ?? "",
    sent_question_text: last?.question_text ?? "",
    authorized_dir_ids: [...(last?.dir_ids ?? [])],
    authorized_ddr_ids: [...(last?.ddr_ids ?? [])],
    authorized_role_codes: [...(last?.fact_role_codes ?? [])],
    turn_kind: input.turn_kind,
    received_at: input.now,
  };
  return {
    ...session,
    intake_answer_sources: [...(session.intake_answer_sources ?? []), record],
  };
}

/** Attach the interpretation audit to the turn's record once; later calls never rewrite it. */
export function recordAnswerInterpretation(
  session: POJUSessionState,
  sourceTurnId: string,
  event: AnswerEvent,
  now: string,
): POJUSessionState {
  const records = session.intake_answer_sources ?? [];
  const index = records.findIndex((r) => r.source_turn_id === sourceTurnId);
  if (index < 0 || records[index]!.interpretation) return session;
  const interpretation: AnswerInterpretationAudit = {
    classification: event.classification,
    interpreter: event.interpreter,
    model_provider: event.model_call?.provider ?? null,
    model: event.model_call?.model ?? null,
    writes: event.proposed_writes.map((w) => ({
      kind: w.kind,
      status: w.status,
      verification_level: w.verification_level,
      fact_role: w.fact_roles[0] ?? "",
      dir_id: w.related_dir_ids[0] ?? "",
      corrects_fact_ids: [...(w.corrects_fact_ids ?? [])],
      locators: [...(w.provenance ?? [])],
    })),
    rejections: (event.grounding_rejections ?? []).map((r) => ({
      extracted_index: r.extracted_index,
      reason: r.reason,
      source_quote: r.source_quote.slice(0, 300),
    })),
    unresolved: (event.unresolved_items ?? []).map((u) => ({
      item_id: u.item_id,
      reason: u.reason,
    })),
    recorded_at: now,
  };
  const next = [...records];
  next[index] = { ...records[index]!, interpretation };
  return { ...session, intake_answer_sources: next };
}
