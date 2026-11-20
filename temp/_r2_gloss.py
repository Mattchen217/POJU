from pathlib import Path
import os
for root in ["lib"]:
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for fn in files:
            if not fn.endswith(".ts"): continue
            path=os.path.join(dirpath,fn)
            text=Path(path).read_text(encoding="utf-8", errors="replace")
            if "export function stripGlossTokensForPrompt" in text or "export function stripGloss" in text:
                for i,l in enumerate(text.splitlines(),1):
                    if "stripGloss" in l and ("export" in l or "function" in l):
                        print(f"{path}:{i}:{l.strip()}")
