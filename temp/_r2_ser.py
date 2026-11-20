from pathlib import Path
import os
# importers of serialize-chat-payload, callPOJULLMDirect, parseChat
needles = ("serialize-chat-payload", "pojuLlmToChatPayload", "serializePojuChatPayload", "assistant_history")
for root in ["lib","app","components","scripts"]:
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules",".next")]
        for fn in files:
            if not fn.endswith((".ts",".tsx")): continue
            path=os.path.join(dirpath,fn)
            text=Path(path).read_text(encoding="utf-8", errors="replace")
            if "serialize-chat-payload" in text or "pojuLlmToChatPayload" in text or "serializePojuChatPayload" in text:
                for i,l in enumerate(text.splitlines(),1):
                    if "serialize-chat-payload" in l or "pojuLlmToChatPayload" in l or "serializePojuChatPayload" in l:
                        print(f"{path}:{i}:{l.strip()}")

print("---- agent parse fn ----")
lines=Path("lib/poju/agent.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "function parse" in l or "function callPOJULLMDirect" in l or "function mapChat" in l or "wire.response" in l:
        print(f"{i}:{l}")
