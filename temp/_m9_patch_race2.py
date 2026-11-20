from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\test-m9-server-authoritative-session.ts")
text = p.read_text(encoding="utf-8")
# replace the gated race body with a simpler Promise.all race
start = text.find('      const record = await requireAuthoritativeSession(created.session_id);')
end = text.find('  await asyncTest("8. Client-forged')
if start < 0 or end < 0:
    raise SystemExit(f"markers missing {start} {end}")
block = '''      const record = await requireAuthoritativeSession(created.session_id);
      const beforeModels = modelCalls;
      const [a, b] = await withModel(async () =>
        Promise.all([
          postChatJson(
            clientSessionFrom(record, {
              messages: [...record.session_snapshot.messages, userMessage("concurrent-A", "turn_race_a")],
            }),
          ),
          postChatJson(
            clientSessionFrom(record, {
              messages: [...record.session_snapshot.messages, userMessage("concurrent-B", "turn_race_b")],
            }),
          ),
        ]),
      );
      const statuses = [a.status, b.status].sort();
      assert.deepEqual(statuses, [200, 409]);
      const failed = a.status === 409 ? a : b;
      const won = a.status === 200 ? a : b;
      assert.ok(failed.body.code === "session_cas_conflict" || failed.body.code === "session_revision_conflict");
      assert.equal(failed.body.recoverable, true);
      const current = await requireAuthoritativeSession(record.session_id);
      assert.equal(current.revision, record.revision + 1);
      const userContents = current.session_snapshot.messages.filter((m) => m.role === "user").map((m) => m.content);
      assert.equal(userContents.includes("prime the session"), true);
      const raced = userContents.filter((content) => content === "concurrent-A" || content === "concurrent-B");
      assert.equal(raced.length, 1);
      const loserText = raced[0] === "concurrent-A" ? "concurrent-B" : "concurrent-A";
      assert.equal(current.session_snapshot.messages.some((m) => m.content === loserText), false);
      assert.equal(won.body.session_revision, record.revision + 1);
      assert.equal(modelCalls >= beforeModels, true);
    });
  });

'''
# The current text from start to end includes leftover of the old test inside withStore. Keep withStore close correctly.
# Look at structure: withStore(async () => { ... });  then }); of asyncTest
# I'll replace from start to end carefully.
text = text[:start] + block + text[end:]
p.write_text(text, encoding="utf-8", newline="\n")
print("rewrote race test body")