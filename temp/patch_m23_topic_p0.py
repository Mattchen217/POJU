from pathlib import Path

# topic-classify: primary domain tag for seeding
p = Path(r"lib/poju/decision-intake/topic-classify.ts")
text = p.read_text(encoding="utf-8")
old = '''  const domainTags = [...matched].filter(
    (t) =>
      t === "career" ||
      t === "entrepreneurship" ||
      t === "relationship" ||
      t === "relocation" ||
      t === "education",
  );'''
new = '''  const domainTagsAll = [...matched].filter(
    (t) =>
      t === "career" ||
      t === "entrepreneurship" ||
      t === "relationship" ||
      t === "relocation" ||
      t === "education",
  );
  // Seed one primary topic pack to avoid multi-tag explosion blocking Freeze;
  // notes retain all matched tags for Understanding.
  const PRIMARY_ORDER: TopicTag[] = [
    "entrepreneurship",
    "career",
    "relationship",
    "relocation",
    "education",
  ];
  const primary =
    PRIMARY_ORDER.find((t) => domainTagsAll.includes(t)) ?? domainTagsAll[0];
  const domainTags = primary ? [primary] : [];
  if (domainTagsAll.length > 1) {
    notes.push(`multi_tag_matched:${domainTagsAll.join(",")};primary:${primary}`);
  }'''
if old not in text:
    raise SystemExit('domainTags block not found')
text = text.replace(old, new)
# Also fix tags assembly later that uses domainTags - the `const tags: TopicTag[] = [...domainTags]` should also note all
text = text.replace(
'''  const tags: TopicTag[] = [...domainTags];
  if (matched.has("timing") && !tags.includes("timing")) tags.push("timing");''',
'''  const tags: TopicTag[] = [...domainTagsAll];
  if (matched.has("timing") && !tags.includes("timing")) tags.push("timing");''',
)
p.write_text(text, encoding="utf-8")
print("primary topic seed")

# Elevate topic pack DIRs to P0 in production-intake-ask when page_07_emit
p2 = Path(r"lib/poju/decision-context/production-intake-ask.ts")
t2 = p2.read_text(encoding="utf-8")
old2 = '''    const gate = gateInfo?.gate_class ?? "P2";
    const may_affect_p5_ranking =
      gateInfo?.may_affect_p5_ranking ?? dir.may_affect_p5_ranking === true;
    const decision_critical =
      gateInfo?.decision_critical ?? may_affect_p5_ranking;'''
new2 = '''    let gate = gateInfo?.gate_class ?? "P2";
    const may_affect_p5_ranking =
      gateInfo?.may_affect_p5_ranking ?? dir.may_affect_p5_ranking === true;
    let decision_critical =
      gateInfo?.decision_critical ?? may_affect_p5_ranking;
    // Decision-specific topic pack DIRs are investigation-critical for this session.
    if (
      blueprint?.page_07_emit &&
      blueprint.directions.some(
        (d) =>
          d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(dir.dir_id),
      )
    ) {
      gate = "P0";
      decision_critical = true;
    }'''
if old2 not in t2:
    raise SystemExit('gate block not found in ask')
p2.write_text(t2.replace(old2, new2), encoding="utf-8")
print("topic P0 gate in ask")

for f in [r"lib/poju/decision-intake/topic-classify.ts", r"lib/poju/decision-context/production-intake-ask.ts"]:
    pp=Path(f); d=pp.read_bytes()
    if d.startswith(b"\xef\xbb\xbf"):
        pp.write_bytes(d[3:])
