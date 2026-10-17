# -*- coding: utf-8 -*-
from pathlib import Path
import re, subprocess
html = Path("public/v2-landing.html").read_text(encoding="utf-8")
# TEAM_COPY extract
start = html.find("const TEAM_COPY")
brace = html.find("{", start)
i = brace; depth = 0
while i < len(html):
    if html[i] == "{": depth += 1
    elif html[i] == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
obj = html[brace:end]
forbidden = ["deterministic","客观确定","确保你每次","environmental cycles","暗涌与周期","顺势而为","complete confidence","cognitive control","认知控制","determinista","déterministe","confianza completa","ciclos ambientales","cycles environnementaux","control cognitivo","contrôle cognitif"]
print("FORBIDDEN remaining:", [f for f in forbidden if f in obj] or "NONE")
print("has structured decision model:", "structured decision model" in obj)
print("has decision framing:", "decision framing" in obj)
print("has 「个人决策导航系统」:", "「个人决策导航系统」" in obj)
# Design UI markers in dirty working tree vs HEAD
diff = subprocess.check_output(["git","diff","HEAD","--","public/v2-landing.html"], text=True, encoding="utf-8", errors="replace")
print("dirty diff lines:", diff.count("\n"))
# look for gold glow / hero typography hints in dirty diff
for needle in ["v2-glass-strip__panel", "gold", "glow", "hero", "text-shadow", "letter-spacing"]:
    if needle.lower() in diff.lower():
        print("design marker in dirty diff:", needle)
# conflict markers?
print("conflict markers:", "<<<<<<<" in html or "=======" in html.split("TEAM_COPY")[0][:100])  # weak
print("has <<<<<<<:", "<<<<<<<" in html)
# tip
print(subprocess.check_output(["git","log","-1","--oneline"], text=True).strip())
print(subprocess.check_output(["git","rev-parse","HEAD"], text=True).strip())
print("stash list:", subprocess.check_output(["git","stash","list"], text=True).strip()[:200] or "(empty)")
# cleanup probe files in public/
for p in Path("public").glob("_team*"):
    p.unlink(); print("removed", p)
for p in ["public/_fr_block.js","public/_quotes_full.txt","public/_team_dump_out.txt","public/_team_struct.txt"]:
    pp=Path(p)
    if pp.exists():
        pp.unlink(); print("removed", pp)
