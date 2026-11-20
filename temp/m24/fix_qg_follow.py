from pathlib import Path
p = Path(r"lib/poju/decision-intake/question-generation.ts")
t = p.read_text(encoding="utf-8")
old = '''  if (missing.length === 0) {
    return null;
  }

  for (const roleFocus of missing) {
'''
new = '''  // Roles may all have some evidence while DIR remains unknown/partial/conflict —
  // still produce a depth follow-up rather than falsely reporting no remaining need.
  const followUps =
    missing.length > 0
      ? missing
      : dir && dir.current_state !== "known" && dir.current_state !== "n_a"
        ? [
            {
              role: input.selected.score.gap_type || "follow_up",
              question_focus:
                input.selected.score.gap_type === "conflict"
                  ? "请澄清相互冲突的说法，哪一项是正确的"
                  : input.selected.score.gap_type === "partial"
                    ? `关于「${dir.need}」，还有哪些关键细节没说清`
                    : focusForRole(
                        (dir.required_fact_roles ?? [])[0] ?? "situation",
                        dir,
                      ),
              known_evidence: factsForDir(input.dc, dir.dir_id)
                .map((f) => f.statement)
                .slice(0, 2),
            },
          ]
        : [];

  if (followUps.length === 0) {
    return null;
  }

  for (const roleFocus of followUps) {
'''
if old not in t:
    raise SystemExit('anchor missing')
p.write_text(t.replace(old, new), encoding='utf-8')
print('patched generateQuestionText follow-up')
