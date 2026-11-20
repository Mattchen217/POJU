from pathlib import Path

def show(path, needles):
    t = Path(path).read_text(encoding="utf-8")
    print("==", path)
    for n in needles:
        print(f"  [{n!r}] count={t.count(n)}")
    # print key snippets
    for label, start in [
        ("hooks type", "export type AdaptiveTurnTestHooks"),
        ("buildUnderstanding wrapper", "const buildUnderstanding ="),
        ("fu4 catch", "M2.3-R2-FU4"),
        ("test_hooks pass collecting", "test_hooks: input.test_hooks"),
        ("agent hooks", "__testOnlyM1Hooks"),
        ("fail closed", "m1UnderstandingFailClosed"),
    ]:
        i = t.find(start)
        if i >= 0:
            print(f"  -- {label} @ {i} --")
            print(t[i:i+350])
            print()

show("lib/poju/decision-intake/adaptive-turn.ts", [
    "buildUnderstandingState({", "buildUnderstanding({", 'outcome: "ready_no_question"',
    'outcome: "planner_blocked"', "beforeUnderstandingBuild",
])
show("lib/poju/collecting-dc-turn.ts", [
    "AdaptiveTurnTestHooks", "test_hooks",
])
show("lib/poju/agent.ts", [
    "__testOnlyM1Hooks", "test_hooks: input.__testOnlyM1Hooks",
    "ask_error?.includes",
])
