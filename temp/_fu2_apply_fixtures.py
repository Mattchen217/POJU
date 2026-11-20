from pathlib import Path

def must_replace(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"anchor not found: {label} in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
    print("patched", label)


fu1 = Path("scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts")
must_replace(
    fu1,
    'import {\n  dcLedgerEntryKey,\n  dcLedgerHeadKey,\n} from "../lib/poju/decision-authority/server/ledger-store";\n',
    'import { canonicalHash, normalizeJson } from "../lib/poju/decision-authority/hash";\n'
    'import {\n  dcLedgerEntryKey,\n  dcLedgerHeadKey,\n} from "../lib/poju/decision-authority/server/ledger-store";\n'
    'import { DC_LEDGER_SCHEMA_VERSION } from "../lib/poju/decision-authority/types";\n',
    "fu1 imports",
)

must_replace(
    fu1,
    "  rawGet?: (key: string) => string | undefined;\n};\n",
    "  rawGet?: (key: string) => string | undefined;\n  getRaw?: (key: string) => string | null;\n};\n",
    "fu1 KvSurface getRaw",
)

must_replace(
    fu1,
    "class RedisEvalHarness implements KvSurface {\n  private readonly data = new Map<string, string>();\n  lastEvalScript: string | null = null;\n  lastEvalTtl: string | null = null;\n  evalCalls = 0;\n\n  rawGet(key: string): string | undefined {\n    return this.data.get(key);\n  }\n",
    "class RedisEvalHarness implements KvSurface {\n  private readonly data = new Map<string, string>();\n  lastEvalScript: string | null = null;\n  lastEvalTtl: string | null = null;\n  evalCalls = 0;\n\n  rawGet(key: string): string | undefined {\n    return this.data.get(key);\n  }\n\n  getRaw(key: string): string | null {\n    return this.data.get(key) ?? null;\n  }\n",
    "fu1 harness getRaw",
)

must_replace(
    fu1,
    "async function writeLedgerEntry(\n  kv: KvSurface,\n  sessionId: string,\n  version: number,\n  entry: Record<string, unknown>,\n): Promise<void> {\n  await kv.set(dcLedgerEntryKey(sessionId, version), entry);\n}\n\nasync function writeLedgerHint(kv: KvSurface, sessionId: string, version: number): Promise<void> {\n  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: version });\n}\n\nasync function writeValidNonFreeze(kv: KvSurface, sessionId: string, version = 1): Promise<void> {\n  await writeLedgerEntry(kv, sessionId, version, {\n    change_type: \"revise\",\n    dc_status: \"open\",\n    commit_version: version,\n    session_id: sessionId,\n  });\n  await writeLedgerHint(kv, sessionId, version);\n}\n\nasync function writeValidFreeze(kv: KvSurface, sessionId: string): Promise<void> {\n  await writeLedgerEntry(kv, sessionId, 1, {\n    change_type: \"freeze\",\n    dc_status: \"final\",\n    commit_version: 1,\n    session_id: sessionId,\n  });\n  await writeLedgerHint(kv, sessionId, 1);\n}\n",
    "function sealTestLedgerEntry(body: Record<string, unknown>): Record<string, unknown> {\n  const rest = normalizeJson(body) as Record<string, unknown>;\n  delete rest.entry_hash;\n  return { ...rest, entry_hash: canonicalHash(rest) };\n}\n\nfunction validTestLedgerEntry(\n  sessionId: string,\n  version: number,\n  patch: Record<string, unknown> = {},\n  previousHash: string | null = null,\n): Record<string, unknown> {\n  return sealTestLedgerEntry({\n    schema_version: DC_LEDGER_SCHEMA_VERSION,\n    session_id: sessionId,\n    commit_version: version,\n    previous_commit_version: version === 1 ? null : version - 1,\n    previous_entry_hash: version === 1 ? null : previousHash,\n    change_type: version === 1 ? \"genesis\" : \"draft_update\",\n    dc_status: \"draft\",\n    ...patch,\n  });\n}\n\nasync function writeLedgerEntry(\n  kv: KvSurface,\n  sessionId: string,\n  version: number,\n  entry: Record<string, unknown>,\n): Promise<void> {\n  await kv.set(dcLedgerEntryKey(sessionId, version), entry);\n}\n\nasync function writeLedgerHint(kv: KvSurface, sessionId: string, version: number): Promise<void> {\n  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: version });\n}\n\nasync function writeValidNonFreeze(kv: KvSurface, sessionId: string, version = 1): Promise<string> {\n  const entry = validTestLedgerEntry(sessionId, version, {}, null);\n  await writeLedgerEntry(kv, sessionId, version, entry);\n  await writeLedgerHint(kv, sessionId, version);\n  return String(entry.entry_hash);\n}\n\nasync function writeValidFreeze(kv: KvSurface, sessionId: string): Promise<string> {\n  const entry = validTestLedgerEntry(\n    sessionId,\n    1,\n    { change_type: \"freeze\", dc_status: \"final\" },\n    null,\n  );\n  await writeLedgerEntry(kv, sessionId, 1, entry);\n  await writeLedgerHint(kv, sessionId, 1);\n  return String(entry.entry_hash);\n}\n",
    "fu1 ledger fixture helpers",
)

must_replace(
    fu1,
    "        for (let n = 1; n <= LEDGER_CAS_PROBE_LIMIT + 1; n += 1) {\n          await writeLedgerEntry(kv, record.session_id, n, {\n            change_type: \"revise\",\n            dc_status: \"open\",\n            commit_version: n,\n            session_id: record.session_id,\n          });\n        }\n",
    "        let previousHash: string | null = null;\n        for (let n = 1; n <= LEDGER_CAS_PROBE_LIMIT + 1; n += 1) {\n          const entry = validTestLedgerEntry(record.session_id, n, {}, previousHash);\n          await writeLedgerEntry(kv, record.session_id, n, entry);\n          previousHash = String(entry.entry_hash);\n        }\n",
    "fu1 test H chained entries",
)

# M9-R1
r1 = Path("scripts/test-m9-r1-session-authority-remediation.ts")
text = r1.read_text(encoding="utf-8")
if 'from "../lib/poju/decision-authority/hash"' not in text:
    must_replace(
        r1,
        'import {\n  dcLedgerEntryKey,\n  dcLedgerHeadKey,\n} from "../lib/poju/decision-authority/server/ledger-store";\n',
        'import { canonicalHash, normalizeJson } from "../lib/poju/decision-authority/hash";\n'
        'import {\n  dcLedgerEntryKey,\n  dcLedgerHeadKey,\n} from "../lib/poju/decision-authority/server/ledger-store";\n'
        'import { DC_LEDGER_SCHEMA_VERSION } from "../lib/poju/decision-authority/types";\n',
        "r1 imports",
    )

must_replace(
    r1,
    "async function writeLedgerFreeze(kv: MemoryKv | RedisEvalHarness, sessionId: string): Promise<void> {\n  const entry = {\n    change_type: \"freeze\",\n    dc_status: \"final\",\n    commit_version: 1,\n    session_id: sessionId,\n  };\n  await kv.set(dcLedgerEntryKey(sessionId, 1), entry);\n  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: 1 });\n}\n",
    "async function writeLedgerFreeze(kv: MemoryKv | RedisEvalHarness, sessionId: string): Promise<void> {\n  const rest = normalizeJson({\n    schema_version: DC_LEDGER_SCHEMA_VERSION,\n    change_type: \"freeze\",\n    dc_status: \"final\",\n    commit_version: 1,\n    previous_commit_version: null,\n    previous_entry_hash: null,\n    session_id: sessionId,\n  }) as Record<string, unknown>;\n  const entry = { ...rest, entry_hash: canonicalHash(rest) };\n  await kv.set(dcLedgerEntryKey(sessionId, 1), entry);\n  await kv.set(dcLedgerHeadKey(sessionId), { commit_version: 1 });\n}\n",
    "r1 writeLedgerFreeze",
)

must_replace(
    r1,
    "class RedisEvalHarness {\n  private readonly data = new Map<string, string>();\n  lastEvalScript: string | null = null;\n  lastEvalTtl: string | null = null;\n\n  async get<T = unknown>(key: string): Promise<T | null> {",
    "class RedisEvalHarness {\n  private readonly data = new Map<string, string>();\n  lastEvalScript: string | null = null;\n  lastEvalTtl: string | null = null;\n\n  getRaw(key: string): string | null {\n    return this.data.get(key) ?? null;\n  }\n\n  async get<T = unknown>(key: string): Promise<T | null> {",
    "r1 harness getRaw",
)

print("fixtures done")
