from pathlib import Path
import os
needles = ("pojuLlmToChatPayload", "callLLMViaAPI", "role: \"assistant\"", "role: 'assistant'", "/api/poju/chat")
# scoped search in components/poju, lib/poju (not too wide)
for root in ["components/poju", "lib/poju", "app"]:
    if not Path(root).exists():
        continue
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for f in files:
            if not f.endswith((".ts",".tsx")): continue
            path=os.path.join(dirpath,f)
            text=Path(path).read_text(encoding="utf-8", errors="replace")
            hits=[]
            for i,line in enumerate(text.splitlines(),1):
                if any(n in line for n in needles):
                    hits.append(f"{path}:{i}:{line.strip()}")
            if hits and any("/api/poju/chat" in h or "pojuLlmToChatPayload" in h or "callLLMViaAPI" in h or "role: \"assistant\"" in h for h in hits):
                # only print relevant files
                if any(k in path.replace("\\\\","/").replace("\\","/") for k in [
                    "POJUChatUI","serialize-chat","agent.ts","phase-router","chat-api","call-llm","usePoju","session","stream"
                ]) or "/api/poju/chat" in "\n".join(hits) or "callLLMViaAPI" in "\n".join(hits) or "pojuLlmToChatPayload" in "\n".join(hits):
                    print("\n".join(hits[:40]))
                    print("---")
