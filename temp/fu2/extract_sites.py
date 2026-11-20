import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

def around(path, needles, radius=10):
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    print("====", path)
    hit = set()
    for i, l in enumerate(lines, 1):
        if any(n in l for n in needles):
            start = max(1, i - radius)
            end = min(len(lines), i + radius)
            for j in range(start, end + 1):
                if j not in hit:
                    print(f"{j}:{lines[j-1]}")
                    hit.add(j)
            print("---")
    print()

around(
    "lib/poju/decision-intake/conflict-clarification-turn.ts",
    ["const clarified = clarifyConflict", "persistDcLifecycleChange", "user_confirmation: true"],
)

cands = [
    "lib/poju/agent.ts",
    "lib/poju/decision-intake/collecting-dc-turn.ts",
    "lib/poju/decision-intake/m1-production-pre-llm-turn.ts",
    "lib/poju/decision-intake/production-pre-llm-turn.ts",
]
# find handleUserMessage file
import os
for root, dirs, files in os.walk("lib/poju"):
    dirs[:] = [d for d in dirs if d not in ("node_modules",)]
    for fn in files:
        if fn.endswith((".ts", ".tsx")):
            p = os.path.join(root, fn)
            try:
                t = Path(p).read_text(encoding="utf-8")
            except Exception:
                continue
            if "export async function handleUserMessage" in t or "export async function runM1ProductionPreLlmTurn" in t or "export async function runCollectingDcTurn" in t:
                print("FOUND", p)
                for i, l in enumerate(t.splitlines(), 1):
                    if any(s in l for s in [
                        "export async function handleUserMessage",
                        "export async function runM1ProductionPreLlmTurn",
                        "export async function runCollectingDcTurn",
                        "runM1ProductionPreLlmTurn(",
                        "runCollectingDcTurn(",
                        "runAdaptiveQuestionTurn(",
                    ]):
                        print(f"  {i}: {l.strip()[:240]}")
                print()
