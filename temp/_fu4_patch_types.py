
from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\types.ts")
text = p.read_text(encoding="utf-8")
old = "export type PendingAnswerResolutionStatus = \"pending\" | \"rejected\";\n"
new = (
    "export type PendingAnswerResolutionStatus = \"pending\" | \"rejected\";\n"
    "/** \"pending\" is the active clarification task (unresolved_items nonempty).\n"
    " *  \"rejected\" is the terminal audit record after every remaining item was\n"
    " *  explicitly refused. It must not keep a resendable clarification_plan,\n"
    " *  is not an unanswered ordinary clarification task, and is not a DC fact.\n"
    " */\n"
)
if old not in text:
    raise SystemExit("types marker not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("types.ts patched")
