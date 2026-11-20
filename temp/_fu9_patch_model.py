from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts")
text = p.read_text(encoding="utf-8")

old_src = '''Source grounding:
1. Every extracted item must include source_quote: the exact user-answer substring that supports that item.
2. Do not return a paraphrase as source_quote.
3. One item must have exactly one source_quote.
4. Never use context facts, model inference, or likely implications as source evidence.
5. If no exact source quote exists in the current user answer, do not emit a persistable extracted item. Put the leftover uncertainty in unresolved_aspects instead.
'''
new_src = '''Source grounding:
1. Every extracted item must include source_quote: the exact user-answer substring that supports that item.
2. Do not return a paraphrase as source_quote.
3. One item must have exactly one source_quote.
4. text must equal source_quote exactly. Do not put a paraphrase, summary, interpretation, or inferred implication in text.
5. Never use context facts, model inference, or likely implications as source evidence.
6. If no exact source quote exists in the current user answer, do not emit a persistable extracted item. Put the leftover uncertainty in unresolved_aspects instead.
7. For classification "goal_change", put only the exact proposed new decision-target phrase in a definition_patch item, with text equal to source_quote. Do not use the entire introductory sentence as the target.
'''
assert old_src in text, "SYSTEM_PROMPT source grounding block not found"
text = text.replace(old_src, new_src, 1)

old_json = '''      "text": "verbatim or close paraphrase of one user-stated item",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_code_hint": "complete authorized role code from context.authorized.fact_role_codes, or null",
      "role_hint": null,
      "certainty": "explicit" | "estimated" | "unclear",
      "source_quote": "exact substring of the current user answer, not a paraphrase"
'''
new_json = '''      "text": "must equal source_quote exactly; never a paraphrase or interpretation",
      "semantic_kind": "reality_fact" | "constraint" | "definition_patch",
      "role_code_hint": "complete authorized role code from context.authorized.fact_role_codes, or null",
      "role_hint": null,
      "certainty": "explicit" | "estimated" | "unclear",
      "source_quote": "exact substring of the current user answer, not a paraphrase"
'''
assert old_json in text, "SYSTEM_PROMPT JSON text field not found"
text = text.replace(old_json, new_json, 1)

# Stop silently dropping blank/oversized quotes so deterministic grounding
# can record structured rejections. Still never manufacture a quote.
old_parse = '''    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    // Preserve the original quote. Do not manufacture one, and do not
    // truncate a too-long quote into a shorter string that might falsely ground.
    const source_quote = row.source_quote;
    if (source_quote.trim().length === 0) continue;
    if (source_quote.length > MAX_SOURCE_QUOTE_LENGTH) continue;
'''
new_parse = '''    const text = row.text.trim().slice(0, MAX_ITEM_TEXT_LENGTH);
    if (!text) continue;
    // Preserve the original quote. Do not manufacture one, and do not
    // truncate a too-long quote into a shorter string that might falsely ground.
    // Blank or oversized quotes stay on the item so the deterministic
    // grounding gate can record a structured rejection.
    const source_quote = row.source_quote;
'''
assert old_parse in text, "parser quote skip block not found"
text = text.replace(old_parse, new_parse, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("patched answer-interpretation-model.ts")