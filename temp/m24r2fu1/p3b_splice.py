# splice answerEventFromModelDraft replacement
from pathlib import Path
import os
root = Path(os.environ.get("POJU_ROOT", os.getcwd()))
src = root / "lib/poju/decision-intake/answer-interpretation.ts"
# snippet may live beside this script
snippet_candidates = [
    Path(__file__).with_name("answerEventFromModelDraft.ts.new"),
    root / "temp" / "m24r2fu1" / "answerEventFromModelDraft.ts.new",
    root / "temp" / "answerEventFromModelDraft.ts.new",
]
snippet_path = next((p for p in snippet_candidates if p.exists()), None)
if snippet_path is None:
    raise SystemExit("missing answerEventFromModelDraft.ts.new")
text = src.read_text(encoding="utf-8")
start_marker = """/**
 * Convert a validated ModelAnswerDraft into a formal AnswerEvent.
 * Targets always come from activeTargets(); model fields never authorize
 * DIR/DDR/roles or confirmation. explanation is never written as a fact.
 */
export function answerEventFromModelDraft(input: {"""
end_marker = """/**
 * Interpret one user turn into an AnswerEvent (proposes writes; does not mutate DC).
 */
export function interpretUserAnswer("""
if start_marker not in text:
    raise SystemExit("start marker missing")
if end_marker not in text:
    raise SystemExit("end marker missing")
start = text.index(start_marker)
end = text.index(end_marker)
new = snippet_path.read_text(encoding="utf-8")
if not new.endswith("\n"):
    new += "\n"
src.write_text(text[:start] + new + text[end:], encoding="utf-8", newline="\n")
print("spliced answerEventFromModelDraft from", snippet_path)
