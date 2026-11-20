# splice Cases G-M before the R2 static check
from pathlib import Path
import os
root = Path(os.environ.get("POJU_ROOT", os.getcwd()))
src = root / "scripts/test-m1-production-adaptive-question-loop.ts"
snippet_candidates = [
    Path(__file__).with_name("cases_gm.ts"),
    root / "temp" / "m24r2fu1" / "cases_gm.ts",
    root / "temp" / "cases_gm.ts",
]
snippet = next((p for p in snippet_candidates if p.exists()), None)
if snippet is None:
    raise SystemExit("missing cases_gm.ts")
text = src.read_text(encoding="utf-8")
anchor = '    await check("M2.4-R2 static: production path uses model interpretation before DC write", async () => {'
if anchor not in text:
    raise SystemExit("static check anchor missing")
if "M2.4-R2-FU1 Case G:" in text:
    raise SystemExit("Cases G-M already inserted")
gm = snippet.read_text(encoding="utf-8")
if not gm.endswith("\n"):
    gm += "\n"
text = text.replace(anchor, gm + "\n" + anchor, 1)
src.write_text(text, encoding="utf-8", newline="\n")
print("inserted Cases G-M")
