from pathlib import Path
p = Path("lib/poju/decision-intake/answer-interpretation-model.ts")
text = p.read_text(encoding="utf-8")

old = '''export const MAX_EXTRACTED_ITEMS = 8;
export const MAX_ITEM_TEXT_LENGTH = 500;
export const MAX_UNRESOLVED_ASPECTS = 16;
export const MAX_ASPECT_TEXT_LENGTH = 200;
export const MAX_EXPLANATION_LENGTH = 2000;
'''
new = '''export const MAX_EXTRACTED_ITEMS = 8;
export const MAX_ITEM_TEXT_LENGTH = 500;
export const MAX_SOURCE_QUOTE_LENGTH = 2000;
export const MAX_UNRESOLVED_ASPECTS = 16;
export const MAX_ASPECT_TEXT_LENGTH = 200;
export const MAX_EXPLANATION_LENGTH = 2000;
'''
assert old in text
text = text.replace(old, new, 1)

old = '''5. Do not invent or output model-inferred DIR ids, DDR ids, or role codes. Do not construct role codes yourself.
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
'''
new = '''5. Do not invent or output model-inferred DIR ids, DDR ids, or role codes. Do not construct role codes yourself.
6. Do not copy one fact into multiple extracted items with different roles.
role_hint is deprecated and is not an authorization basis. Do not use it to claim access to a role.

Source grounding:
1. Every extracted item must include source_quote: the exact user-answer substring that supports that item.
2. Do not return a paraphrase as source_quote.
3. One item must have exactly one source_quote.
4. Never use context facts, model inference, or likely implications as source evidence.
5. If no exact source quote exists in the current user answer, do not emit a persistable extracted item. Put the leftover uncertainty in unresolved_aspects instead.

JSON shape:
{
  "classification": one of ${MODEL_ANSWER_CLASSIFICATIONS.join("|")},
  "extracted_items": [
    {
      "text": "verbatim or close paraphrase of one user-stated item",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_code_hint": "complete authorized role code from context.authorized.fact_role_codes, or null",
      "role_hint": null,
      "certainty": "explicit" | "estimated" | "unclear",
      "source_quote": "exact substring of the current user answer, not a paraphrase"
    }
  ],
  "unresolved_aspects": ["aspects that cannot be safely extracted"],
  "explanation": "short rationale, not a fact"
}`;
'''
assert old in text, "SYSTEM_PROMPT block not found"
text = text.replace(old, new, 1)

old = '''    if (typeof row.certainty !== "string" || !CERT_SET.has(row.certainty)) {
      return { ok: false, reason: "invalid_schema", detail: "invalid_certainty" };
    }
    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    // Same text can be two distinct extracted items (different item_id / role).
    // Do not use text alone as identity or drop the second item.
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
'''
new = '''    if (typeof row.certainty !== "string" || !CERT_SET.has(row.certainty)) {
      return { ok: false, reason: "invalid_schema", detail: "invalid_certainty" };
    }
    if (typeof row.source_quote !== "string") {
      return { ok: false, reason: "invalid_schema", detail: "source_quote_not_string" };
    }
    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    // Preserve the original quote. Do not manufacture one, and do not
    // truncate a too-long quote into a shorter string that might falsely ground.
    const source_quote = row.source_quote;
    if (source_quote.trim().length === 0) continue;
    if (source_quote.length > MAX_SOURCE_QUOTE_LENGTH) continue;
    const semantic_kind = row.semantic_kind as ModelSemanticKind;
    // Same text can be two distinct extracted items (different item_id / role).
    // Do not use text alone as identity or drop the second item.
    if (items.length >= MAX_EXTRACTED_ITEMS) continue;
    const hint = asTrimmedString(row.role_hint);
    const codeHint = asTrimmedString(row.role_code_hint);
    items.push({
      text,
      semantic_kind,
      role_hint: hint && hint.length > 0 ? hint : null,
      role_code_hint: codeHint && codeHint.length > 0 ? codeHint : null,
      certainty: row.certainty as ModelCertainty,
      source_quote,
    });
'''
assert old in text, "parse item block not found"
text = text.replace(old, new, 1)

p.write_text(text.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
print("model file patched")
