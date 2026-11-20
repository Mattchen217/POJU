/**
 * applyAnswerEventToSessionDc persists Constraint.verification_level as
 * "user_asserted". An estimated Constraint therefore cannot be persisted
 * without being disguised as asserted; it stays pending.
 */
function constraintEstimateIsPersistable(): boolean {
  return false;
}

function constraintCategoryFor(text: string): ProposedWrite["constraint_category"] {
  return /预算|budget|钱|salary|cost|财务/i.test(text)
    ? "financial"
    : /deadline|截止|时间|timing|最晚/i.test(text)
      ? "time"
      : /不可逆|退出成本|exit/i.test(text)
        ? "exit_cost"
        : "responsibility";
}

/**
 * Earlier propositional facts (other turns) on the same DIR + role.
 * Used to link a correction to what it corrects; never deletes them.
 */
export function correctableFactIds(
  session: POJUSessionState,
  sourceTurnId: string,
  dirId: string,
  role: string,
): string[] {
  const facts = session.decision_context?.reality_facts ?? [];
  return facts
    .filter(
      (f) =>
        f.source_turn_id !== sourceTurnId &&
        (f.status === "unverified" || f.status === "confirmed") &&
        (f.related_dir_ids ?? []).includes(dirId) &&
        (f.fact_roles ?? []).includes(role),
    )
    .map((f) => f.fact_id);
}

/**
 * Convert a validated ModelAnswerDraft into a formal AnswerEvent.
 *
 * Source authority: every persistable write carries the raw user statement
 * of source_turn_id verbatim. Model text is never the statement; an item is
 * persistable only when its source_quote is located in that raw statement
 * and its role code is authorized by the actually-sent question.
 * Targets always come from activeTargets(); model fields never authorize
 * DIR/DDR/roles or confirmation. explanation is never written as a fact.
 */
export function answerEventFromModelDraft(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  draft: ModelAnswerDraft;
  source_record?: AnswerSourceRecord | null;
  model_call?: { provider: string | null; model: string | null } | null;
}): AnswerEvent {
  const statement = input.statement.trim();
  const statementFitsFact = statement.length > 0 && statement.length <= FACT_STATEMENT_MAX_CHARS;
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const groundingRejections: SourceQuoteRejection[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  const authorizedDirIds = [...targets.dir_ids];
  const authorizedDdrIds = [...targets.ddr_ids];
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const aspectTexts = input.draft.unresolved_aspects
    .map((text) => text.slice(0, 200))
    .filter((text) => text.trim().length > 0);
  const persistableClass =
    cls !== "off_topic" &&
    cls !== "invalid_input" &&
    cls !== "goal_change" &&
    cls !== "insight_mismatch";
  const hasPersistableContent =
    input.draft.extracted_items.length > 0 || cls === "unknown" || cls === "declined";
  if (!statementFitsFact && persistableClass && hasPersistableContent) {
    aspectTexts.push(LONG_ANSWER_ASPECT_TEXT);
    notes.push("source_statement_exceeds_fact_limit");
  }
  const structuredAspects: UnresolvedModelAspect[] = aspectTexts.map((text, aspectIndex) => ({
    aspect_id: unresolvedAspectId(input.source_turn_id, aspectIndex),
    source_turn_id: input.source_turn_id,
    text,
    sent_question_id: sentQuestionId,
    authorized_role_codes: [...authorizedRoleCodes],
    authorized_dir_ids: [...authorizedDirIds],
  }));

  const controlItems: IntakeControlItem[] = [];
  if (cls === "goal_change") {
    const extractedTarget = extractGroundedProposedDecisionTarget(input.draft, statement);
    groundingRejections.push(...extractedTarget.rejections);
    const goalChangeTarget = extractedTarget.proposed_decision_target;
    for (const r of extractedTarget.rejections) notes.push(`rejected_${r.reason}`);
    if (!goalChangeTarget) notes.push("goal_change_target_unresolved");
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "goal_change"),
      kind: "goal_change",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      ...(goalChangeTarget ? { proposed_decision_target: goalChangeTarget } : {}),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
      source_statement: statement,
      attempts: 0,
    });
  } else if (cls === "insight_mismatch") {
    controlItems.push({
      item_id: intakeControlItemId(input.source_turn_id, "insight_mismatch"),
      kind: "insight_mismatch",
      source_turn_id: input.source_turn_id,
      text: statement.slice(0, 2000),
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      authorized_dir_ids: [...authorizedDirIds],
      status: "pending",
      source_statement: statement,
      attempts: 0,
    });
  }
  // Unresolved aspects are never dropped, whatever the classification.
  for (const aspect of structuredAspects) {
    controlItems.push({
      item_id: aspect.aspect_id,
      kind: "unresolved_aspect",
      source_turn_id: aspect.source_turn_id,
      text: aspect.text,
      sent_question_id: aspect.sent_question_id,
      authorized_role_codes: [...aspect.authorized_role_codes],
      authorized_dir_ids: [...aspect.authorized_dir_ids],
      status: "pending",
      source_statement: statement,
      attempts: 0,
    });
  }

  const pushUnresolvedItem = (item: {
    extracted_index: number;
    span: LocatedSourceSpan;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    certainty: "explicit" | "estimated" | "unclear";
    role_code_hint?: string | null;
    reason: UnresolvedAnswerReason;
    note: string;
  }) => {
    unresolvedItems.push({
      item_id: unresolvedItemId(input.source_turn_id, item.extracted_index),
      source_turn_id: input.source_turn_id,
      text: item.span.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      certainty: item.certainty,
      reason: item.reason,
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      raw_role_code_hint: item.role_code_hint ?? null,
      source_statement: statement,
      source_quote: item.span.text,
      located_start: item.span.start,
      located_end: item.span.end,
      authorized_dir_ids: [...authorizedDirIds],
      authorized_ddr_ids: [...authorizedDdrIds],
      status: "pending",
      attempts: 0,
    });
    unresolved.push(item.note);
  };

  const eventShell = (writes: ProposedWrite[], classification: AnswerClass): AnswerEvent => ({
    event_id: `ae_${input.source_turn_id}`.slice(0, 80),
    session_id: input.session.session_id,
    client_turn_id: input.source_turn_id,
    raw_text: statement.slice(0, 2000),
    classification,
    targets: {
      dir_ids: [...targets.dir_ids],
      ddr_ids: [...targets.ddr_ids],
      direction_id: targets.direction_id,
    },
    proposed_writes: writes,
    notes: [
      ...notes,
      ...unresolved.map((u) => `unresolved:${u}`),
      ...groundingRejections.map(
        (r) =>
          `grounding_rejected:${r.reason}:${r.extracted_index}:${r.source_quote.slice(0, 80)}`,
      ),
    ].slice(0, 40),
    unresolved_items: unresolvedItems,
    unresolved_aspects: structuredAspects,
    grounding_rejections: groundingRejections,
    control_items: controlItems,
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
    source_record: input.source_record ?? null,
    model_call: input.model_call ?? null,
  });

  if (targets.auth_error === "missing_authorized_fact_roles") {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }
  if (
    targets.auth_error === "missing_authorized_answer_target" ||
    (targets.dir_ids.length === 0 && targets.ddr_ids.length === 0)
  ) {
    notes.push("missing_authorized_answer_target");
    return eventShell([], "invalid_input");
  }
  if (authorizedRoleCodes.length === 0 || targets.fact_roles.length === 0) {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }

  if (cls === "off_topic" || cls === "invalid_input") {
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }
  if (cls === "goal_change" || cls === "insight_mismatch") {
    if (cls === "insight_mismatch") {
      for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
        const item = input.draft.extracted_items[extractedIndex]!;
        const grounding = groundExtractedItem(item, statement);
        if (!grounding.ok) {
          groundingRejections.push(groundingRejection(extractedIndex, item, grounding.reason));
          notes.push(`rejected_${grounding.reason}`);
        }
      }
    }
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }

  type AcceptedItem = {
    extracted_index: number;
    span: LocatedSourceSpan;
    item: ModelAnswerDraft["extracted_items"][number];
    authorizedDirId: string;
    authorizedRole: string;
    bound_role_code: string;
  };
  const acceptedItems: AcceptedItem[] = [];

  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    const grounding = groundExtractedItem(item, statement);
    if (!grounding.ok) {
      groundingRejections.push(groundingRejection(extractedIndex, item, grounding.reason));
      notes.push(`rejected_${grounding.reason}`);
      continue;
    }
    if (!statementFitsFact) {
      groundingRejections.push(
        groundingRejection(extractedIndex, item, "source_statement_exceeds_fact_limit"),
      );
      continue;
    }
    const span = grounding.span;
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;
    if (code && !authorizedRoleCodes.includes(code)) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unauthorized_role_code",
        note: `unauthorized_role_code:${code}:${span.text.slice(0, 40)}`,
      });
      notes.push("rejected_unauthorized_role_code");
      continue;
    }
    if (!code && authorizedRoleCodes.length !== 1) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unlocated_role_code",
        note: `unlocated_role_code:${span.text.slice(0, 100)}`,
      });
      notes.push("rejected_null_role_code_multi_auth");
      continue;
    }
    const acceptedCode = code ?? authorizedRoleCodes[0]!;
    const match = ROLE_CODE_RE.exec(acceptedCode);
    if (!match) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
        span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: acceptedCode,
        reason: "illegal_role_code",
        note: `illegal_role_code:${acceptedCode}:${span.text.slice(0, 40)}`,
      });
      notes.push("rejected_illegal_role_code");
      continue;
    }
    acceptedItems.push({
      extracted_index: extractedIndex,
      span,
      item,
      authorizedDirId: match[1]!,
      authorizedRole: match[2]!,
      bound_role_code: acceptedCode,
    });
  }

  const provenanceOf = (accepted: AcceptedItem | null): ProposedWriteProvenance => ({
    source_turn_id: input.source_turn_id,
    statement_basis: "raw_user_statement",
    extracted_index: accepted?.extracted_index ?? null,
    extracted_text: accepted ? accepted.item.text.slice(0, 500) : null,
    source_quote: accepted ? accepted.span.text : null,
    located_start: accepted?.span.start ?? null,
    located_end: accepted?.span.end ?? null,
    model_source_start: accepted?.item.source_start ?? null,
    model_source_end: accepted?.item.source_end ?? null,
  });

  // One write per (kind, DIR, role): several quotes of the same answer that
  // bind to the same role are one fact whose statement is the raw answer.
  const writes: ProposedWrite[] = [];
  const upsertWrite = (write: ProposedWrite) => {
    const existing = writes.find(
      (w) =>
        w.kind === write.kind &&
        w.related_dir_ids[0] === write.related_dir_ids[0] &&
        w.fact_roles[0] === write.fact_roles[0],
    );
    if (!existing) {
      writes.push(write);
      return;
    }
    existing.provenance = [...(existing.provenance ?? []), ...(write.provenance ?? [])];
    if (write.verification_level === "user_estimate") existing.verification_level = "user_estimate";
  };

  if (cls === "unknown" || cls === "declined") {
    if (!statementFitsFact) return eventShell([], cls);
    if (input.draft.extracted_items.length === 0) {
      // The user answered the sent question as a whole with unknown / declined.
      for (const code of authorizedRoleCodes) {
        const match = ROLE_CODE_RE.exec(code);
        if (!match) continue;
        upsertWrite({
          kind: "reality_fact",
          statement,
          status: cls,
          verification_level: "none",
          fact_roles: [match[2]!],
          related_dir_ids: [match[1]!],
          provenance: [provenanceOf(null)],
        });
      }
      notes.push(`${cls}_applies_to_sent_question`);
      return eventShell(writes, cls);
    }
    for (const accepted of acceptedItems) {
      upsertWrite({
        kind: "reality_fact",
        statement,
        status: cls,
        verification_level: "none",
        fact_roles: [accepted.authorizedRole],
        related_dir_ids: [accepted.authorizedDirId],
        provenance: [provenanceOf(accepted)],
      });
    }
    return eventShell(writes, cls);
  }

  for (const accepted of acceptedItems) {
    const { item } = accepted;
    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        extracted_index: accepted.extracted_index,
        span: accepted.span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: accepted.bound_role_code,
        reason: "unclear_certainty",
        note: `unclear_certainty:${accepted.span.text.slice(0, 100)}`,
      });
      continue;
    }
    const verification_level: "user_asserted" | "user_estimate" =
      item.certainty === "estimated" || cls === "estimate" ? "user_estimate" : "user_asserted";
    const fact_roles = [accepted.authorizedRole];
    const related_dir_ids = [accepted.authorizedDirId];
    const provenance = [provenanceOf(accepted)];

    if (item.semantic_kind === "definition_patch") {
      pushUnresolvedItem({
        extracted_index: accepted.extracted_index,
        span: accepted.span,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: accepted.bound_role_code,
        reason: "definition_patch_not_persistable",
        note: `definition_patch_not_persistable:${accepted.span.text.slice(0, 100)}`,
      });
      notes.push("definition_patch_not_mapped_by_apply");
      continue;
    }
    if (item.semantic_kind === "constraint") {
      if (verification_level === "user_estimate" && !constraintEstimateIsPersistable()) {
        pushUnresolvedItem({
          extracted_index: accepted.extracted_index,
          span: accepted.span,
          semantic_kind: item.semantic_kind,
          certainty: "estimated",
          role_code_hint: accepted.bound_role_code,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${accepted.span.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
        continue;
      }
      upsertWrite({
        kind: "constraint",
        statement,
        status: "unverified",
        verification_level,
        fact_roles,
        related_dir_ids,
        constraint_category: constraintCategoryFor(statement),
        rigidity: "hard",
        provenance,
      });
    }
    // Constraints also carry a companion fact so role evidence can progress.
    upsertWrite({
      kind: "reality_fact",
      statement,
      status: "unverified",
      verification_level,
      fact_roles,
      related_dir_ids,
      provenance,
    });
  }

  if (cls === "correction") {
    for (const write of writes) {
      if (write.kind !== "reality_fact") continue;
      const corrected = correctableFactIds(
        input.session,
        input.source_turn_id,
        write.related_dir_ids[0]!,
        write.fact_roles[0]!,
      );
      if (corrected.length > 0) {
        write.corrects_fact_ids = corrected;
        notes.push(`correction_links:${corrected.join(",")}`.slice(0, 200));
      }
    }
  }

  return eventShell(writes, cls);
}
