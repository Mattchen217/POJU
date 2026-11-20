/**
 * Convert a validated ModelAnswerDraft into a formal AnswerEvent.
 * Targets always come from activeTargets(); model fields never authorize
 * DIR/DDR/roles or confirmation. explanation is never written as a fact.
 */
export function answerEventFromModelDraft(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  draft: ModelAnswerDraft;
}): AnswerEvent {
  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [...input.draft.unresolved_aspects];
  const authorizedRoles = targets.fact_roles;
  let cls: AnswerClass = input.draft.classification;

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
    ].slice(0, 40),
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
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
  if (authorizedRoles.length === 0) {
    notes.push("missing_authorized_fact_roles");
    return eventShell([], "invalid_input");
  }

  if (
    cls === "off_topic" ||
    cls === "invalid_input" ||
    cls === "goal_change" ||
    cls === "insight_mismatch"
  ) {
    notes.push(`${cls}_no_dc_write`);
    return eventShell([], cls);
  }

  const acceptedItems: Array<{
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    roles: string[];
    certainty: "explicit" | "estimated" | "unclear";
  }> = [];

  for (const item of input.draft.extracted_items) {
    const roleHint = item.role_hint;
    const acceptedRole =
      roleHint && authorizedRoles.includes(roleHint) ? roleHint : null;
    if (roleHint && !acceptedRole) {
      unresolved.push(`unauthorized_role_hint:${roleHint}:${item.text.slice(0, 40)}`);
      notes.push("rejected_unauthorized_role_hint");
      continue;
    }
    acceptedItems.push({
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      roles: acceptedRole ? [acceptedRole] : [...authorizedRoles],
      certainty: item.certainty,
    });
  }

  const dirs = [...targets.dir_ids];
  const writes: ProposedWrite[] = [];

  const constraintCategory = (text: string): ProposedWrite["constraint_category"] =>
    /预算|budget|钱|salary|cost|财务/i.test(text)
      ? "financial"
      : /deadline|截止|时间|timing|最晚/i.test(text)
        ? "time"
        : /不可逆|退出成本|exit/i.test(text)
          ? "exit_cost"
          : "responsibility";

  const pushConstraint = (text: string, roles: string[]) => {
    const constraintRoles = roles.includes("hard_constraint")
      ? roles
      : [...roles, "hard_constraint"];
    writes.push({
      kind: "constraint",
      statement: text,
      status: "unverified",
      verification_level: "user_asserted",
      fact_roles: constraintRoles,
      related_dir_ids: dirs,
      constraint_category: constraintCategory(text),
      rigidity: "hard",
    });
    const alreadyCompanion = writes.some(
      (w) => w.kind === "reality_fact" && w.statement === text,
    );
    if (!alreadyCompanion) {
      writes.push({
        kind: "reality_fact",
        statement: text,
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
      });
    }
  };

  if (cls === "unknown" || cls === "declined") {
    const sourceItems =
      acceptedItems.length > 0
        ? acceptedItems
        : [
            {
              text: statement.slice(0, 500),
              semantic_kind: "reality_fact" as const,
              roles: [...authorizedRoles],
              certainty: "unclear" as const,
            },
          ];
    for (const item of sourceItems) {
      writes.push({
        kind: "reality_fact",
        statement: item.text,
        status: cls,
        verification_level: "none",
        fact_roles: item.roles,
        related_dir_ids: dirs,
      });
    }
    return eventShell(writes, cls);
  }

  for (const item of acceptedItems) {
    if (item.semantic_kind === "constraint") {
      pushConstraint(item.text, item.roles);
      continue;
    }
    if (item.semantic_kind === "definition_patch") {
      notes.push("definition_patch_proposed_not_mapped_by_apply");
      writes.push({
        kind: "definition_patch",
        statement: item.text,
        status: "unverified",
        verification_level:
          item.certainty === "estimated" ? "user_estimate" : "user_asserted",
        fact_roles: item.roles,
        related_dir_ids: dirs,
      });
      continue;
    }

    const notExplicit =
      cls === "estimate" ||
      cls === "vague_answer" ||
      item.certainty === "estimated" ||
      item.certainty === "unclear";
    writes.push({
      kind: "reality_fact",
      statement: item.text,
      status: "unverified",
      verification_level: notExplicit ? "user_estimate" : "user_asserted",
      fact_roles: item.roles,
      related_dir_ids: dirs,
    });
  }

  return eventShell(writes, cls);
}
