# -*- coding: utf-8 -*-
from pathlib import Path

out = Path(r"D:\POJU\pojulife\lib\poju\baseline-portrait-live-export-css.ts")
files = [
    Path(r"D:\POJU\pojulife\styles\delivery-book-stage.css"),
    Path(r"D:\POJU\pojulife\styles\poju-celestial-matrix.css"),
]
ws = Path(r"D:\POJU\pojulife\styles\workspace.css").read_text(encoding="utf-8")
lines = ws.splitlines()
ranges = []
i = 0
while i < len(lines):
    if "workspace-scroll" in lines[i]:
        s = i
        while s > 0 and "workspace-scroll" not in lines[s] and "{" not in lines[s]:
            s -= 1
        # walk back to include full selector list
        while s > 0 and lines[s - 1].strip() and not lines[s - 1].strip().startswith("/*") and "{" not in lines[s - 1]:
            s -= 1
            if lines[s].strip().endswith(","):
                continue
            if "workspace-scroll" in lines[s] or lines[s].strip().endswith(","):
                continue
            break
        depth = 0
        e = s
        started = False
        while e < len(lines):
            depth += lines[e].count("{") - lines[e].count("}")
            if "{" in lines[e]:
                started = True
            e += 1
            if started and depth <= 0:
                break
        ranges.append((s, e))
        i = e
    else:
        i += 1

merged = []
for s, e in sorted(ranges):
    if merged and s <= merged[-1][1]:
        merged[-1] = (merged[-1][0], max(merged[-1][1], e))
    else:
        merged.append((s, e))
ws_extract = "\n".join("\n".join(lines[s:e]) for s, e in merged)
print("workspace-scroll extract chars", len(ws_extract), "n_ranges", len(merged))

extras = """
html, body { margin:0; padding:0; height:100%; overflow:hidden; background:#0B0815; }
.delivery-book-stage { height:100%; min-height:0; }
.baseline-live-export-root { height:100%; }
.baseline-live-export-pane[hidden] { display:none !important; }
.delivery-book-stage__icon-btn img { width:18px; height:18px; display:block; filter: invert(86%) sepia(18%) saturate(600%) hue-rotate(6deg) brightness(95%); }
"""

css = extras + "\n"
for f in files:
    css += f"\n/* ==== {f.name} ==== */\n" + f.read_text(encoding="utf-8") + "\n"
css += "\n/* ==== workspace-scroll (from workspace.css) ==== */\n" + ws_extract + "\n"

# JSON-stringify style for TS string (safer than template literal)
import json
out.write_text(
    "/** Auto-embedded real BaselinePortraitBook CSS for live createRoot export (SoT16 §11).\n"
    " * Source: styles/delivery-book-stage.css + poju-celestial-matrix.css + workspace-scroll.\n"
    " * Regenerate: python temp/_gen_baseline_live_export_css.py\n"
    " */\n"
    f"export const BASELINE_PORTRAIT_LIVE_EXPORT_CSS: string = {json.dumps(css)};\n",
    encoding="utf-8",
)
print("wrote", out, "css_len", len(css), "file_len", out.stat().st_size)
