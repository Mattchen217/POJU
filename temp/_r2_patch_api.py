from pathlib import Path

# route.ts
p = Path(r"app/api/poju/chat/route.ts")
text = p.read_text(encoding="utf-8")
if "attestChatPayload" not in text:
    text = text.replace(
        'import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";\n',
        'import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";\nimport { attestChatPayload } from "@/lib/poju/decision-authority/server/assistant-history-attestation";\n',
        1,
    )
    text = text.replace(
        "const payload = pojuLlmToChatPayload(llm);\n    return NextResponse.json(attachDevStateLedger(payload, body.session));",
        "const payload = attestChatPayload(pojuLlmToChatPayload(llm), body.session.session_id);\n    return NextResponse.json(attachDevStateLedger(payload, body.session));",
        1,
    )
    p.write_text(text, encoding="utf-8", newline="\n")
    print("patched route.ts")
else:
    print("route.ts already patched")

# stream
p = Path(r"lib/poju/poju-chat-stream.ts")
text = p.read_text(encoding="utf-8")
if "attestChatPayload" not in text:
    text = text.replace(
        'import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";\n',
        'import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";\nimport { attestChatPayload } from "@/lib/poju/decision-authority/server/assistant-history-attestation";\n',
        1,
    )
    old = """        send({
          type: "complete",
          ...attachDevStateLedger(
            pojuLlmToChatPayload(llm, {
              response: resolveStreamedCompleteResponse(
                llm.response,
                lastContentText,
                sessionLang,
              ),
            }),
            body.session,
          ),
        });"""
    new = """        send({
          type: "complete",
          ...attachDevStateLedger(
            attestChatPayload(
              pojuLlmToChatPayload(llm, {
                response: resolveStreamedCompleteResponse(
                  llm.response,
                  lastContentText,
                  sessionLang,
                ),
              }),
              body.session.session_id,
            ),
            body.session,
          ),
        });"""
    if old not in text:
        raise SystemExit("stream complete payload needle not found")
    text = text.replace(old, new, 1)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("patched poju-chat-stream.ts")
else:
    print("stream already patched")
