import re, os

def extract_funcs(path, names=None, keywords=None):
    text = open(path, encoding='utf-8').read()
    lines = text.splitlines()
    print(f"\n========== {path} ({len(lines)} lines) ==========")
    if keywords:
        for i,l in enumerate(lines,1):
            for k in keywords:
                if k in l:
                    print(f"{i:4d}: {l}")
                    break

# Session type: find POJUSessionState and nearby fields
text = open("lib/poju/types.ts", encoding='utf-8').read()
lines = text.splitlines()
print("lib/poju/types.ts total", len(lines))
# find export type/interface POJUSessionState
for i,l in enumerate(lines):
    if "POJUSessionState" in l or "pending_" in l or "adaptive_ask_plan" in l or "decision_understanding" in l:
        print(f"{i+1:4d}: {l}")
