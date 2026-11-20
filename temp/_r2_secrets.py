from pathlib import Path
import os
# client imports of shared/transport or poju/shared
needles = ("@/lib/poju/shared", "from \"@/lib/poju/shared/transport\"")
for root in ["components", "app", "lib/poju"]:
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for f in files:
            if not f.endswith((".ts",".tsx")): continue
            path=os.path.join(dirpath,f)
            text=Path(path).read_text(encoding="utf-8", errors="replace")
            if "@/lib/poju/shared" in text or "shared/transport" in text:
                for i,line in enumerate(text.splitlines(),1):
                    if "shared" in line and "import" in line:
                        print(f"{path}:{i}:{line.strip()}")

print("---- HMAC / createHmac / ASSISTANT / LEDGER_SECRET / process.env secrets in lib/poju and lib/llm ----")
rx = ("createHmac", "createHash", "HMAC", "LEDGER", "SERVER_SECRET", "SIGNING", "provenance", "attestation", "message_attestation", "crypto")
for root in ["lib/poju", "lib/llm", "app/api/poju"]:
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for f in files:
            if not f.endswith((".ts",".tsx")): continue
            path=os.path.join(dirpath,f)
            text=Path(path).read_text(encoding="utf-8", errors="replace")
            if any(s in text for s in rx):
                for i,line in enumerate(text.splitlines(),1):
                    if any(s in line for s in rx):
                        print(f"{path}:{i}:{line.strip()}")
