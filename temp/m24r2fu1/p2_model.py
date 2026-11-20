# model patch
from pathlib import Path
import os
root = Path(os.environ.get("POJU_ROOT", os.getcwd()))
path = root / "lib/poju/decision-intake/answer-interpretation-model.ts"
text = path.read_text(encoding="utf-8")

def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"missing: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"ambiguous ({text.count(old)}): {label}")
    text = text.replace(old, new, 1)
    print("ok", label)

repl(
"""role_hint may suggest one of the authorized fact roles provided in context, or null. You must not invent DIR ids, DDR ids, or roles outside that authorized set. Unauthorized guesses will be discarded by code.

JSON shape:
{
  "classification": one of ${MODEL_ANSWER_CLASSIFICATIONS.join("|")},
  "extracted_items": [
    {
      "text": "verbatim or close paraphrase of one user-stated item",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_hint": "authorized role or null",
      "certainty": "explicit" | "estimated" | "unclear"
    }
  ],
  "unresolved_aspects": ["aspects that cannot be safely extracted"],
  "explanation": "short rationale, not a fact"
}`;
""",
"""Role binding:
1. Each extracted item must bind the most specific authorized role code when you can determine it.
2. role_code_hint may only be a complete string that already exists in context.authorized.fact_role_codes, or null.
3. If you cannot determine the specific role, return null. Do not guess.
4. Do not select multiple roles for one item because several might be relevant. Pick at most one role_code_hint per item.
5. Do not invent or output model-inferred DIR ids, DDR ids, or role codes. Do not construct role codes yourself.
6. Do not copy one fact into multiple extracted items with different roles.
role_hint is deprecated and is not an authorization basis. Do not use it to claim access to a role.

JSON shape:
{
  "classification": one of ${MODEL_ANSWER_CLASSIFICATIONS.join("|")},
  "extracted_items": [
    {
      "text": "verbatim or close paraphrase of one user-stated item",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_code_hint": "complete authorized role code from context.authorized.fact_role_codes, or null",
      "role_hint": null,
      "certainty": "explicit" | "estimated" | "unclear"
    }
  ],
  "unresolved_aspects": ["aspects that cannot be safely extracted"],
  "explanation": "short rationale, not a fact"
}`;
""",
"SYSTEM_PROMPT",
)

repl(
"""  const factRoleCodes =
    lastSent?.fact_role_codes && lastSent.fact_role_codes.length > 0
      ? [...lastSent.fact_role_codes]
      : targets.fact_roles.map((role) => `role:${role}`);
""",
"""  // Authorization codes come only from activeTargets() (actually-sent Plan).
  // Never invent role:${role} and never expand from Blueprint.required_fact_roles.
  const factRoleCodes = [...targets.fact_role_codes];
""",
"fact_role_codes source",
)

repl(
"""    if (row.role_hint != null && typeof row.role_hint !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_role_hint" };
    }
    if (typeof row.certainty !== "string" || !CERT_SET.has(row.certainty)) {
      return { ok: false, reason: "invalid_schema", detail: "invalid_certainty" };
    }
    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    const key = `${semantic_kind}:${normalizeComparable(text)}`;
    if (items.some((existing) => `${existing.semantic_kind}:${normalizeComparable(existing.text)}` === key)) {
      continue;
    }
    if (items.length >= MAX_EXTRACTED_ITEMS) continue;
    const hint = asTrimmedString(row.role_hint);
    items.push({
      text,
      semantic_kind,
      role_hint: hint && hint.length > 0 ? hint : null,
      certainty: row.certainty as ModelCertainty,
    });
""",
"""    if (row.role_hint != null && typeof row.role_hint !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_role_hint" };
    }
    if (row.role_code_hint != null && typeof row.role_code_hint !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "invalid_role_code_hint" };
    }
    if (typeof row.certainty !== "string" || !CERT_SET.has(row.certainty)) {
      return { ok: false, reason: "invalid_schema", detail: "invalid_certainty" };
    }
    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    const key = `${semantic_kind}:${normalizeComparable(text)}`;
    if (items.some((existing) => `${existing.semantic_kind}:${normalizeComparable(existing.text)}` === key)) {
      continue;
    }
    if (items.length >= MAX_EXTRACTED_ITEMS) continue;
    const hint = asTrimmedString(row.role_hint);
    const codeHint = asTrimmedString(row.role_code_hint);
    items.push({
      text,
      semantic_kind,
      role_hint: hint && hint.length > 0 ? hint : null,
      role_code_hint: codeHint && codeHint.length > 0 ? codeHint : null,
      certainty: row.certainty as ModelCertainty,
    });
""",
"parse role_code_hint",
)

path.write_text(text, encoding="utf-8", newline="\n")
print("patched answer-interpretation-model.ts")
