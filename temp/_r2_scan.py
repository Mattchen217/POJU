from pathlib import Path
import os, re
for p in [Path(r"lib/llm/phases/phase-transport.ts"), Path(r"lib/poju/shared/transport.ts")]:
    print("FILE", p, "exists", p.exists(), "lines", len(p.read_text(encoding="utf-8").splitlines()) if p.exists() else 0)
roots=["lib","app","scripts","components"]
for root in roots:
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for f in files:
            if f.endswith((".ts",".tsx",".js")):
                path=os.path.join(dirpath,f)
                try:
                    text=Path(path).read_text(encoding="utf-8")
                except Exception:
                    continue
                if "sanitizeClientPromptHistory" in text or "formatPhaseMessageHistory" in text:
                    for i,line in enumerate(text.splitlines(),1):
                        if "sanitizeClientPromptHistory" in line or "formatPhaseMessageHistory" in line or "phase-transport" in line or "shared/transport" in line:
                            print(f"{path}:{i}:{line.strip()}")
