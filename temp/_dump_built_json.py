import json
path = r"temp\_built_copy.js"
with open(path, "r", encoding="utf-8") as f:
    raw = f.read()
js = raw[raw.find("{"):]
obj = json.loads(js)
lines = []
for loc in ["en", "zh", "es", "fr"]:
    lines.append("=" * 60)
    lines.append("LOCALE " + loc)
    for k, v in obj[loc].items():
        lines.append("--- " + k + " ---")
        lines.append(v)
        lines.append("")
with open(r"temp\_built_dump.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("ok", len(lines))
