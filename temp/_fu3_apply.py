# -*- coding: utf-8 -*-
"""Apply M9-R1-FU1-FU2-FU3 Session Record integrity atomic binding patches."""
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")


def must_replace(path: Path, old: str, new: str, count: int = 1) -> str:
    text = path.read_text(encoding="utf-8")
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} occurrence(s) of needle, found {found}:\n{old[:180]!r}")
    return text.replace(old, new, count)


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"updated {path}")


def patch_store() -> None:
    path = ROOT / "lib/poju/session-authority/store.ts"

    text = must_replace(
        path,
        """ * Lua still does not recompute JavaScript canonicalHash.
 */
""",
        """ * Lua still does not recompute JavaScript canonicalHash.
 *
 * M9-R1-FU1-FU2-FU3: TypeScript validates the current Session Record with
 * inspectStoredSessionRecord (canonicalHash) and binds the exact original
 * raw Redis value into Redis Lua CAS. Lua compares live GET bytes against
 * that exact raw string immediately after reading KEYS[1] and fail-closes
 * on a changed, deleted, or newly created record. Lua still does not
 * recompute JavaScript canonicalHash.
 */
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """  | "ledger_probe_incomplete"
  | "ledger_snapshot_changed";
""",
        """  | "ledger_probe_incomplete"
  | "ledger_snapshot_changed"
  | "session_snapshot_changed";
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """export function encodeLedgerBindingArgs(snapshot: LedgerBindingSnapshot): string[] {
  return [
    snapshot.hintRaw ?? "",
    String(snapshot.startVersion),
    String(snapshot.endVersion),
    String(snapshot.entryRaws.length),
    ...snapshot.entryRaws,
  ];
}

export function decodeLedgerBindingArgs(args: string[]): LedgerBindingSnapshot | null {
  if (args.length < 13) return null;
  const hintRaw = args[9] ?? "";
  const startVersion = Number(args[10]);
  const endVersion = Number(args[11]);
  const count = Number(args[12]);
  if (!Number.isSafeInteger(startVersion) || !Number.isSafeInteger(endVersion) || !Number.isSafeInteger(count) || count < 0) {
    return null;
  }
  if (args.length < 13 + count) return null;
  return {
    hintRaw: hintRaw.length === 0 ? null : hintRaw,
    startVersion,
    endVersion,
    entryRaws: args.slice(13, 13 + count),
    frozen: false,
  };
}
""",
        """export function encodeLedgerBindingArgs(snapshot: LedgerBindingSnapshot): string[] {
  return [
    snapshot.hintRaw ?? "",
    String(snapshot.startVersion),
    String(snapshot.endVersion),
    String(snapshot.entryRaws.length),
    ...snapshot.entryRaws,
  ];
}

/**
 * 0-based eval args index of the exact TypeScript-validated Session Record
 * raw string (Lua ARGV[10]). An empty string means the record was absent
 * during validation. Ledger binding args, when present, start immediately
 * after this slot (Lua ARGV[11], 0-based index 10).
 */
export const VALIDATED_SESSION_RAW_ARGV_INDEX = 9;
export const LEDGER_BINDING_ARGV_OFFSET = 10;

/**
 * Compare the exact TypeScript-validated Session Record raw value with the
 * live Redis GET bytes. An empty validatedRaw means the record was absent.
 * A mismatch, appearance, or disappearance is session_snapshot_changed.
 * Absent-and-still-absent is missing and must not create a record.
 */
export function evaluateSessionRecordRawBinding(input: {
  validatedRaw: string;
  liveRaw: string | null;
}): { ok: true } | { ok: false; reason: "session_snapshot_changed" | "missing" } {
  if (input.validatedRaw === "") {
    if (input.liveRaw != null) return { ok: false, reason: "session_snapshot_changed" };
    return { ok: false, reason: "missing" };
  }
  if (input.liveRaw == null || input.liveRaw !== input.validatedRaw) {
    return { ok: false, reason: "session_snapshot_changed" };
  }
  return { ok: true };
}

export function decodeValidatedSessionRawArg(args: string[]): string | undefined {
  if (args.length <= VALIDATED_SESSION_RAW_ARGV_INDEX) return undefined;
  return args[VALIDATED_SESSION_RAW_ARGV_INDEX] ?? "";
}

export function decodeLedgerBindingArgs(args: string[]): LedgerBindingSnapshot | null {
  const offset = LEDGER_BINDING_ARGV_OFFSET;
  if (args.length < offset + 4) return null;
  const hintRaw = args[offset] ?? "";
  const startVersion = Number(args[offset + 1]);
  const endVersion = Number(args[offset + 2]);
  const count = Number(args[offset + 3]);
  if (!Number.isSafeInteger(startVersion) || !Number.isSafeInteger(endVersion) || !Number.isSafeInteger(count) || count < 0) {
    return null;
  }
  if (args.length < offset + 4 + count) return null;
  return {
    hintRaw: hintRaw.length === 0 ? null : hintRaw,
    startVersion,
    endVersion,
    entryRaws: args.slice(offset + 4, offset + 4 + count),
    frozen: false,
  };
}
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """ *   10 ledger snapshot changed (retryable binding mismatch or new entry)
 *
 * KEYS[1] = session record key
 * ARGV: expectedRevision, nextJson, ttlSeconds, sessionId, nowIso, intakeCommit (0/1),
 *       ledgerHeadKey, ledgerEntryPrefix, probeLimit,
 *       [intake] hintRaw, startVersion, endVersion, entryCount, entryRaw...
 *
 * Hash policy: this script does not recompute canonicalHash / SHA-256 of
 * session_snapshot or ledger entry_hash. Exact JS JSON.stringify + SHA-256
 * parity cannot be implemented safely in Redis Lua. The production Redis
 * adapter runs inspectStoredSessionRecord (canonicalHash) on the current
 * and proposed records before EVAL, and validates ledger entry hashes with
 * the same canonicalHash implementation. The exact validated ledger raw
 * values are passed into this script; Lua compares live GET bytes against
 * those values and rejects the commit if they changed or a new entry
 * appeared. Lua still fail-closes on version, required fields, identity,
 * snapshot.session_id, and snapshot revision mismatches, and never treats a
 * corrupted Record as missing.
 */
export const SESSION_AUTHORITY_CAS_LUA = `
-- Hash policy: this script does not recompute canonicalHash / SHA-256 of
-- session_snapshot or ledger entry_hash. The production adapter validates
-- those hashes with canonicalHash and binds the exact raw ledger values.
-- Lua compares live GET bytes against that snapshot and fail-closes on a
-- change or newly visible entry. Lua still fail-closes on structural
-- Record integrity and never treats a corrupted Record as missing.
""",
        """ *   10 ledger snapshot changed (retryable binding mismatch or new entry)
 *   11 session snapshot changed (retryable raw Session Record binding mismatch)
 *
 * KEYS[1] = session record key
 * ARGV: expectedRevision, nextJson, ttlSeconds, sessionId, nowIso, intakeCommit (0/1),
 *       ledgerHeadKey, ledgerEntryPrefix, probeLimit,
 *       validatedSessionRaw (exact TypeScript-validated raw, or empty if absent),
 *       [intake] hintRaw, startVersion, endVersion, entryCount, entryRaw...
 *
 * Hash policy: this script does not recompute canonicalHash / SHA-256 of
 * session_snapshot or ledger entry_hash. Exact JS JSON.stringify + SHA-256
 * parity cannot be implemented safely in Redis Lua. The production Redis
 * adapter runs inspectStoredSessionRecord (canonicalHash) on the current
 * and proposed records before EVAL, and validates ledger entry hashes with
 * the same canonicalHash implementation. The exact validated Session Record
 * raw value and ledger raw values are passed into this script; Lua compares
 * live GET bytes against those values and rejects the commit if they changed,
 * disappeared, appeared, or a new ledger entry appeared. Lua still
 * fail-closes on version, required fields, identity, snapshot.session_id,
 * and snapshot revision mismatches, and never treats a corrupted Record as
 * missing.
 */
export const SESSION_AUTHORITY_CAS_LUA = `
-- Hash policy: this script does not recompute canonicalHash / SHA-256 of
-- session_snapshot or ledger entry_hash. The production adapter validates
-- those hashes with canonicalHash and binds the exact raw Session Record
-- and ledger values. Lua compares live GET bytes against those exact
-- validated raw values and fail-closes on a change, deletion, appearance,
-- or newly visible ledger entry. Lua still fail-closes on structural
-- Record integrity and never treats a corrupted Record as missing.
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """local raw = redis.call('GET', KEYS[1])
if not raw then return 5 end
local obj, ok = decode(raw)
if not ok then return 6 end
""",
        """local raw = redis.call('GET', KEYS[1])
local validatedSessionRaw = ARGV[10]
if type(validatedSessionRaw) ~= 'string' then return 6 end
-- Bind the exact TypeScript-validated raw Session Record. Lua does not
-- recompute canonicalHash. A byte-level mismatch, deletion, or appearance
-- is session_snapshot_changed (11), never success, cas_conflict, malformed,
-- or a successful create.
if validatedSessionRaw == '' then
  if raw then return 11 end
  return 5
end
if (not raw) or raw ~= validatedSessionRaw then return 11 end

local obj, ok = decode(raw)
if not ok then return 6 end
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """  local validatedHintRaw = ARGV[10]
  local startVersion = tonumber(ARGV[11]) or 0
  local endVersion = tonumber(ARGV[12]) or 0
  local entryCount = tonumber(ARGV[13]) or 0
""",
        """  local validatedHintRaw = ARGV[11]
  local startVersion = tonumber(ARGV[12]) or 0
  local endVersion = tonumber(ARGV[13]) or 0
  local entryCount = tonumber(ARGV[14]) or 0
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """    local expectedRaw = ARGV[13 + i]
""",
        """    local expectedRaw = ARGV[14 + i]
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """    local headRaw = ARGV[13 + entryCount]
""",
        """    local headRaw = ARGV[14 + entryCount]
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """  if (code === 10) return { ok: false, reason: "ledger_snapshot_changed" };
  return { ok: false, reason: "cas_conflict" };
""",
        """  if (code === 10) return { ok: false, reason: "ledger_snapshot_changed" };
  if (code === 11) return { ok: false, reason: "session_snapshot_changed" };
  return { ok: false, reason: "cas_conflict" };
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """    case "ledger_snapshot_changed":
      return 10;
    default:
      return 0;
""",
        """    case "ledger_snapshot_changed":
      return 10;
    case "session_snapshot_changed":
      return 11;
    default:
      return 0;
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """  // Authoritative canonicalHash of the live record. Redis Lua does not recompute
  // this hash; a corrupted current record must fail closed here and never be
  // overwritten. Lua still enforces structural integrity atomically.
  try {
    const currentRaw = await readKvValue(kv, serverSessionKey(sessionId));
    const current = inspectStoredSessionRecord(sessionId, currentRaw);
    if (!current) {
      // Fall through to EVAL so the Lua path cannot recreate a missing key.
    }
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) {
      return { ok: false, reason: "malformed" };
    }
    throw error;
  }

  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const intakeCommit = Boolean(opts?.intakeCommit);
  const evalArgs: string[] = [
    String(expectedRevision),
    JSON.stringify(next),
    String(SERVER_SESSION_TTL_SECONDS),
    sessionId,
    nowIso,
    intakeCommit ? "1" : "0",
    dcLedgerHeadKey(sessionId),
    ledgerEntryPrefix(sessionId),
    String(LEDGER_CAS_PROBE_LIMIT),
  ];
""",
        """  // Authoritative canonicalHash of the live record, bound by the exact raw
  // Redis bytes. Redis Lua does not recompute this hash; a corrupted current
  // record must fail closed here and never be overwritten. The exact original
  // raw string (not a JSON.stringify reconstruction) is passed to Lua, which
  // compares live GET bytes against it atomically. A genuinely absent record
  // still falls through to EVAL so the Lua path cannot recreate a missing key.
  let validatedSessionRaw = "";
  try {
    const [currentRaw] = await readRawKvValues(kv, [serverSessionKey(sessionId)]);
    inspectStoredSessionRecord(sessionId, currentRaw);
    // Preserve the exact original raw string. Empty means validated-absent.
    validatedSessionRaw = currentRaw ?? "";
  } catch (error) {
    if (error instanceof SessionRecordIntegrityError) {
      return { ok: false, reason: "malformed" };
    }
    throw error;
  }

  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const intakeCommit = Boolean(opts?.intakeCommit);
  const evalArgs: string[] = [
    String(expectedRevision),
    JSON.stringify(next),
    String(SERVER_SESSION_TTL_SECONDS),
    sessionId,
    nowIso,
    intakeCommit ? "1" : "0",
    dcLedgerHeadKey(sessionId),
    ledgerEntryPrefix(sessionId),
    String(LEDGER_CAS_PROBE_LIMIT),
    validatedSessionRaw,
  ];
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")
    print("store.ts patched")


def patch_types() -> None:
    path = ROOT / "lib/poju/session-authority/types.ts"
    text = must_replace(
        path,
        """  | "ledger_probe_incomplete"
  | "ledger_snapshot_changed";
""",
        """  | "ledger_probe_incomplete"
  | "ledger_snapshot_changed"
  | "session_snapshot_changed";
""",
    )
    write(path, text)


def patch_lifecycle() -> None:
    path = ROOT / "lib/poju/session-authority/lifecycle.ts"
    text = must_replace(
        path,
        """    code === "ledger_snapshot_changed" ||
    code === "ledger_probe_incomplete"
""",
        """    code === "ledger_snapshot_changed" ||
    code === "session_snapshot_changed" ||
    code === "ledger_probe_incomplete"
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """    if (result.reason === "ledger_snapshot_changed") {
      throw new SessionAuthorityError(
        "ledger_snapshot_changed",
        "Decision Authority ledger changed during intake commit; retry is required",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    throw new SessionAuthorityError(
""",
        """    if (result.reason === "ledger_snapshot_changed") {
      throw new SessionAuthorityError(
        "ledger_snapshot_changed",
        "Decision Authority ledger changed during intake commit; retry is required",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    if (result.reason === "session_snapshot_changed") {
      throw new SessionAuthorityError(
        "session_snapshot_changed",
        "Authoritative session record changed during commit; retry is required",
        { session_id: input.sessionId, recoverable: true },
      );
    }
    throw new SessionAuthorityError(
""",
    )
    path.write_text(text, encoding="utf-8", newline="\n")

    text = must_replace(
        path,
        """  if (error.code === "ledger_integrity_failure" || error.code === "ledger_probe_incomplete" || error.code === "ledger_snapshot_changed") return 409;
""",
        """  if (error.code === "ledger_integrity_failure" || error.code === "ledger_probe_incomplete" || error.code === "ledger_snapshot_changed" || error.code === "session_snapshot_changed") return 409;
""",
    )
    write(path, text)


def patch_package() -> None:
    path = ROOT / "package.json"
    text = must_replace(
        path,
        """    "test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.ts",
""",
        """    "test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.ts",
    "test:m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding.ts",
""",
    )
    write(path, text)


if __name__ == "__main__":
    patch_store()
    patch_types()
    patch_lifecycle()
    patch_package()
    print("all patches applied")
