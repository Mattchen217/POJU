from pathlib import Path
lines = Path(r"lib/poju/agent.ts").read_text(encoding="utf-8").splitlines()
# print exact around imports bind target, promise type start, direct return, parse return, assistant message meta end
for i,l in enumerate(lines,1):
    if i in range(110, 116) or "chatPayloadFromWire" in l:
        print(f"{i}:{l}")
print("---- PROMISE TYPE ----")
# find Promise<{ after callLLMViaAPI
for i,l in enumerate(lines,1):
    if l.strip() == "async function callLLMViaAPI(input: {":
        print("\n".join(f"{j}:{lines[j-1]}" for j in range(i, i+40)))
        break
print("---- DIRECT RETURN LAST FIELDS ----")
for i,l in enumerate(lines,1):
    if "llm_debug: r.llm_debug," in l and i>2000:
        print("\n".join(f"{j}:{lines[j-1]}" for j in range(i-5, i+8)))
print("---- PARSE RETURN LAST / start ----")
for i,l in enumerate(lines,1):
    if "return {" in l and i>2210 and i<2230:
        print("FOUND return at", i)
        # find end of this return - look for llm_debug in next 80 lines
    if "llm_debug:" in l and i>2200:
        print(f"{i}:{l}")
        print("\n".join(f"{j}:{lines[j-1]}" for j in range(i, min(i+15, len(lines)+1))))
print("---- ASSISTANT MSG META TAIL ----")
for i,l in enumerate(lines,1):
    if i>=1749 and i<=1805:
        print(f"{i}:{l}")
