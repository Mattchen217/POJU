from pathlib import Path
p = Path(r"lib/poju/decision-intake/topic-classify.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''  const PRIMARY_ORDER: TopicTag[] = [
    "entrepreneurship",
    "relationship",
    "relocation",
    "education",
    "career",
  ];
  const primary =
    PRIMARY_ORDER.find((t) => domainTagsAll.includes(t)) ?? domainTagsAll[0];''',
'''  type DomainTag = (typeof domainTagsAll)[number];
  const PRIMARY_ORDER: DomainTag[] = [
    "entrepreneurship",
    "relationship",
    "relocation",
    "education",
    "career",
  ];
  const primary: DomainTag | undefined =
    PRIMARY_ORDER.find((t) => domainTagsAll.includes(t)) ?? domainTagsAll[0];''',
)
p.write_text(text, encoding="utf-8")
d=p.read_bytes()
if d.startswith(b"\xef\xbb\xbf"): p.write_bytes(d[3:])
print("fixed")
