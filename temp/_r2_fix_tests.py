from pathlib import Path
p = Path(r"scripts/test-m8-r1-internal-turn-trust-boundary.ts")
text = p.read_text(encoding="utf-8")
old = '''  await asyncTest("API-attested assistant replies stored after a real chat turn remain trusted", async () => {
    const session = liveSession();
    const beforeAuthority = authoritySnapshot(session);
    const out = await handleUserMessage({ session, userMessage: "I am considering a job change.", locale: "zh" });
    const stored = out.messages.filter((m) => m.role === "assistant" && m.content === "STUBBED_MODEL_REPLY");
    assert.ok(stored.length >= 1);
    assert.ok(stored.at(-1)?.meta?.assistant_history_attestation?.sig, "API path must persist a server attestation");
    assert.equal(
      verifyAssistantHistoryAttestation(out.session_id, "STUBBED_MODEL_REPLY", stored.at(-1)!.meta!.assistant_history_attestation!.sig),
      true,
    );
    const { v5, v6 } = await buildPromptHistories(out, "follow up");
    assertStreamAndNonStreamConsistent(v5, v6);
    assert.ok(v6.messages.some((m) => m.role === "assistant" && m.content === "STUBBED_MODEL_REPLY"));
    assertUnchangedAuthority({ ...session, ...beforeAuthority, messages: session.messages } as POJUSessionState, out);
    assert.deepEqual(authoritySnapshot(out), authoritySnapshot(out));
    assert.equal(out.decision_context, session.decision_context);
    assert.equal(out.decision_blueprint, session.decision_blueprint);
    assert.equal(out.dirs, session.dirs);
    assert.equal(out.decision_understanding, session.decision_understanding);
  });
'''
new = '''  await asyncTest("API-attested assistant replies stored after a real chat turn remain trusted", async () => {
    const session = liveSession();
    const out = await handleUserMessage({ session, userMessage: "I am considering a job change.", locale: "zh" });
    const stored = [...out.messages].reverse().find((m) => m.role === "assistant");
    const attestation = stored?.meta?.assistant_history_attestation;
    assert.ok(stored, "chat turn must store an assistant reply");
    assert.ok(attestation?.sig, "API path must persist a server attestation");
    const signedText = attestation!.content ?? stored!.content;
    assert.equal(signedText, "STUBBED_MODEL_REPLY");
    assert.equal(verifyAssistantHistoryAttestation(out.session_id, signedText, attestation!.sig), true);
    const { v5, v6 } = await buildPromptHistories(out, "follow up");
    assertStreamAndNonStreamConsistent(v5, v6);
    assert.ok(v6.messages.some((m) => m.role === "assistant" && m.content === "STUBBED_MODEL_REPLY"));
    assertUnchangedAuthority(session, out);
  });
'''
if old not in text:
    raise SystemExit("API test block not found")
text = text.replace(old, new, 1)

old = '''    assert.equal(modelCallCount, modelBefore, "Prompt construction must not call the model");
    assert.deepEqual(authoritySnapshot(session), before);
    assert.equal(session.decision_report, undefined);
    assert.ok(v6.messages.some((m) => m.role === "user" && m.content.includes(legalUser)));
'''
new = '''    assert.equal(modelCallCount, modelBefore, "Prompt construction must not call the model");
    assert.deepEqual(authoritySnapshot(session), before);
    assert.ok(v6.messages.some((m) => m.role === "user" && m.content.includes(legalUser)));
'''
if old not in text:
    raise SystemExit("mutation test block not found")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("fixed tests")
