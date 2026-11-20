from pathlib import Path

root = Path(r"D:\POJU\pojulife")
store_path = root / "lib" / "poju" / "session-authority" / "store.ts"
text = store_path.read_text(encoding="utf-8")
# Normalize to LF for matching
nl = "\n"
text = text.replace("\r\n", "\n")

def read_frag(name: str) -> str:
    return (root / "temp" / name).read_text(encoding="utf-8").replace("\r\n", "\n").rstrip() + "\n"

def replace_once(src: str, start: str, end: str, new: str, label: str) -> str:
    i = src.find(start)
    if i < 0:
        raise SystemExit(f"start marker not found: {label}")
    j = src.find(end, i)
    if j < 0:
        raise SystemExit(f"end marker not found: {label}")
    return src[:i] + new + src[j:]

# 1. SessionCasReason
old_reason_start = 'export type SessionCasReason ='
old_reason_end = 'export type SessionCasResult ='
text = replace_once(text, old_reason_start, old_reason_end, read_frag("_fu1_cas_reason.ts.txt") + "\n", "SessionCasReason")

# 2. Ledger probe + evaluateSessionAuthorityCas
old_probe_start = "function isLedgerFrozenValue(raw: unknown): boolean {"
old_probe_end = "export function applySessionAuthorityCas(input: {"
text = replace_once(text, old_probe_start, old_probe_end, read_frag("_fu1_probe_eval.ts.txt") + "\n", "probe/evaluate")

# 3. Lua script including its comment
old_lua_start = "/**\n * Lua: atomic Session CAS. Returns:"
old_lua_end = "function casCodeToResult(code: unknown): SessionCasResult {"
lua = read_frag("_fu1_lua.ts.txt")
text = replace_once(text, old_lua_start, old_lua_end, lua + "\n", "LUA")

# 4. cas code mapping
old_codes_start = "function casCodeToResult(code: unknown): SessionCasResult {"
old_codes_end = "function ledgerEntryPrefix(sessionId: string): string {"
# After LUA replace, casCodeToResult should still exist if end marker was casCodeToResult
# Wait: we used casCodeToResult as the end marker and kept it. Good.
text = replace_once(text, old_codes_start, old_codes_end, read_frag("_fu1_cas_codes.ts.txt") + "\n", "cas codes")

# 5. runLuaSessionCas
old_run_start = "async function runLuaSessionCas("
old_run_end = "export function createKvSessionAuthorityStore(kv: KvLike): SessionAuthorityStore {"
text = replace_once(text, old_run_start, old_run_end, read_frag("_fu1_run_lua.ts.txt") + "\n", "runLuaSessionCas")

# 6. get() uses readKvValue
old_get = "        const raw = await kv.get<unknown>(serverSessionKey(sessionId));\n        return inspectStoredSessionRecord(sessionId, raw);"
new_get = "        const raw = await readKvValue(kv, serverSessionKey(sessionId));\n        return inspectStoredSessionRecord(sessionId, raw);"
if old_get not in text:
    raise SystemExit("get() snippet not found")
text = text.replace(old_get, new_get, 1)

# 7. file header note
old_header = """ * M9-R1: reads fail closed on identity, hash, version, or revision corruption and
 * never treat a damaged record as missing. CAS is atomic (in-process sync section
 * or Redis Lua), will not create a record when the key is missing or malformed,
 * and the intake-commit path probes Decision Authority ledger keys in the same KV
 * when they are present. Two independent KV operations are not treated as atomic.
 */
"""
new_header = """ * M9-R1: reads fail closed on identity, hash, version, or revision corruption and
 * never treat a damaged record as missing. CAS is atomic (in-process sync section
 * or Redis Lua), will not create a record when the key is missing or malformed,
 * and the intake-commit path probes Decision Authority ledger keys in the same KV
 * when they are present. Two independent KV operations are not treated as atomic.
 *
 * M9-R1-FU1: Redis Lua CAS now fail-closes on the same structural Record
 * integrity contract as inspectStoredSessionRecord (version, required fields,
 * identity, snapshot id, snapshot revision). Ledger probes fail closed on
 * malformed or structurally invalid data and on probe-limit exhaustion.
 * Lua does not recompute canonicalHash; the production Redis adapter runs
 * inspectStoredSessionRecord before EVAL. Reason codes distinguish ledger
 * integrity and incomplete probes from ordinary CAS conflicts.
 */
"""
if old_header not in text:
    raise SystemExit("header not found")
text = text.replace(old_header, new_header, 1)

# leftover alias: sessionCasResultToLuaCode / luaCasCodeToResult should be used
if "casCodeToResult(" in text:
    raise SystemExit("leftover casCodeToResult call")

store_path.write_text(text, encoding="utf-8", newline="\n")
print("store.ts lines", text.count("\n"), "bytes", store_path.stat().st_size)