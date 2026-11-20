from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation.ts")
text = p.read_text(encoding="utf-8")

# Add unresolvedItemId export after ROLE_CODE_RE
needle = "const ROLE_CODE_RE = /^v1\\/dir\\/([^/]+)\\/role\\/([^/]+)$/;\n"
insert = needle + '''
/** Stable pending item identity: source_turn_id + extracted-item index. Never text alone. */
export function unresolvedItemId(sourceTurnId: string, extractedIndex: number): string {
  return `${sourceTurnId}#${extractedIndex}`;
}

'''
assert needle in text, "ROLE_CODE_RE not found"
text = text.replace(needle, insert, 1)

# Update pushUnresolvedItem and the extracted_items loop / definition_patch
old_push = '''  const pushUnresolvedItem = (item: {
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
'''
new_push = '''  const pushUnresolvedItem = (item: {
    extracted_index: number;
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    certainty: "explicit" | "estimated" | "unclear";
    role_code_hint?: string | null;
    reason: UnresolvedAnswerReason;
    note: string;
  }) => {
    unresolvedItems.push({
      item_id: unresolvedItemId(input.source_turn_id, item.extracted_index),
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
'''
assert old_push in text, "pushUnresolvedItem not found"
text = text.replace(old_push, new_push)

old_loop = '''  for (const item of input.draft.extracted_items) {
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;

    if (code && !authorizedRoleCodes.includes(code)) {
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

    acceptedItems.push({
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      authorizedDirId: match[1]!,
      authorizedRole: match[2]!,
      certainty: item.certainty,
    });
  }
'''
new_loop = '''  for (let extractedIndex = 0; extractedIndex < input.draft.extracted_items.length; extractedIndex++) {
    const item = input.draft.extracted_items[extractedIndex]!;
    // Production authorization uses role_code_hint only. Legacy role_hint is ignored.
    const code = item.role_code_hint ?? null;

    if (code && !authorizedRoleCodes.includes(code)) {
      pushUnresolvedItem({
        extracted_index: extractedIndex,
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
        extracted_index: extractedIndex,
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
        extracted_index: extractedIndex,
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

    acceptedItems.push({
      extracted_index: extractedIndex,
      text: item.text.slice(0, 500),
      semantic_kind: item.semantic_kind,
      authorizedDirId: match[1]!,
      authorizedRole: match[2]!,
      bound_role_code: acceptedCode,
      certainty: item.certainty,
    });
  }
'''
assert old_loop in text, "extracted_items loop not found"
text = text.replace(old_loop, new_loop)

# Update AcceptedItem type
old_acc = '''  type AcceptedItem = {
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    authorizedDirId: string;
    authorizedRole: string;
    certainty: "explicit" | "estimated" | "unclear";
  };
'''
new_acc = '''  type AcceptedItem = {
    extracted_index: number;
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    authorizedDirId: string;
    authorizedRole: string;
    bound_role_code: string;
    certainty: "explicit" | "estimated" | "unclear";
  };
'''
assert old_acc in text, "AcceptedItem not found"
text = text.replace(old_acc, new_acc)

old_uncertain = '''  for (const item of acceptedItems) {
    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        reason: "unclear_certainty",
        note: `unclear_certainty:${item.text.slice(0, 100)}`,
      });
      continue;
    }

    const verification_level: "user_asserted" | "user_estimate" =
      item.certainty === "estimated" ? "user_estimate" : "user_asserted";

    if (item.semantic_kind === "constraint") {
      if (item.certainty === "estimated" && !constraintEstimateIsPersistable()) {
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
      pushConstraintAndCompanion(
        item.text,
        item.authorizedDirId,
        item.authorizedRole,
        verification_level,
      );
      continue;
    }
    if (item.semantic_kind === "definition_patch") {
      notes.push("definition_patch_proposed_not_mapped_by_apply");
      writes.push({
        kind: "definition_patch",
        statement: item.text,
        status: "unverified",
        verification_level,
        fact_roles: [item.authorizedRole],
        related_dir_ids: [item.authorizedDirId],
      });
      continue;
    }
'''
new_uncertain = '''  for (const item of acceptedItems) {
    if (item.certainty === "unclear") {
      pushUnresolvedItem({
        extracted_index: item.extracted_index,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: item.bound_role_code,
        reason: "unclear_certainty",
        note: `unclear_certainty:${item.text.slice(0, 100)}`,
      });
      continue;
    }

    const verification_level: "user_asserted" | "user_estimate" =
      item.certainty === "estimated" ? "user_estimate" : "user_asserted";

    if (item.semantic_kind === "constraint") {
      if (item.certainty === "estimated" && !constraintEstimateIsPersistable()) {
        pushUnresolvedItem({
          extracted_index: item.extracted_index,
          text: item.text,
          semantic_kind: item.semantic_kind,
          certainty: item.certainty,
          role_code_hint: item.bound_role_code,
          reason: "estimated_constraint_not_persistable",
          note: `estimated_constraint_not_persistable:${item.text.slice(0, 100)}`,
        });
        notes.push("estimated_constraint_unresolved");
        continue;
      }
      pushConstraintAndCompanion(
        item.text,
        item.authorizedDirId,
        item.authorizedRole,
        verification_level,
      );
      continue;
    }
    if (item.semantic_kind === "definition_patch") {
      // Current apply-answer-to-dc does not persist definition_patch.
      // Do not leave this only in notes / proposed_writes — keep it pending.
      pushUnresolvedItem({
        extracted_index: item.extracted_index,
        text: item.text,
        semantic_kind: item.semantic_kind,
        certainty: item.certainty,
        role_code_hint: item.bound_role_code,
        reason: "definition_patch_not_persistable",
        note: `definition_patch_not_persistable:${item.text.slice(0, 100)}`,
      });
      notes.push("definition_patch_not_mapped_by_apply");
      continue;
    }
'''
assert old_uncertain in text, "certainty/constraint/defpatch block not found"
text = text.replace(old_uncertain, new_uncertain)

p.write_text(text, encoding="utf-8", newline="\n")
print("answer-interpretation.ts patched")
