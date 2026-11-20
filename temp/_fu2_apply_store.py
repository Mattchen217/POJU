from pathlib import Path

path = Path("lib/poju/session-authority/store.ts")
text = path.read_text(encoding="utf-8")


def must(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    text = text.replace(old, new, 1)
    print("patched", label)


must(
    " * integrity and incomplete probes from ordinary CAS conflicts.\n */",
    " * integrity and incomplete probes from ordinary CAS conflicts.\n"
    " *\n"
    " * M9-R1-FU1-FU2: TypeScript validates ledger entry_hash with canonicalHash and\n"
    " * binds the exact raw entries into Redis Lua CAS. Lua compares live GET bytes\n"
    " * against that snapshot and fail-closes on a changed or newly visible entry.\n"
    " * Lua still does not recompute JavaScript canonicalHash.\n */",
    "fu2 header",
)

must(
    'import {\n  dcLedgerEntryKey,\n  dcLedgerHeadKey,\n} from "@/lib/poju/decision-authority/server/ledger-store";\n',
    'import {\n  dcLedgerEntryKey,\n  dcLedgerHeadKey,\n} from "@/lib/poju/decision-authority/server/ledger-store";\nimport { DC_LEDGER_SCHEMA_VERSION } from "@/lib/poju/decision-authority/types";\n',
    "import schema version",
)

must(
    '  | "ledger_integrity"\n  | "ledger_probe_incomplete";',
    '  | "ledger_integrity"\n  | "ledger_probe_incomplete"\n  | "ledger_snapshot_changed";',
    "SessionCasReason",
)

must(
    "  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;\n",
    "  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;\n"
    "  getRaw?: (key: string) => Promise<string | null> | string | null;\n",
    "KvLike getRaw",
)

start = text.find("function inspectLedgerEntryValue")
end = text.find("function assertNextIntegrity")
if start < 0 or end < start:
    raise SystemExit("probe section anchors missing")
helpers = Path("temp/_fu2_helpers.ts.txt").read_text(encoding="utf-8")
if not helpers.endswith("\n"):
    helpers += "\n"
text = text[:start] + helpers + text[end:]
print("patched probe+binding helpers")

must(
    "export function evaluateSessionAuthorityCas(input: {\n  sessionId: string;\n  expectedRevision: number;\n  next: unknown;\n  read: (key: string) => unknown | null;\n  intakeCommit: boolean;\n  nowIso: string;\n}): SessionCasResult {",
    "export function evaluateSessionAuthorityCas(input: {\n  sessionId: string;\n  expectedRevision: number;\n  next: unknown;\n  read: (key: string) => unknown | null;\n  intakeCommit: boolean;\n  nowIso: string;\n  ledgerBinding?: LedgerRawBindingLive;\n}): SessionCasResult {",
    "evaluate signature",
)

must(
    '    const probe = probeSameKvLedger(input.read, input.sessionId);\n    if (!probe.ok) return { ok: false, reason: probe.reason };\n    if (probe.frozen) return { ok: false, reason: "frozen" };\n',
    "    if (input.ledgerBinding) {\n"
    "      const bind = evaluateLedgerRawBinding(input.ledgerBinding);\n"
    "      if (!bind.ok) return { ok: false, reason: bind.reason };\n"
    '      if (bind.frozen) return { ok: false, reason: "frozen" };\n'
    "    } else {\n"
    "      const probe = probeSameKvLedger(input.read, input.sessionId);\n"
    "      if (!probe.ok) return { ok: false, reason: probe.reason };\n"
    '      if (probe.frozen) return { ok: false, reason: "frozen" };\n'
    "    }\n",
    "evaluate ledger binding branch",
)

must(
    "export function applySessionAuthorityCas(input: {\n  sessionId: string;\n  expectedRevision: number;\n  next: unknown;\n  read: (key: string) => unknown | null;\n  write: (key: string, value: ServerSessionRecord, ttlSeconds: number) => void;\n  intakeCommit: boolean;\n  nowIso: string;\n  ttlSeconds: number;\n}): SessionCasResult {",
    "export function applySessionAuthorityCas(input: {\n  sessionId: string;\n  expectedRevision: number;\n  next: unknown;\n  read: (key: string) => unknown | null;\n  write: (key: string, value: ServerSessionRecord, ttlSeconds: number) => void;\n  intakeCommit: boolean;\n  nowIso: string;\n  ttlSeconds: number;\n  ledgerBinding?: LedgerRawBindingLive;\n}): SessionCasResult {",
    "apply signature",
)

must(
    " *   8  ledger integrity failure\n *   9  ledger probe incomplete\n",
    " *   8  ledger integrity failure\n *   9  ledger probe incomplete\n *   10 ledger snapshot changed (retryable binding mismatch or new entry)\n",
    "lua result contract comment",
)

must(
    " *       ledgerHeadKey, ledgerEntryPrefix, probeLimit\n",
    " *       ledgerHeadKey, ledgerEntryPrefix, probeLimit,\n"
    " *       [intake] hintRaw, startVersion, endVersion, entryCount, entryRaw...\n",
    "lua argv comment",
)

must(
    " * Hash policy: this script does not recompute canonicalHash / SHA-256 of\n"
    " * session_snapshot. Exact JS JSON.stringify + SHA-256 parity cannot be\n"
    " * implemented safely in Redis Lua (cjson cannot faithfully distinguish []\n"
    " * from {}, and number/unicode encoding may diverge). The production Redis\n"
    " * adapter runs inspectStoredSessionRecord (canonicalHash) on the current\n"
    " * and proposed records before EVAL. Lua still fail-closes on version,\n"
    " * required fields, identity, snapshot.session_id, and snapshot revision\n"
    " * mismatches, and never treats a corrupted Record as missing.\n */",
    " * Hash policy: this script does not recompute canonicalHash / SHA-256 of\n"
    " * session_snapshot or ledger entry_hash. Exact JS JSON.stringify + SHA-256\n"
    " * parity cannot be implemented safely in Redis Lua. The production Redis\n"
    " * adapter runs inspectStoredSessionRecord (canonicalHash) on the current\n"
    " * and proposed records before EVAL, and validates ledger entry hashes with\n"
    " * the same canonicalHash implementation. The exact validated ledger raw\n"
    " * values are passed into this script; Lua compares live GET bytes against\n"
    " * those values and rejects the commit if they changed or a new entry\n"
    " * appeared. Lua still fail-closes on version, required fields, identity,\n"
    " * snapshot.session_id, and snapshot revision mismatches, and never treats a\n"
    " * corrupted Record as missing.\n */",
    "lua header hash policy",
)

must(
    "-- Hash policy: this script does not recompute canonicalHash / SHA-256 of\n"
    "-- session_snapshot. Exact JS JSON.stringify + SHA-256 parity cannot be\n"
    "-- implemented safely in Redis Lua (cjson cannot faithfully distinguish []\n"
    "-- from {}, and number/unicode encoding may diverge). The production Redis\n"
    "-- adapter runs inspectStoredSessionRecord (canonicalHash) before EVAL.\n"
    "-- Lua still fail-closes on structural Record integrity and ledger probe\n"
    "-- failures and never treats a corrupted Record as missing.\n",
    "-- Hash policy: this script does not recompute canonicalHash / SHA-256 of\n"
    "-- session_snapshot or ledger entry_hash. The production adapter validates\n"
    "-- those hashes with canonicalHash and binds the exact raw ledger values.\n"
    "-- Lua compares live GET bytes against that snapshot and fail-closes on a\n"
    "-- change or newly visible entry. Lua still fail-closes on structural\n"
    "-- Record integrity and never treats a corrupted Record as missing.\n",
    "lua in-script hash policy",
)

lua_old = Path("temp/_fu2_lua_old.txt").read_text(encoding="utf-8")
lua_new = Path("temp/_fu2_lua_new.txt").read_text(encoding="utf-8")
if not lua_new.endswith("\n"):
    lua_new += "\n"
must(lua_old, lua_new, "lua intake binding block")

must(
    '  if (code === 8) return { ok: false, reason: "ledger_integrity" };\n'
    '  if (code === 9) return { ok: false, reason: "ledger_probe_incomplete" };\n'
    '  return { ok: false, reason: "cas_conflict" };',
    '  if (code === 8) return { ok: false, reason: "ledger_integrity" };\n'
    '  if (code === 9) return { ok: false, reason: "ledger_probe_incomplete" };\n'
    '  if (code === 10) return { ok: false, reason: "ledger_snapshot_changed" };\n'
    '  return { ok: false, reason: "cas_conflict" };',
    "luaCasCodeToResult",
)

must(
    '    case "ledger_integrity":\n      return 8;\n    case "ledger_probe_incomplete":\n      return 9;\n    default:\n      return 0;',
    '    case "ledger_integrity":\n      return 8;\n    case "ledger_probe_incomplete":\n      return 9;\n    case "ledger_snapshot_changed":\n      return 10;\n    default:\n      return 0;',
    "sessionCasResultToLuaCode",
)

run_old = Path("temp/_fu2_runlua_old.txt").read_text(encoding="utf-8")
run_new = Path("temp/_fu2_runlua_new.txt").read_text(encoding="utf-8")
if not run_new.endswith("\n"):
    run_new += "\n"
must(run_old, run_new, "runLuaSessionCas")

path.write_text(text, encoding="utf-8", newline="\n")
print("store.ts written", len(text.splitlines()), "lines")
