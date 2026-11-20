from pathlib import Path
import os
# env secret names
needles = ("process.env.", "POJU_", "NEXTAUTH_SECRET", "SIGNING", "HMAC", "SECRET")
# scoped
for path in [
    "lib/poju/decision-authority/server",
    "lib/poju/decision-authority",
    "lib/llm",
]:
    p=Path(path)
    if p.is_file():
        files=[p]
    elif p.is_dir():
        files=list(p.glob("*.ts")) + list(p.glob("server/*.ts"))
    else:
        continue
    for f in files:
        text=f.read_text(encoding="utf-8", errors="replace")
        if "process.env" in text or "SECRET" in text:
            for i,l in enumerate(text.splitlines(),1):
                if "process.env" in l or "SECRET" in l or "createHmac" in l:
                    print(f"{f}:{i}:{l.strip()}")
print("---- parseChat / wire fields ----")
p=Path("lib/poju/agent.ts")
lines=p.read_text(encoding="utf-8").splitlines()
# find parseChatPayload or similar
for i,l in enumerate(lines,1):
    if "function parse" in l or "CHAT_PAYLOAD" in l or "wire." in l and i>=2200 and i<=2400:
        pass
# print parse function
start=None
for i,l in enumerate(lines,1):
    if "function parse" in l and ("Chat" in l or "Wire" in l or "LLM" in l or "Api" in l):
        start=i
        print("FOUND", i, l)
