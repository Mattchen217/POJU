from pathlib import Path
import os
# who imports shared/transport or phase-transport
needles = ("@/lib/poju/shared/transport", "../lib/poju/shared/transport", "@/lib/llm/phases/phase-transport")
roots=["lib","app","scripts","components"]
for root in roots:
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for f in files:
            if not f.endswith((".ts",".tsx",".js",".mjs")):
                continue
            path=os.path.join(dirpath,f)
            try:
                text=Path(path).read_text(encoding="utf-8")
            except Exception:
                continue
            if any(n in text for n in needles) or "shared/transport" in text or "phase-transport" in text:
                for i,line in enumerate(text.splitlines(),1):
                    if "shared/transport" in line or "phase-transport" in line:
                        print(f"{path}:{i}:{line.strip()}")
