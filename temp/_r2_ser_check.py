from pathlib import Path
p = Path(r"lib/poju/serialize-chat-payload.ts")
text = p.read_text(encoding="utf-8")
print("lines", len(text.splitlines()))
print("count export function pojuLlmToChatPayload", text.count("export function pojuLlmToChatPayload"))
print("count export function chatPayloadFromWire", text.count("export function chatPayloadFromWire"))
print("count CHAT_PAYLOAD_FIELDS", text.count("export const CHAT_PAYLOAD_FIELDS"))
print("count parseAssistantHistoryAttestationFromWire", text.count("function parseAssistantHistoryAttestationFromWire"))
# show middle around 230-280
lines=text.splitlines()
print("======= 220-280 =======")
print("\n".join(f"{i+1}:{lines[i]}" for i in range(219, min(280,len(lines)))))
