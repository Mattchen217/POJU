from pathlib import Path
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

def sub(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"NOT FOUND: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"NOT UNIQUE ({text.count(old)}): {label}")
    text = text.replace(old, new, 1)
    print("patched", label)

sub(
    '''  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `missing ${sid}`);
    return s;
  }
''',
    '''  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `missing ${sid}`);
    return s;
  }

  /** Persist an init_only plan as an actually-sent question (last_sent_question). */
  async function persistAttachedInitAsk(
    sid: string,
    operationId: string,
    sourceTurnId: string,
    initResult?: Awaited<ReturnType<typeof runCollectingDcTurn>>,
  ): Promise<POJUSessionState> {
    const seeded =
      initResult ??
      (await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: sourceTurnId,
        now: NOW,
        init_only: true,
      }));
    assert.ok(seeded.plan, `${operationId} first plan required`);
    const { attachAuthorizedAssistantQuestion } = await import(
      "../lib/poju/decision-intake/adaptive-turn"
    );
    const attached = attachAuthorizedAssistantQuestion(
      seeded.session,
      seeded.plan!,
      sourceTurnId,
    );
    await mutatePOJUSession(sid, {
      operation_id: operationId,
      kind: "session_patch",
      bump_dc: true,
      apply: () => attached,
    });
    return durable(sid);
  }
''',
    "helper",
)

sub(
    '''      // Seed an active plan targeting constraints so interpretation binds roles.
      const seeded = await runCollectingDcTurn(await durable(sidTurn), {
        statement: "",
        source_turn_id: "init_02",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sidTurn, {
        operation_id: "op_m1_02_plan",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const before = await durable(sidTurn);
''',
    '''      // Seed an actually-sent question so answer authorization has last_sent_question.
      const before = await persistAttachedInitAsk(sidTurn, "op_m1_02_plan", "init_02");
''',
    "m1-02",
)

sub(
    '''      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_06",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_06",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const out = await handleUserMessage({
        session: await durable(sid),
''',
    '''      await persistAttachedInitAsk(sid, "op_m1_06", "init_06");
      const out = await handleUserMessage({
        session: await durable(sid),
''',
    "m1-06",
)

sub(
    '''      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_07",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_07",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const cases: Array<{ msg: string; expectStatus: string; expectVer?: string }> = [
''',
    '''      await persistAttachedInitAsk(sid, "op_m1_07", "init_07");
      const cases: Array<{ msg: string; expectStatus: string; expectVer?: string }> = [
''',
    "m1-07",
)

sub(
    '''      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_12",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_12",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const first = await handleUserMessage({
        session: await durable(sid),
''',
    '''      await persistAttachedInitAsk(sid, "op_m1_12", "init_12");
      const first = await handleUserMessage({
        session: await durable(sid),
''',
    "m1-12",
)

sub(
    '''      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_13",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_13",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const out = await handleUserMessage({
        session: await durable(sid),
''',
    '''      await persistAttachedInitAsk(sid, "op_m1_13", "init_13");
      const out = await handleUserMessage({
        session: await durable(sid),
''',
    "m1-13",
)

sub(
    '''      const init = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_interp",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_interp_init",
        kind: "session_patch",
        bump_dc: true,
        apply: () => init.session,
      });
      const s = await durable(sid);
      assert.ok(s.adaptive_ask_plan || s.decision_understanding?.next_question_plan);
''',
    '''      const s = await persistAttachedInitAsk(sid, "op_m1_interp_init", "init_interp");
      assert.ok(s.decision_understanding?.last_sent_question);
      assert.ok(s.adaptive_ask_plan || s.decision_understanding?.next_question_plan);
''',
    "m1-interp",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("init-ask fixtures attached")
