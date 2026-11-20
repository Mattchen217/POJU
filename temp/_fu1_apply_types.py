from pathlib import Path

# types.ts: add error codes
types = Path("lib/poju/session-authority/types.ts")
t = types.read_text(encoding="utf-8").replace("\r\n", "\n")
old = '''  | "session_turn_missing"
  | "session_turn_conflict"
  | "invalid_session_record";
'''
new = '''  | "session_turn_missing"
  | "session_turn_conflict"
  | "invalid_session_record"
  | "ledger_integrity_failure"
  | "ledger_probe_incomplete";
'''
if old not in t:
    raise SystemExit("types.ts marker missing")
types.write_text(t.replace(old, new, 1), encoding="utf-8", newline="\n")
print("types.ts updated")

# lifecycle.ts: map new CAS reasons before generic conflict
life = Path("lib/poju/session-authority/lifecycle.ts")
lt = life.read_text(encoding="utf-8").replace("\r\n", "\n")
old = '''    if (result.reason === "missing") {
      throw new SessionAuthorityError("session_not_found", `server session not found: ${input.sessionId}`, {
        session_id: input.sessionId,
        expected_revision: input.expectedRevision,
        recoverable: false,
      });
    }
    throw new SessionAuthorityError(
      "session_cas_conflict",
      `CAS conflict committing revision ${input.expectedRevision}`,
'''
new = '''    if (result.reason === "missing") {
      throw new SessionAuthorityError("session_not_found", `server session not found: ${input.sessionId}`, {
        session_id: input.sessionId,
        expected_revision: input.expectedRevision,
        recoverable: false,
      });
    }
    if (result.reason === "identity") {
      throw new SessionAuthorityError(
        "invalid_session_record",
        "authoritative session record failed identity or contract checks during commit",
        { session_id: input.sessionId, recoverable: false },
      );
    }
    if (result.reason === "ledger_integrity") {
      throw new SessionAuthorityError(
        "ledger_integrity_failure",
        "Decision Authority ledger data failed integrity checks during intake commit",
        { session_id: input.sessionId, recoverable: false },
      );
    }
    if (result.reason === "ledger_probe_incomplete") {
      throw new SessionAuthorityError(
        "ledger_probe_incomplete",
        "Decision Authority ledger probe could not establish the authoritative head within its limit",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    throw new SessionAuthorityError(
      "session_cas_conflict",
      `CAS conflict committing revision ${input.expectedRevision}`,
'''
if old not in lt:
    raise SystemExit("lifecycle.ts mapping marker missing")
lt = lt.replace(old, new, 1)

old_http = '''  if (error.code === "session_turn_conflict" || error.code === "invalid_session_record") return 409;
  return 409;
'''
new_http = '''  if (error.code === "session_turn_conflict" || error.code === "invalid_session_record") return 409;
  if (error.code === "ledger_integrity_failure" || error.code === "ledger_probe_incomplete") return 409;
  return 409;
'''
if old_http not in lt:
    raise SystemExit("lifecycle.ts http marker missing")
lt = lt.replace(old_http, new_http, 1)
life.write_text(lt, encoding="utf-8", newline="\n")
print("lifecycle.ts updated")

# package.json script
pkg = Path("package.json")
pt = pkg.read_text(encoding="utf-8").replace("\r\n", "\n")
old = '''    "test:m9-r1-session-authority-remediation": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-session-authority-remediation.ts",
'''
new = '''    "test:m9-r1-session-authority-remediation": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-session-authority-remediation.ts",
    "test:m9-r1-fu1-redis-lua-integrity-parity": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts",
'''
if old not in pt:
    raise SystemExit("package.json marker missing")
if "test:m9-r1-fu1-redis-lua-integrity-parity" in pt:
    print("package.json already has script")
else:
    pkg.write_text(pt.replace(old, new, 1), encoding="utf-8", newline="\n")
    print("package.json updated")