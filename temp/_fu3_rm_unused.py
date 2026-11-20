from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
old = '''function sessionHasWritesFromTurn(session: POJUSessionState, turnId: string): boolean {
  const dc = session.decision_context;
  if (!dc) return false;
  return (
    dc.reality_facts.some((f) => f.source_turn_id === turnId) ||
    dc.constraints.some((c) => c.source_turn_id === turnId)
  );
}

'''
assert old in text, "sessionHasWritesFromTurn not found"
p.write_text(text.replace(old, ""), encoding="utf-8", newline="\n")
print("removed unused sessionHasWritesFromTurn")
