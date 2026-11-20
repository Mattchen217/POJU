from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\session-authority\chat.ts")
text = p.read_text(encoding="utf-8")
old = '''  const sessionId = body.session.session_id;
  const record = await requireAuthoritativeSession(sessionId);
  const expectedRevision = requestedRevision(body);
  await assertRecordAllowsIntake(record, expectedRevision, Date.now());
  throwIfAborted(opts?.signal);

  const incoming = extractIncomingUserTurn({
    serverSnapshot: record.session_snapshot,
    clientSession: body.session,
    user_message: body.user_message,
    client_turn_id: body.client_turn_id,
  });
  if (!incoming) {
    throw new SessionAuthorityError(
      "session_turn_missing",
      "a user turn bound to the current session is required",
      { session_id: sessionId, current_revision: record.revision },
    );
  }
  if ("idempotent" in incoming) {
    return {
      ok: true,
      idempotent: true,
      llm: llmFromCommittedSession(record.session_snapshot),
      session: record.session_snapshot,
      envelope: toAuthoritativeEnvelope(record),
      aborted: false,
    };
  }

  if (record.last_committed_turn_id === incoming.client_turn_id) {
    return {
      ok: true,
      idempotent: true,
      llm: llmFromCommittedSession(record.session_snapshot),
      session: record.session_snapshot,
      envelope: toAuthoritativeEnvelope(record),
      aborted: false,
    };
  }
'''
new = '''  const sessionId = body.session.session_id;
  const record = await requireAuthoritativeSession(sessionId);
  const incoming = extractIncomingUserTurn({
    serverSnapshot: record.session_snapshot,
    clientSession: body.session,
    user_message: body.user_message,
    client_turn_id: body.client_turn_id,
  });
  if (
    incoming &&
    ("idempotent" in incoming || record.last_committed_turn_id === incoming.client_turn_id)
  ) {
    const turnId = "idempotent" in incoming ? incoming.client_turn_id : incoming.client_turn_id;
    if ("idempotent" in incoming || record.last_committed_turn_id === turnId) {
      return {
        ok: true,
        idempotent: true,
        llm: llmFromCommittedSession(record.session_snapshot),
        session: record.session_snapshot,
        envelope: toAuthoritativeEnvelope(record),
        aborted: false,
      };
    }
  }
  const expectedRevision = requestedRevision(body);
  await assertRecordAllowsIntake(record, expectedRevision, Date.now());
  throwIfAborted(opts?.signal);

  if (!incoming) {
    throw new SessionAuthorityError(
      "session_turn_missing",
      "a user turn bound to the current session is required",
      { session_id: sessionId, current_revision: record.revision },
    );
  }
'''
if old not in text:
    raise SystemExit("chat turn order block not found")
# The replacement is a bit redundant; write a cleaner version
clean = '''  const sessionId = body.session.session_id;
  const record = await requireAuthoritativeSession(sessionId);
  const incoming = extractIncomingUserTurn({
    serverSnapshot: record.session_snapshot,
    clientSession: body.session,
    user_message: body.user_message,
    client_turn_id: body.client_turn_id,
  });
  const alreadyCommitted =
    incoming != null &&
    ("idempotent" in incoming ||
      (!("idempotent" in incoming) && record.last_committed_turn_id === incoming.client_turn_id));
  if (alreadyCommitted) {
    return {
      ok: true,
      idempotent: true,
      llm: llmFromCommittedSession(record.session_snapshot),
      session: record.session_snapshot,
      envelope: toAuthoritativeEnvelope(record),
      aborted: false,
    };
  }
  const expectedRevision = requestedRevision(body);
  await assertRecordAllowsIntake(record, expectedRevision, Date.now());
  throwIfAborted(opts?.signal);

  if (!incoming) {
    throw new SessionAuthorityError(
      "session_turn_missing",
      "a user turn bound to the current session is required",
      { session_id: sessionId, current_revision: record.revision },
    );
  }
'''
p.write_text(text.replace(old, clean, 1), encoding="utf-8", newline="\n")
print("patched idempotent-before-revision order")