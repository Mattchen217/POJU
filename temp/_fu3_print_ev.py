import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
p = Path(r"D:\POJU\pojulife\docs\eastern-os\decision-intake-2.0\evidence\m2-4-phase4-answer-ask\CONTRACT-M2-4-R2-FU2.md")
print("exists", p.exists(), "size", p.stat().st_size if p.exists() else 0)
print(p.read_text(encoding="utf-8")[:6000])
