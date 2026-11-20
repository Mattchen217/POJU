from pathlib import Path
import hashlib, json, shutil
from datetime import datetime, timezone, timedelta

root = Path(r"D:\POJU\pojulife")
src = root / "temp" / "m9fu2-runlogs"
dest = root / "docs" / "evidence" / "m9-r1-fu1-fu2-ledger-integrity-atomic-binding-2026-11-18"
dest.mkdir(parents=True, exist_ok=True)

impl = "a9ae8294e2b51efc3ec3f99c4195f7f7d1e521e6"
parent = "e2a0c22415e03bfd110cf75b196cf6f38d6a9a21"
now = datetime.now(timezone(timedelta(hours=-6))).strftime("%Y-%m-%d %H:%M:%S %z (America/Chicago)")

# rename tsc log to match prior style
copies = [
    ("01-test-m9-server-authoritative-session.log", "01-test-m9-server-authoritative-session.log", "pnpm test:m9-server-authoritative-session", "20 PASS lines; required M9 cases remain covered"),
    ("02-test-m9-r1-session-authority-remediation.log", "02-test-m9-r1-session-authority-remediation.log", "pnpm test:m9-r1-session-authority-remediation", "17 PASS lines; M9-R1 cases A-N remain covered"),
    ("03-test-m9-r1-fu1-redis-lua-integrity-parity.log", "03-test-m9-r1-fu1-redis-lua-integrity-parity.log", "pnpm test:m9-r1-fu1-redis-lua-integrity-parity", "31 PASS lines; FU1 cases A-O remain covered after fixture hash/chain updates"),
    ("04-test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.log", "04-test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.log", "pnpm test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding", "35 PASS lines; cases A-R plus binding/mapping contracts; REAL_REDIS_LUA_EXECUTED=no"),
    ("05-test-m8-r1-internal-turn-trust-boundary.log", "05-test-m8-r1-internal-turn-trust-boundary.log", "pnpm test:m8-r1-internal-turn-trust-boundary", "exit 0"),
    ("06-test-m6-di2-full-lifecycle.log", "06-test-m6-di2-full-lifecycle.log", "pnpm test:m6-di2-full-lifecycle", "exit 0"),
    ("07-test-m5-r1-authorization.log", "07-test-m5-r1-authorization.log", "pnpm test:m5-r1-authorization", "exit 0"),
    ("08-test-m1-production-adaptive-question-loop.log", "08-test-m1-production-adaptive-question-loop.log", "pnpm test:m1-production-adaptive-question-loop", "exit 0"),
    ("09-test-m2-1-readiness-confirm-freeze.log", "09-test-m2-1-readiness-confirm-freeze.log", "pnpm test:m2-1-readiness-confirm-freeze", "exit 0"),
    ("10-test-m2-2-freeze-report-binding.log", "10-test-m2-2-freeze-report-binding.log", "pnpm test:m2-2-freeze-report-binding", "exit 0"),
    ("11-test-m3-decision-report.log", "11-test-m3-decision-report.log", "pnpm test:m3-decision-report", "exit 0"),
    ("12-test-m4-decision-authority.log", "12-test-m4-decision-authority.log", "pnpm test:m4-decision-authority", "exit 0"),
    ("13-test-m4-1-freeze-recovery.log", "13-test-m4-1-freeze-recovery.log", "pnpm test:m4-1-freeze-recovery", "exit 0"),
    ("14-test-m5-di2-main-path.log", "14-test-m5-di2-main-path.log", "pnpm test:m5-di2-main-path", "exit 0"),
    ("15-test-m8-di2-non-model-closure.log", "15-test-m8-di2-non-model-closure.log", "pnpm test:m8-di2-non-model-closure", "exit 0"),
    ("16-tsc-noEmit.log", "16-tsc-noemit.log", "pnpm exec tsc --noEmit --pretty false", "empty stdout; tsc succeeded"),
    ("17-pnpm-build.log", "17-pnpm-build.log", "pnpm build", "production build succeeded; public/sw.js was rewritten and then restored"),
]

raw = json.loads((src / "command-exit-codes.json").read_text(encoding="utf-8"))
by_name = {item["name"]: item for item in raw["results"]}

commands = []
for src_name, dest_name, display, result in copies:
    src_path = src / src_name
    dest_path = dest / dest_name
    data = src_path.read_bytes()
    dest_path.write_bytes(data)
    item = by_name[src_name.replace(".log", "")] if src_name.endswith(".log") else None
    # map 16 name
    key = src_name[:-4]
    item = by_name[key]
    commands.append({
        "command": display,
        "log": dest_name,
        "exit_code": item["exit_code"],
        "elapsed_s": round(item["duration_ms"] / 1000, 2),
        "log_bytes": dest_path.stat().st_size,
        "implementation_sha": impl,
        "result": result,
    })

sw_pre = "38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980"
sw_post = "c76b9c03326bef54501a07596e1768bee3f6418fc1d7570a24c4e78e414ab183"
sw_now = hashlib.sha256((root / "public" / "sw.js").read_bytes()).hexdigest()
sw_bytes = (root / "public" / "sw.js").stat().st_size
assert sw_now == sw_pre

payload = {
    "recorded_at": now,
    "branch": "feat/m1-r-fresh-session-main-loop",
    "baseline_sha": parent,
    "implementation_sha": impl,
    "implementation_parent_sha": parent,
    "fu1_implementation_sha": "b4081335892005d30f8818eae957f324d12f64ba",
    "fu1_evidence_sha": "e2a0c22415e03bfd110cf75b196cf6f38d6a9a21",
    "note": "This file does not record the evidence commit SHA, to avoid a self-referential tip SHA.",
    "live_upstash_configured": False,
    "real_redis_lua_executed": False,
    "real_redis_detail": "redis-cli=no; redis-server=no; REDIS_URL=unset; docker_daemon=down; upstash_configured=no; SESSION_AUTHORITY_CAS_LUA was not executed on a real Redis server. Upstash credentials were not added and were not used.",
    "sw_js": {
        "pre_build_sha256": sw_pre,
        "pre_build_bytes": sw_bytes,
        "post_build_sha256": sw_post,
        "post_build_bytes": None,
        "restored_to_pre_build": True,
        "committed": False,
        "note": "pnpm build rewrote public/sw.js. The pre-build bytes were restored and the file was left unstaged. It is not part of the implementation or evidence commit. The post-build file was not retained after restore; only its SHA-256 was recorded.",
    },
    "commands": commands,
}

(dest / "command-exit-codes.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")

readme = f'''# M9-R1-FU1-FU2 Ledger Integrity Atomic Binding

Date recorded: 2026-11-18 (America/Chicago). Local verification completed at {now}.

This directory records the local verification run for the M9-R1-FU1-FU2 Decision Authority Ledger integrity and Redis atomic Intake binding remediation on branch `feat/m1-r-fresh-session-main-loop`.

Git baseline:

- Review baseline / parent SHA: `{parent}` (M9-R1-FU1 evidence; implementation parent `b4081335892005d30f8818eae957f324d12f64ba`)
- Implementation SHA: `{impl}`

The evidence SHA is not written in this file, to avoid a self-referential tip SHA. It is the commit that adds this directory.

This file does not declare M9 or Decision Intake 2.0 accepted. It is a verification record for independent review.

## Changed files (implementation commit)

Modified:

- `lib/poju/session-authority/store.ts`
- `lib/poju/session-authority/lifecycle.ts`
- `lib/poju/session-authority/types.ts`
- `package.json` (adds `test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding`)
- `scripts/test-m9-r1-fu1-redis-lua-integrity-parity.ts` (ledger fixtures now include canonical `entry_hash` and valid chain fields; harness gained `getRaw`)
- `scripts/test-m9-r1-session-authority-remediation.ts` (Freeze fixture now includes canonical `entry_hash` and valid chain fields; harness gained `getRaw`)

Added:

- `scripts/test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.ts`

`public/sw.js` was rewritten by `pnpm build` and then restored to its pre-build bytes. It was left unstaged and is not in either commit.

- Pre-build SHA-256: `{sw_pre}` ({sw_bytes} bytes)
- Post-build SHA-256: `{sw_post}` (rewritten file was not retained after restore)
- Working tree restored to the pre-build bytes after the successful build.

## Exact integrity and race mechanism

The production intake CAS must not accept a Ledger Entry solely because `session_id` and `commit_version` match.

1. TypeScript reads the authoritative Ledger snapshot needed for the bounded Freeze probe (`collectLedgerBindingSnapshot()` in `lib/poju/session-authority/store.ts`). The snapshot includes the head hint and every entry from genesis (commit 1) through the effective head, not only the hint entry. The head hint remains a hint.

2. TypeScript validates each consumed entry with the existing `canonicalHash` implementation from `lib/poju/decision-authority/hash.ts`. Required checks include valid JSON, required schema fields and types, session identity, `commit_version`, `previous_commit_version`, `previous_entry_hash`, `change_type`, `dc_status`, and `entry_hash`. The chain is walked so integrity is not claimed merely because the last entry's hash matches.

3. On the production Redis / `kv.eval` path, `runLuaSessionCas()` passes those exact raw validated Ledger values and probe metadata into `SESSION_AUTHORITY_CAS_LUA`.

4. Lua compares the current Redis raw `GET` bytes against those exact validated raw values inside the atomic script. Lua does not recompute JavaScript `canonicalHash` or `entry_hash`.

5. If any validated raw value changed between validation and EVAL, the commit is rejected with `ledger_snapshot_changed` (Lua code 10). The changed entry is not treated as a valid non-Freeze head.

6. If a new Ledger entry appeared after the validation snapshot (`endVersion + 1` is now occupied, or the hint raw changed), the commit is rejected with `ledger_snapshot_changed`. The script never proceeds on an incomplete validated snapshot. A later retry re-reads, re-validates, and will see a new Freeze as frozen.

7. Session revision CAS and all existing lifecycle checks are preserved and still run in the same Lua script before the ledger binding decision.

8. MemoryKv uses the same hash and chain checks inside its synchronous CAS section (`probeSameKvLedger()`). There is no pre-validation-to-commit window on that path.

Missing entries, malformed entries, invalid hashes, invalid chains, inconsistent or concealing hints, and probe-limit exhaustion fail closed (`ledger_integrity` or `ledger_probe_incomplete`). A ledger integrity failure is never mapped to an ordinary revision conflict, a missing ledger, "not frozen," or a successful Intake. `commitAuthoritativeSessionUpdate()` maps `ledger_snapshot_changed` to an explicit recoverable Session Authority error.

NX-write semantics and the ledger schema are unchanged. This change does not rewrite append-only ledger history.

## Real Redis / Lua execution

Real Redis/Lua was not executed. This machine had no `redis-cli`, no `redis-server`, no `REDIS_URL`, and the Docker daemon was not running. No Upstash / KV credentials were present, and none were added. `SESSION_AUTHORITY_CAS_LUA` remains unexecuted in a real Redis server.

This record does not claim that production Redis or production Lua passed.

The Redis eval contract harness asserts that `createKvSessionAuthorityStore()` calls `kv.eval` with the exact production Lua source and the validated raw snapshot, then applies the shared TypeScript raw-binding predicate. That harness is not a Redis server and is not a Lua VM. Static Lua source assertions are not execution evidence.

## Regression cases (A-R)

Unless noted, cases ran on both the MemoryKv production adapter (TypeScript/MemoryKv atomic path) and the Redis eval contract harness (not Lua execution).

- A. Valid Freeze entry: Intake rejected.
- B. Valid non-Freeze entry: Intake eligible.
- C. Freeze entry with corrupted `change_type` but original `entry_hash`: rejected as `ledger_integrity`.
- D. Freeze entry with corrupted `dc_status` but original `entry_hash`: rejected as `ledger_integrity`.
- E. Corrupted `entry_hash`: rejected as `ledger_integrity`.
- F. Incorrect `previous_entry_hash` (own hash still valid): rejected as `ledger_integrity`.
- G. Missing intermediate Ledger entry: fail closed as `ledger_integrity`.
- H. Invalid `commit_version` sequence: fail closed as `ledger_integrity`.
- I. Invalid head hint that conceals an entry: fail closed as `ledger_integrity`.
- J. Validated raw entry changes between pre-validation and EVAL: CAS rejects with `ledger_snapshot_changed` (harness only; MemoryKv has no such window).
- K. New entry appears between pre-validation and EVAL: CAS rejects with `ledger_snapshot_changed` (harness only).
- L. New Freeze entry races Intake commit: Intake is not accepted (harness returned `ledger_snapshot_changed`; Freeze is not silently missed).
- M. Probe limit exhaustion: fail closed as `ledger_probe_incomplete`.
- N. No Ledger genuinely exists: Intake remains eligible, consistent with existing policy.
- O. Existing Session integrity failures remain rejected (`malformed`).
- P. Existing Session lifecycle and revision conflicts remain correct (`cas_conflict`, `expired`, `frozen`, `terminated`).
- Q. Same-content idempotency remains successful without rerunning the model.
- R. Different-content idempotency still returns `session_turn_conflict`.
- S. Existing M9, M9-R1, and FU1 regressions passed in this run (`pnpm test:m9-server-authoritative-session`, `pnpm test:m9-r1-session-authority-remediation`, `pnpm test:m9-r1-fu1-redis-lua-integrity-parity`, all exit 0).

## Remaining limitations

- `SESSION_AUTHORITY_CAS_LUA` was not executed against a real Redis server or Lua VM.
- Lua still does not recompute JavaScript `canonicalHash`. Integrity of ledger hashes is established in TypeScript and bound atomically by exact raw-value comparison.
- If Session store and Decision Authority ledger are not the same KV, the same-KV probe cannot see Freeze. The production path `createKvSessionAuthorityStore(durableKv())` still shares `durableKv()` with the ledger.
- Real OpenRouter, paid report generation, billing / Pass consumption, deployment, and browser LAB were not run.

## Command results

All required commands exited 0. See `command-exit-codes.json` for exact commands, exit codes, durations, log paths, and the implementation SHA. Each log file in this directory is the raw captured output of that command.
'''
(dest / "README.md").write_text(readme, encoding="utf-8", newline="\n")
print("wrote", dest)
print("files", sorted(p.name for p in dest.iterdir()))
