from pathlib import Path
p = Path(r"lib/poju/decision-intake/topic-classify.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
'''  const PRIMARY_ORDER: TopicTag[] = [
    "entrepreneurship",
    "career",
    "relationship",
    "relocation",
    "education",
  ];''',
'''  // career keywords are broad (离职/辞职); prefer more specific domain tags first.
  const PRIMARY_ORDER: TopicTag[] = [
    "entrepreneurship",
    "relationship",
    "relocation",
    "education",
    "career",
  ];''',
)
p.write_text(text, encoding="utf-8")
d=p.read_bytes()
if d.startswith(b"\xef\xbb\xbf"):
    p.write_bytes(d[3:])
print("primary order fixed")
