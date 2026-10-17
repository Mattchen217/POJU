# -*- coding: utf-8 -*-
import re
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()
start = html.find("const TEAM_COPY")
brace = html.find("{", start)
i = brace
depth = 0
while i < len(html):
    if html[i] == "{":
        depth += 1
    elif html[i] == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
obj = html[brace:end]
pat = re.compile(r"name:\s*'([^']+)'.*?quote:\s*'((?:\\'|[^'])*)'", re.S)
quotes = pat.findall(obj)
lines = ["COUNT %d" % len(quotes)]
for name, q in quotes:
    lines.append("--- %s len=%d" % (name, len(q)))
    lines.append(q)
    lines.append("")
# also check fr quotes that might use different quotes
# dump full en arthur etc by slicing known prefixes
for marker in [
    "From core algorithms to cognitive control",
    "When evaluating complex decisions, vague or emotional advice offers no real utility",
    "Missteps rarely come from a lack of capability; they stem from misaligned timing",
    "Making major pivots without visibility into risk creates severe resistance. Eastern OS simulates",
    "When evaluating high-stakes choices, chaotic interfaces only add unnecessary cognitive friction",
    "At life's critical intersections",
    "At life\u2019s critical intersections",
]:
    idx = obj.find(marker)
    lines.append("MARKER %r at %s" % (marker[:40], idx))
    if idx >= 0:
        # find closing quote
        # quotes are single-quoted; find end by scanning
        # better: find from quote: '
        qstart = obj.rfind("quote:", 0, idx)
        # find opening ' after quote:
        a = obj.find("'", qstart)
        # scan
        j = a + 1
        while j < len(obj):
            if obj[j] == "\\" :
                j += 2
                continue
            if obj[j] == "'":
                break
            j += 1
        lines.append(obj[a+1:j])
        lines.append("")

with open("public/_quotes_full.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(lines))
print("wrote quotes", len(quotes))
