from pathlib import Path

def must_replace(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"anchor not found: {label} in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
    print(f"patched {label}")

must_replace(
    Path("lib/poju/session-authority/types.ts"),
    '  | "ledger_integrity_failure"\n  | "ledger_probe_incomplete";',
    '  | "ledger_integrity_failure"\n  | "ledger_probe_incomplete"\n  | "ledger_snapshot_changed";',
    "types error codes",
)

must_replace(
    Path("lib/poju/session-authority/lifecycle.ts"),
    'function isRecoverable(code: SessionAuthorityErrorCode): boolean {\n  return code === "session_revision_conflict" || code === "session_cas_conflict";\n}',
    'function isRecoverable(code: SessionAuthorityErrorCode): boolean {\n  return (\n    code === "session_revision_conflict" ||\n    code === "session_cas_conflict" ||\n    code === "ledger_snapshot_changed" ||\n    code === "ledger_probe_incomplete"\n  );\n}',
    "isRecoverable",
)

must_replace(
    Path("lib/poju/session-authority/lifecycle.ts"),
    '    if (result.reason === "ledger_probe_incomplete") {\n      throw new SessionAuthorityError(\n        "ledger_probe_incomplete",\n        "Decision Authority ledger probe could not establish the authoritative head within its limit",\n        { session_id: input.sessionId, recoverable: true },\n      );\n    }\n    throw new SessionAuthorityError(\n      "session_cas_conflict",',
    '    if (result.reason === "ledger_probe_incomplete") {\n      throw new SessionAuthorityError(\n        "ledger_probe_incomplete",\n        "Decision Authority ledger probe could not establish the authoritative head within its limit",\n        { session_id: input.sessionId, recoverable: true },\n      );\n    }\n    if (result.reason === "ledger_snapshot_changed") {\n      throw new SessionAuthorityError(\n        "ledger_snapshot_changed",\n        "Decision Authority ledger changed during intake commit; retry is required",\n        { session_id: input.sessionId, recoverable: true },\n      );\n    }\n    throw new SessionAuthorityError(\n      "session_cas_conflict",',
    "commit mapping",
)

must_replace(
    Path("lib/poju/session-authority/lifecycle.ts"),
    '  if (error.code === "ledger_integrity_failure" || error.code === "ledger_probe_incomplete") return 409;',
    '  if (error.code === "ledger_integrity_failure" || error.code === "ledger_probe_incomplete" || error.code === "ledger_snapshot_changed") return 409;',
    "httpStatus",
)

must_replace(
    Path("package.json"),
    '    "test:m9-r1-fu1-redis-lua-integrity-parity": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts",',
    '    "test:m9-r1-fu1-redis-lua-integrity-parity": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts",\n    "test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.ts",',
    "package.json script",
)
print("phase 1 done")
