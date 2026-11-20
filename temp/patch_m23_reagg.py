from pathlib import Path
p = Path(r"lib/poju/decision-intake/fresh-session-bootstrap.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''  const dirs = reaggregateDirs(
    { ...dc, reality_facts },
    dc.dirs,
  );''',
'''  const dirs = reaggregateDirs(
    dc.dirs,
    reality_facts,
    dc.conflicts ?? [],
  );''',
)
p.write_text(text, encoding="utf-8")
print("reaggregate signature fixed")
# strip boms on touched files
for f in [
 "lib/poju/decision-intake/fresh-session-bootstrap.ts",
 "lib/poju/decision-intake/blueprint.ts",
 "lib/poju/decision-context/catalog/dir-definition-catalog.v1.ts",
]:
    p=Path(f); d=p.read_bytes();
    if d.startswith(b"\xef\xbb\xbf"):
        p.write_bytes(d[3:]); print("bom", f)
