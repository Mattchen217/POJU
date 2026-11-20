from pathlib import Path
p = Path(r"lib/poju/decision-intake/topic-classify.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''  const domainTagsAll = [...matched].filter(
    (t) =>
      t === "career" ||
      t === "entrepreneurship" ||
      t === "relationship" ||
      t === "relocation" ||
      t === "education",
  );''',
'''  const domainTagsAll = ([...matched] as TopicTag[]).filter(
    (t): t is Exclude<TopicTag, "timing" | "strategic_choice" | "other"> =>
      t === "career" ||
      t === "entrepreneurship" ||
      t === "relationship" ||
      t === "relocation" ||
      t === "education",
  );''',
)
p.write_text(text, encoding="utf-8")
d=p.read_bytes()
if d.startswith(b"\xef\xbb\xbf"): p.write_bytes(d[3:])
print("typed filter")
