from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\session-manager.ts")
text = p.read_text(encoding="utf-8")
old = '''  // M9: in the browser, a new Session must first obtain the server record.
  // Node tests keep the local constructor so existing IDB suites stay intact.
  if (typeof window !== "undefined") {
    const { initializeServerSessionFromClient } = await import(
      "@/lib/poju/session-authority/client"
    );
    const envelope = await initializeServerSessionFromClient({
      session_id: sessionId,
      original_question: input.original_question.trim(),
      device_id: deviceId,
      selected_stored_profile_id: storedId,
    });
    sessionState = envelope.session;
    sessionId = envelope.session_id;
    sessionState.session_revision = envelope.revision;
    sessionState.expires_at = envelope.expires_at;
  }
'''
new = '''  // M9: a new Session must first obtain the server-authoritative record.
  // Node / tests initialize in-process (no HTTP). The real browser fetches
  // /api/poju/session. webpackIgnore keeps the server store out of the client bundle.
  const isNodeRuntime = typeof process !== "undefined" && Boolean(process.versions?.node);
  const isBrowserDocument = typeof document !== "undefined";
  if (isNodeRuntime && !isBrowserDocument) {
    const { initializeAuthoritativeSession, toAuthoritativeEnvelope } = await import(
      /* webpackIgnore: true */
      "@/lib/poju/session-authority/lifecycle"
    );
    const record = await initializeAuthoritativeSession({
      session_id: sessionId,
      original_question: input.original_question.trim(),
      device_id: deviceId,
      selected_stored_profile_id: storedId,
    });
    const envelope = toAuthoritativeEnvelope(record);
    sessionState = envelope.session;
    sessionId = envelope.session_id;
    sessionState.session_revision = envelope.revision;
    sessionState.expires_at = envelope.expires_at;
  } else if (typeof window !== "undefined") {
    const { initializeServerSessionFromClient } = await import(
      "@/lib/poju/session-authority/client"
    );
    const envelope = await initializeServerSessionFromClient({
      session_id: sessionId,
      original_question: input.original_question.trim(),
      device_id: deviceId,
      selected_stored_profile_id: storedId,
    });
    sessionState = envelope.session;
    sessionId = envelope.session_id;
    sessionState.session_revision = envelope.revision;
    sessionState.expires_at = envelope.expires_at;
  }
'''
if old not in text:
    raise SystemExit("createPOJUSession M9 block not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("patched createPOJUSession runtime split")