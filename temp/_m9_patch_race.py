from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\test-m9-server-authoritative-session.ts")
text = p.read_text(encoding="utf-8")
old = '''  await asyncTest("6-7. Concurrent requests compete; loser cannot overwrite", async () => {
    await withStore(async () => {
      const record = await initRecord("cas-race");
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered = 0;
      const beforeModels = modelCalls;
      await runWithTestChatModel(async ({ session }) => {
        entered += 1;
        await gate;
        modelCalls += 1;
        const last = [...(session.messages ?? [])].reverse().find((m) => m.role === "user");
        return cannedLlm(`winner-or-loser:${last?.content ?? ""}`);
      }, async () => {
        const p1 = postChatJson(
          clientSessionFrom(record, { messages: [userMessage("concurrent-A", "turn_race_a")] }),
        );
        const p2 = postChatJson(
          clientSessionFrom(record, { messages: [userMessage("concurrent-B", "turn_race_b")] }),
        );
'''
new = '''  await asyncTest("6-7. Concurrent requests compete; loser cannot overwrite", async () => {
    await withStore(async () => {
      const created = await initRecord("cas-race");
      // Establish a baseline revision first so the race is on Session CAS, not ledger genesis.
      await withModel(async () => {
        const primed = await postChatJson(
          clientSessionFrom(created, { messages: [userMessage("prime the session", "turn_race_prime")] }),
        );
        assert.equal(primed.status, 200);
      });
      const record = await requireAuthoritativeSession(created.session_id);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered = 0;
      const beforeModels = modelCalls;
      await runWithTestChatModel(async ({ session }) => {
        entered += 1;
        await gate;
        modelCalls += 1;
        const last = [...(session.messages ?? [])].reverse().find((m) => m.role === "user");
        return cannedLlm(`winner-or-loser:${last?.content ?? ""}`);
      }, async () => {
        const p1 = postChatJson(
          clientSessionFrom(record, {
            messages: [...record.session_snapshot.messages, userMessage("concurrent-A", "turn_race_a")],
          }),
        );
        const p2 = postChatJson(
          clientSessionFrom(record, {
            messages: [...record.session_snapshot.messages, userMessage("concurrent-B", "turn_race_b")],
          }),
        );
'''
if old not in text:
    raise SystemExit("race test block not found")
# also update the assertion that revision is 1 - after prime it should be 2
text = text.replace(old, new, 1)
text = text.replace(
'''        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        const userContents = current.session_snapshot.messages.filter((m) => m.role === "user").map((m) => m.content);
        assert.equal(userContents.length, 1);
        assert.ok(userContents[0] === "concurrent-A" || userContents[0] === "concurrent-B");
        const loserText = userContents[0] === "concurrent-A" ? "concurrent-B" : "concurrent-A";
        assert.equal(current.session_snapshot.messages.some((m) => m.content === loserText), false);
        assert.equal(won.body.session_revision, 1);
''',
'''        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, record.revision + 1);
        const userContents = current.session_snapshot.messages.filter((m) => m.role === "user").map((m) => m.content);
        assert.equal(userContents.includes("prime the session"), true);
        const raced = userContents.filter((content) => content === "concurrent-A" || content === "concurrent-B");
        assert.equal(raced.length, 1);
        const loserText = raced[0] === "concurrent-A" ? "concurrent-B" : "concurrent-A";
        assert.equal(current.session_snapshot.messages.some((m) => m.content === loserText), false);
        assert.equal(won.body.session_revision, record.revision + 1);
''',
    1,
)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched concurrent test")