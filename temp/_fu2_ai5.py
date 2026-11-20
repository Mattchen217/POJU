from pathlib import Path

def patch():
    p = Path("lib/poju/decision-intake/answer-interpretation.ts")
    text = p.read_text(encoding="utf-8")

    def sub(old, new, label):
        nonlocal text
        old = old.replace("\r\n", "\n")
        new = new.replace("\r\n", "\n")
        if old not in text:
            raise SystemExit(f"NOT FOUND: {label}")
        text = text.replace(old, new, 1)
        print("patched", label)

    sub(
        """  const notes: string[] = [];
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
""",
        """  const notes: string[] = [];
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
""",
        "eventShell",
    )

    sub(
        """    if (code && !authorizedRoleCodes.includes(code)) {
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
""",
        """    if (code && !authorizedRoleCodes.includes(code)) {
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
""",
        "role-rejects",
    )

    sub(
        """    if (item.certainty === "unclear") {
      unresolved.push(`unclear_certainty:${item.text.slice(0, 100)}`);
      continue;
    }
""",
        """    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        reason: "unclear_certainty",
        note: `unclear_certainty:${item.text.slice(0, 100)}`,
      });
      continue;
    }
""",
        "unclear",
    )

    sub(
        """        unresolved.push(
          `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        );
        notes.push("estimated_constraint_unresolved");
""",
        """        pushUnresolvedItem({
          text: item.text,
          semantic_kind: item.semantic_kind,
          certainty: item.certainty,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
""",
        "estimated-constraint",
    )

    sub(
        """    proposed_writes,
    notes,
    interpreter: ANSWER_INTERPRETATION_VERSION,
""",
        """    proposed_writes,
    notes,
    unresolved_items: [],
    interpreter: ANSWER_INTERPRETATION_VERSION,
""",
        "interpretUserAnswer",
    )

    p.write_text(text, encoding="utf-8", newline="\n")
    print("all patches written")

patch()
