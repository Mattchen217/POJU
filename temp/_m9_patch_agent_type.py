from pathlib import Path
a = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
text = a.read_text(encoding="utf-8")
needle = "  assistant_history_attestation?: AssistantHistoryAttestation;\n}> {"
# there may be two occurrences - the type of callLLMViaAPI
idx = text.find("async function callLLMViaAPI")
if idx < 0:
    raise SystemExit("callLLMViaAPI not found")
# find the closing of the return type just after callLLMViaAPI
chunk = text[idx:idx+8000]
pos = chunk.find("  assistant_history_attestation?: AssistantHistoryAttestation;\n}> {")
if pos < 0:
    # print nearby
    att = chunk.find("assistant_history_attestation")
    print(repr(chunk[att-80:att+200]) if att>=0 else chunk[-500:])
    raise SystemExit("return type end not found")
text = text[:idx+pos] + "  assistant_history_attestation?: AssistantHistoryAttestation;\n  authoritative_session?: POJUSessionState;\n}> {" + text[idx+pos+len("  assistant_history_attestation?: AssistantHistoryAttestation;\n}> {"):]
a.write_text(text, encoding="utf-8", newline="\n")
print("added authoritative_session to callLLMViaAPI return type")