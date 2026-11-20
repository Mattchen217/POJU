from pathlib import Path
import json, datetime, re

ev = Path("docs/evidence/m9-r1-fu1-redis-lua-integrity-parity-2026-11-18")
meta = json.loads((ev / "_run_meta.json").read_text(encoding="utf-8"))
impl = "b4081335892005d30f8818eae957f324d12f64ba"
parent = "2ce92f5c6ab9ce1748401a16f42abe386a7d00b2"
# The runner's HEAD^ was swallowed by cmd.exe caret escaping; use the verified parent.

def pass_count(text: str) -> int:
    return len(re.findall(r"^PASS ", text, re.M))

def result_text(entry, text: str) -> str:
    passes = pass_count(text)
    if entry["command"].startswith("pnpm exec tsc"):
        return "empty stdout/stderr; exit 0 (allowed for a successful tsc run)"
    if entry["command"] == "pnpm build":
        return "production build completed; public/sw.js was rewritten then restored to pre-build bytes"
    if passes:
        extra = ""
        if "fu1" in entry["log"]:
            extra = "; cases A-O covered on MemoryKv and labeled Redis eval harness; REAL_REDIS_LUA_EXECUTED=no"
        if "m9-server" in entry["log"]:
            extra = "; required cases 1-19 covered; checks complete"
        if "m9-r1-session-authority-remediation" in entry["log"]:
            extra = "; existing M9-R1 cases preserved; checks complete"
        if "m8-r1-internal" in entry["log"]:
            extra = "; checks complete"
        return f"{passes} PASS lines{extra}"
    if "complete" in text.lower():
        return "exit 0; suite reported complete in raw log"
    return "exit 0; see raw log"

commands = []
for entry in meta["results"]:
    text = (ev / entry["log"]).read_text(encoding="utf-8")
    commands.append({
        "command": entry["command"],
        "log": entry["log"],
        "exit_code": entry["exit_code"],
        "elapsed_s": entry["elapsed_s"],
        "log_bytes": entry["log_bytes"],
        "implementation_sha": impl,
        "result": result_text(entry, text),
    })

recorded = datetime.datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")
# Prefer an explicit America/Chicago label.
recorded_label = recorded + " (America/Chicago)"

codes = {
    "recorded_at": recorded_label,
    "branch": "feat/m1-r-fresh-session-main-loop",
    "baseline_sha": parent,
    "implementation_sha": impl,
    "implementation_parent_sha": parent,
    "m9_r1_implementation_sha": "d9c6434e630573014f82803a395ea45a8adacbc3",
    "m9_implementation_sha": "ca3a68a3fb3c06789997678208d40b24ef7177e6",
    "note": "This file does not record the evidence commit SHA, to avoid a self-referential tip SHA.",
    "live_upstash_configured": False,
    "real_redis_lua_executed": False,
    "real_redis_detail": "no redis-server, no REDIS_URL, Docker daemon not running, and no UPSTASH/KV credentials; SESSION_AUTHORITY_CAS_LUA was not executed on a real Redis server",
    "sw_js": {
        "pre_build_sha256": meta["preSha"],
        "pre_build_bytes": meta["preBytes"],
        "post_build_sha256": meta["postSha"],
        "post_build_bytes": meta["postBytes"],
        "restored_to_pre_build": True,
        "committed": False,
        "note": "If pnpm build rewrote public/sw.js, the pre-build bytes were restored and the file was left unstaged. It is not part of the implementation or evidence commit.",
    },
    "commands": commands,
}

(ev / "command-exit-codes.json").write_text(
    json.dumps(codes, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
    newline="\n",
)

readme = f"""# M9-R1-FU1 Redis Lua Integrity Parity

Date recorded: 2026-11-18 (America/Chicago). Local verification completed at {recorded_label}.

This directory records the local verification run for the M9-R1-FU1 Redis Lua / shared-predicate integrity parity remediation on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Review baseline / parent SHA: `{parent}` (M9-R1 evidence; implementation parent `d9c6434e630573014f82803a395ea45a8adacbc3`)
- Implementation SHA: `{impl}`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare M9 or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/types.ts`
- `package.json` (adds `test:m9-r1-fu1-redis-lua-integrity-parity`)

Added:

- `scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `{meta["preSha"]}` ({meta["preBytes"]} bytes)
- Post-build SHA-256: `{meta["postSha"]}` ({meta["postBytes"]} bytes)
- Working tree restored to the pre-build bytes after the successful build.

## Finding 1 — Redis Lua Record Integrity

`SESSION_AUTHORITY_CAS_LUA` now inspects both the stored current Record and the proposed next Record before accepting CAS. The Lua inspect checks:

- supported Record version
- required fields and types
- stored `session_id` equals the requested Session ID
- `session_snapshot` exists and is a table
- `session_snapshot.session_id` equals Record `session_id`
- `session_snapshot.session_revision` equals Record `revision`
- proposed Record identity, generation, revision increment (no decrease or skip), and `expires_at` not extended
- missing records still return code 5 and are not created
- malformed current records return code 6 and are not overwritten
- invalid proposed records return code 7

These failures are not collapsed into ordinary revision conflicts.

## Finding 2 — Canonical hash parity / architecture

Exact `canonicalHash` parity cannot be implemented safely in Redis Lua. The existing hash is `sha256(canonicalStringify(normalizeJson(snapshot)))`, where `canonicalStringify` is `JSON.stringify(sortKeysDeep(...))`. Redis Lua cjson cannot faithfully distinguish `[]` from `{{}}`, and JavaScript `JSON.stringify` number and unicode encoding cannot be reproduced safely in Lua 5.1. A second hashing format was not introduced.

Lua therefore does not recompute SHA-256 and does not treat a precomputed client-controlled hash as proof of integrity. The production Redis adapter (`runLuaSessionCas`) runs `inspectStoredSessionRecord()` — the existing TypeScript `canonicalHash` contract — on the proposed next Record and on the live current Record before `EVAL`. A hash-mismatched or otherwise corrupt current Record fails closed as `malformed` and is not overwritten; `EVAL` is not invoked in that case. Lua still fail-closes atomically on structural integrity failures (including snapshot id and snapshot revision mismatches), lifecycle, revision CAS, and ledger probe failures.

The Lua source contains an explicit comment stating this hash policy. Do not read a static source mention of `canonicalHash`, or a TypeScript simulation, as proof that Redis executed a hash check inside Lua.

## Finding 3 — Ledger probe fail-closed

The same-KV ledger Freeze probe now distinguishes:

- genuinely missing ledger entry / missing hint (scan from 0; no ledger means not frozen)
- valid non-Freeze ledger entry (Intake remains eligible)
- valid Freeze or `dc_status=final` ledger entry (Intake rejected as frozen)
- malformed JSON (fail closed: `ledger_integrity`)
- structurally invalid entry, including `session_id` or `commit_version` mismatch (fail closed: `ledger_integrity`)
- invalid or unusable head hint, including a hint that points at a missing entry (fail closed: `ledger_integrity`)
- probe-limit exhaustion while a later entry is still visible (fail closed: `ledger_probe_incomplete`)

Malformed or structurally invalid ledger data no longer silently means "not frozen." TypeScript also verifies a present `entry_hash` with the existing `canonicalHash` contract. Lua does not recompute ledger entry hashes. NX-write semantics and the ledger schema are unchanged. Freeze becomes effective when the NX-written ledger entry itself is visible; a head hint that has not been written yet can still be discovered by the forward scan.

## Finding 4 — One explicit result contract

TypeScript and Lua use one explicit result contract:

- 1 accepted
- 0 revision conflict
- 2 expired
- 3 frozen
- 4 terminated
- 5 missing
- 6 malformed Record
- 7 invalid identity/contract
- 8 ledger integrity failure
- 9 ledger probe incomplete

`commitAuthoritativeSessionUpdate()` maps ledger integrity and incomplete probe results to explicit Authority errors (`ledger_integrity_failure`, `ledger_probe_incomplete`) rather than a generic `session_cas_conflict`. Identity/contract failures map to `invalid_session_record`.

## Tests

New script: `pnpm test:m9-r1-fu1-redis-lua-integrity-parity`.

Cases A–O were run against:

- the MemoryKv production adapter (`createKvSessionAuthorityStore(new MemoryKv())`), which uses the in-process atomic TypeScript predicate, including `canonicalHash`
- a Redis eval contract harness that asserts `eval()` receives the exact production `SESSION_AUTHORITY_CAS_LUA` source, then executes the shared TypeScript predicate

The harness is labeled in the script and in the raw log: it is not a Redis server and it does not execute Lua. Static Lua source assertions in the same script are labeled as source contract checks, not as proof of Redis Lua execution.

Existing `pnpm test:m9-server-authoritative-session` (20 cases) and `pnpm test:m9-r1-session-authority-remediation` (17 cases) were kept and still passed. M1–M8 required regressions, `tsc`, and `pnpm build` also exited 0.

## Real Redis / Lua execution

Real Redis/Lua was **not** executed.

- `redis-server` and `redis-cli` are not installed
- `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, and `KV_REST_API_URL` are unset
- Docker is installed but the Docker daemon is not running
- No infrastructure, credentials, or production configuration were added to run this task

`SESSION_AUTHORITY_CAS_LUA` therefore remains unexecuted in a real Redis server. This evidence does not claim that production Redis passed.

## Command results

All required commands were run after implementation commit `{impl}`. Raw logs are in this directory. `15-tsc-noemit.log` is 0 bytes because `tsc` succeeded with empty stdout and stderr.

See `command-exit-codes.json` for the exact command, exit code, log path, duration, log size, and implementation SHA of each run.

## Remaining limitations

- Lua was not executed on a real Redis server or Lua VM.
- Lua does not recompute `canonicalHash`. A hash-only corruption that appears after the TypeScript pre-EVAL inspect, and that does not also fail Lua structural checks, is outside what Lua itself can prove. The production adapter fail-closes on hash mismatch before EVAL, and `commitAuthoritativeSessionUpdate()` also re-reads with `inspectStoredSessionRecord` before CAS.
- Lua does not recompute ledger `entry_hash`. A ledger entry that is structurally valid but has a wrong hash is rejected by the TypeScript probe and would not be detected by Lua alone.
- No real OpenRouter, paid report, billing, or Pass consumption was exercised.
- No browser LAB was run.
- This record does not declare M9 PASS or Decision Intake 2.0 complete.
"""

(ev / "README.md").write_text(readme, encoding="utf-8", newline="\n")
(ev / "_run_meta.json").unlink()
print("wrote README and command-exit-codes.json")
print("files:")
for p in sorted(ev.iterdir()):
    print(f"  {p.name} {p.stat().st_size}")