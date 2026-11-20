from pathlib import Path
# print serialize from 120
p=Path("lib/poju/serialize-chat-payload.ts")
lines=p.read_text(encoding="utf-8").splitlines()
print("\n".join(f"{i+1}:{lines[i]}" for i in range(100, len(lines))))
print("==== agent chatPayloadFromWire usage ====")
alines=Path("lib/poju/agent.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(alines,1):
    if "chatPayloadFromWire" in l or "assistant_history" in l:
        print(f"{i}:{l}")
# find function that maps wire after fetch
for i,l in enumerate(alines,1):
    if "chatPayloadFromWire" in l:
        for j in range(max(1,i-5), min(len(alines), i+40)):
            print(f"{j}:{alines[j-1]}")
        print("---")
