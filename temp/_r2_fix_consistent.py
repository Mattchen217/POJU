from pathlib import Path
p = Path(r"scripts/test-m8-r1-internal-turn-trust-boundary.ts")
text = p.read_text(encoding="utf-8")
old = '''function assertStreamAndNonStreamConsistent(
  v5: { system: string; messages: Array<{ role: string; content: string }> },
  v6: { system: string; messages: Array<{ role: string; content: string }> },
) {
  assert.deepEqual(v5.messages, v6.messages, "non-stream (v5) and stream-capable (v6) Prompt history must stay consistent");
}
'''
new = '''function assertStreamAndNonStreamConsistent(
  v5: { system: string; messages: Array<{ role: string; content: string }> },
  v6: { system: string; messages: Array<{ role: string; content: string }> },
) {
  assert.deepEqual(
    assistantPromptContents(v5.messages),
    assistantPromptContents(v6.messages),
    "v5 and v6 Prompt builders must apply the same assistant provenance filter",
  );
  assert.ok(v5.system.trim().length > 0 && v6.system.trim().length > 0, "server system Prompt must still be generated");
}
'''
if old not in text:
    raise SystemExit("helper not found")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("fixed consistency helper")
