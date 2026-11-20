from pathlib import Path
p = Path("lib/poju/decision-intake/answer-interpretation.ts")
text = p.read_text(encoding="utf-8")

old_shell_start = '''  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [...input.draft.unresolved_aspects];
  const authorizedRoleCodes = targets.fact_role_codes;
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
'''

new_shell_start = '''  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const notes: string[] = [];
  const unresolved: string[] = [...input.draft.unresolved_aspects];
  const unresolvedItems: UnresolvedAnswerItem[] = [];
  const authorizedRoleCodes = targets.fact_role_codes;
  let cls: AnswerClass = input.draft.classification;
  const sentQuestionId =
    input.session.decision_understanding?.last_sent_question?.plan_id ?? "";

  const pushUnresolvedItem = (item: {
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    certainty: "explicit" | "estimated" | "unclear";
    role_code_hint?: string | null;
    reason: UnresolvedAnswerReason;
    note: string;
  }) => {
    unresolvedItems.push({
      source_turn_id: input.source_turn_id,
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      certainty: item.certainty,
      reason: item.reason,
      sent_question_id: sentQuestionId,
      authorized_role_codes: [...authorizedRoleCodes],
      raw_role_code_hint: item.role_code_hint ?? null,
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
    ].slice(0, 40),
    unresolved_items: unresolvedItems,
    interpreter: MODEL_ANSWER_INTERPRETER_VERSION,
  });
'''

if old_shell_start not in text:
    raise SystemExit("eventShell start not found")
text = text.replace(old_shell_start, new_shell_start, 1)

# Replace role-binding rejection paths
old_unauth = '''    if (code && !authorizedRoleCodes.includes(code)) {
      unresolved.push(`unauthorized_role_code:${code}:${item.text.slice(0, 40)}`);
      notes.push("rejected_unauthorized_role_code");
      continue;
    }

    if (!code && authorizedRoleCodes.length !== 1) {
      unresolved.push(`unlocated_role_code:${item.text.slice(0, 100)}`);
      notes.push("rejected_null_role_code_multi_auth");
      continue;
    }

    const acceptedCode = code ?? authorizedRoleCodes[0]!;
    const match = ROLE_CODE_RE.exec(acceptedCode);
    if (!match) {
      unresolved.push(`illegal_role_code:${acceptedCode}:${item.text.slice(0, 40)}`);
      notes.push("rejected_illegal_role_code");
      continue;
    }
'''

new_unauth = '''    if (code && !authorizedRoleCodes.includes(code)) {
      pushUnresolvedItem({
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unauthorized_role_code",
        note: `unauthorized_role_code:${code}:${item.text.slice(0, 40)}`,
      });
      notes.push("rejected_unauthorized_role_code");
      continue;
    }

    if (!code && authorizedRoleCodes.length !== 1) {
      pushUnresolvedItem({
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: code,
        reason: "unlocated_role_code",
        note: `unlocated_role_code:${item.text.slice(0, 100)}`,
      });
      notes.push("rejected_null_role_code_multi_auth");
      continue;
    }

    const acceptedCode = code ?? authorizedRoleCodes[0]!;
    const match = ROLE_CODE_RE.exec(acceptedCode);
    if (!match) {
      pushUnresolvedItem({
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: acceptedCode,
        reason: "illegal_role_code",
        note: `illegal_role_code:${acceptedCode}:${item.text.slice(0, 40)}`,
      });
      notes.push("rejected_illegal_role_code");
      continue;
    }
'''

if old_unauth not in text:
    raise SystemExit("role reject paths not found")
text = text.replace(old_unauth, new_unauth, 1)

old_unclear = '''    if (item.certainty === "unclear") {
      unresolved.push(`unclear_certainty:${item.text.slice(0, 100)}`);
      continue;
    }
'''
new_unclear = '''    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        reason: "unclear_certainty",
        note: `unclear_certainty:${item.text.slice(0, 100)}`,
      });
      continue;
    }
'''
if old_unclear not in text:
    raise SystemExit("unclear path not found")
text = text.replace(old_unclear, new_unclear, 1)

old_est = '''      if (item.certainty === "estimated" && !constraintEstimateIsPersistable()) {
        unresolved.push(
          `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        );
        notes.push("estimated_constraint_unresolved");
        continue;
      }
'''
new_est = '''      if (item.certainty === "estimated" && !constraintEstimateIsPersistable()) {
        pushUnresolvedItem({
          text: item.text,
          semantic_kind: item.semantic_kind,
          certainty: item.certainty,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
        continue;
      }
'''
if old_est not in text:
    raise SystemExit("estimated constraint path not found")
text = text.replace(old_est, new_est, 1)

# interpretUserAnswer must include unresolved_items
old_interp = '''    proposed_writes,
    notes,
    interpreter: ANSWER_INTERPRETATION_VERSION,
  });
}
'''
new_interp = '''    proposed_writes,
    notes,
    unresolved_items: [],
    interpreter: ANSWER_INTERPRETATION_VERSION,
  });
}
'''
if old_interp not in text:
    raise SystemExit("interpretUserAnswer return not found")
text = text.replace(old_interp, new_interp, 1)

# Also add structured missing-target unresolved? Not required as item-level.
# Auth errors stay as notes / invalid_input.

p.write_text(text, encoding="utf-8", newline="\n")
print("answerEventFromModelDraft unresolved structured; interpretUserAnswer updated")
