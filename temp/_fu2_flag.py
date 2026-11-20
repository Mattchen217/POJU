from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
old = '''    const applied = await applyAnswerEventToSessionDc(current, answer_event, {
      now: input.now,
    });
    if (applied.skipped_reason === "turn_already_mapped") {
      current = withPendingAnswerResolution(applied.session, null);
'''
# This is in handlePendingAnswerResolutionTurn only if unique enough
print("count", text.count(old))
if text.count(old) != 1:
    # find nearby
    idx = text.find("async function handlePendingAnswerResolutionTurn")
    print("handler idx", idx)
    snippet = text[idx:idx+4000]
    i2 = snippet.find("applyAnswerEventToSessionDc")
    print(repr(snippet[i2:i2+600]))
else:
    text = text.replace(old, '''    const applied = await applyAnswerEventToSessionDc(current, answer_event, {
      now: input.now,
      allow_incremental_same_turn: true,
    });
    if (applied.skipped_reason === "turn_already_mapped") {
      current = withPendingAnswerResolution(applied.session, null);
''', 1)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("flag passed")
