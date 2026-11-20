from pathlib import Path
p = Path(r"lib/poju/decision-intake/understanding-state.ts")
t = p.read_text(encoding="utf-8")
start = t.find("function unmetRolesForDir")
end = t.find("\nfunction understandingFingerprint", start)
assert start >= 0 and end > start, (start, end)
new_fn = '''function unmetRolesForDir(
  dir: { dir_id: string; required_fact_roles?: string[] },
  reality_facts: Array<{
    related_dir_ids?: string[];
    fact_roles?: string[];
    status: string;
  }>,
): string[] {
  const required = dir.required_fact_roles ?? [];
  if (!required.length) return [];
  const facts = reality_facts.filter((f) =>
    (f.related_dir_ids ?? []).includes(dir.dir_id),
  );
  return required.filter((role) => {
    const hit = facts.some(
      (f) =>
        (f.fact_roles ?? []).includes(role) &&
        f.status !== "unknown" &&
        f.status !== "declined",
    );
    return !hit;
  });
}
'''
t2 = t[:start] + new_fn + t[end:]
p.write_text(t2, encoding="utf-8")
print("simplified unmetRolesForDir")
