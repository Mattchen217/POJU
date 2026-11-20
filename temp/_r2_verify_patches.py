from pathlib import Path
# tidy agent types import if both exist
p = Path(r"lib/poju/agent.ts")
text = p.read_text(encoding="utf-8")
# show type imports
for i,l in enumerate(text.splitlines(),1):
    if "from \"@/lib/poju/types\"" in l or "AssistantHistoryAttestation" in l and "import" in l:
        print(f"{i}:{l}")

print("---- serialize ending ----")
s = Path(r"lib/poju/serialize-chat-payload.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i+len(s)-25+1}:{s[i]}" for i in range(len(s)-25, len(s))))
print("---- route snippet ----")
r = Path(r"app/api/poju/chat/route.ts").read_text(encoding="utf-8")
for i,l in enumerate(r.splitlines(),1):
    if "attest" in l or "pojuLlmToChatPayload" in l:
        print(f"{i}:{l}")
