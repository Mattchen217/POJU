# -*- coding: utf-8 -*-
from pathlib import Path
html = Path("public/v2-landing.html").read_text(encoding="utf-8")
# line ending check vs HEAD
import subprocess
raw = subprocess.check_output(["git", "show", "HEAD:public/v2-landing.html"])
print("HEAD has CRLF", b"\r\n" in raw, "LF-only sample", raw.count(b"\n"), "CR", raw.count(b"\r"))
cur = Path("public/v2-landing.html").read_bytes()
print("CUR has CRLF", b"\r\n" in cur, "LF", cur.count(b"\n"), "CR", cur.count(b"\r"))

# confirm new strings
checks = [
    "decision framing",
    "structured decision model",
    "从核心算法到决策框架",
    "结构化决策模型",
    "「个人决策导航系统」",
    "calmer sense of control",
    "encuadre de decisiones",
    "modelo de decisión estructurado",
    "cadrage décisionnel",
    "modèle de décision structuré",
    "clearer signals, not guesswork",
    "steadier judgment",
]
for c in checks:
    print(("OK" if c in html else "MISSING"), c)

# ensure BUILT_COPY / methodology not changed vs HEAD for those regions
# diff stat
