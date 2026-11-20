
# -*- coding: utf-8 -*-
from __future__ import annotations
import hashlib, json, shutil
from pathlib import Path

ROOT = Path(r"D:/POJU/pojulife")
EVID = ROOT / "docs/evidence/di2-feature-landing-main-path-2026-11-18"
LOGS = ROOT / "temp/di2-landing-logs"
SMOKE = ROOT / "temp/m2-4-r2-openrouter-smoke-1795006575663.json"
EVID.mkdir(parents=True, exist_ok=True)

def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

log_map = [
    ("01-test-di2-feature-landing-main-path.log", "test_di2-feature-landing-main-path.log"),
    ("02-test-m1-production-adaptive-question-loop.log", "test_m1-production-adaptive-question-loop.log"),
    ("03-test-m1-r-fresh-session-main-loop.log", "test_m1-r-fresh-session-main-loop.log"),
    ("04-test-m2-1-readiness-confirm-freeze.log", "test_m2-1-readiness-confirm-freeze.log"),
    ("05-test-m2-2-freeze-report-binding.log", "test_m2-2-freeze-report-binding.log"),
    ("06-test-m2-3-decision-blueprint.log", "test_m2-3-decision-blueprint.log"),
    ("07-test-m2-4-r2-production-closure.log", "test_m2-4-r2-production-closure.log"),
    ("08-test-m3-decision-report.log", "test_m3-decision-report.log"),
    ("09-test-m4-decision-authority.log", "test_m4-decision-authority.log"),
    ("10-test-m4-1-freeze-recovery.log", "test_m4-1-freeze-recovery.log"),
    ("11-test-m5-di2-main-path.log", "test_m5-di2-main-path.log"),
    ("12-test-m6-di2-full-lifecycle.log", "test_m6-di2-full-lifecycle.log"),
    ("13-test-m8-di2-non-model-closure.log", "test_m8-di2-non-model-closure.log"),
    ("14-test-m8-r1-internal-turn-trust-boundary.log", "test_m8-r1-internal-turn-trust-boundary.log"),
    ("15-test-m9-server-authoritative-session.log", "test_m9-server-authoritative-session.log"),
    ("16-test-m9-r1-session-authority-remediation.log", "test_m9-r1-session-authority-remediation.log"),
    ("17-test-m9-r1-fu1-redis-lua-integrity-parity.log", "test_m9-r1-fu1-redis-lua-integrity-parity.log"),
    ("18-test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.log", "test_m9-r1-fu1-fu2-ledger-integrity-atomic-binding.log"),
    ("19-test-m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding.log", "test_m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding.log"),
    ("20-tsc-noemit.log", "test_tsc-noemit.log"),
    ("21-pnpm-build.log", "test_pnpm-build.log"),
]
copied = []
for dest, src in log_map:
    s = LOGS / src
    d = EVID / dest
    if not s.exists():
        raise SystemExit("missing log " + str(s))
    shutil.copyfile(s, d)
    copied.append({"file": dest, "sha256": sha256(d), "bytes": d.stat().st_size})

smoke = json.loads(SMOKE.read_text(encoding="utf-8"))
cases = []
total_cost = 0.0
prompt = 0
completion = 0
met = 0
total = 0
for c in smoke.get("cases", []):
    slim_turns = []
    for t in c.get("turns") or []:
        calls = []
        for call in t.get("openrouter_calls") or []:
            req = call.get("request") or {}
            resp = call.get("response") or {}
            usage = resp.get("usage") or {}
            cost = usage.get("cost") or 0
            total_cost += float(cost or 0)
            prompt += int(usage.get("prompt_tokens") or 0)
            completion += int(usage.get("completion_tokens") or 0)
            err = resp.get("error")
            if isinstance(err, dict):
                err = {k: err[k] for k in err if k in ("message", "code", "metadata")}
            parse = call.get("parse") or {}
            calls.append({
                "via_route": call.get("via_route"),
                "request": {
                    "model": req.get("model"),
                    "temperature": req.get("temperature"),
                    "max_tokens": req.get("max_tokens"),
                    "response_format": req.get("response_format"),
                    "provider_pref": req.get("provider_pref"),
                    "system_prompt_chars": req.get("system_prompt_chars"),
                },
                "response": {
                    "http_status": resp.get("http_status"),
                    "provider": resp.get("provider"),
                    "model": resp.get("model"),
                    "finish_reason": resp.get("finish_reason"),
                    "usage": {
                        "prompt_tokens": usage.get("prompt_tokens"),
                        "completion_tokens": usage.get("completion_tokens"),
                        "total_tokens": usage.get("total_tokens"),
                        "cost": usage.get("cost"),
                    } if usage else None,
                    "error": err,
                },
                "parse": {
                    "ok": parse.get("ok"),
                    "reason": parse.get("reason"),
                    "classification": parse.get("classification"),
                    "item_count": len(parse.get("items") or []),
                },
            })
        after = t.get("after") or {}
        dc = after.get("dc") or {}
        slim_turns.append({
            "label": t.get("label"),
            "route_hits": t.get("route_hits"),
            "openrouter_calls": calls,
            "after": {
                "phase": after.get("phase"),
                "dc_version": dc.get("version"),
                "fact_count": dc.get("fact_count"),
                "status": dc.get("status"),
            },
        })
    exps = c.get("expectations") or []
    for e in exps:
        total += 1
        if e.get("met"):
            met += 1
    cases.append({
        "id": c.get("id"),
        "title": c.get("title"),
        "notes": c.get("notes"),
        "expectations": exps,
        "turns": slim_turns,
    })

slim = {
    "kind": smoke.get("kind"),
    "ran_at": smoke.get("ran_at"),
    "transport": smoke.get("transport"),
    "stubbed": smoke.get("stubbed"),
    "redaction": "Evidence copy is slimmed: no user texts, no prompt excerpts, no headers, no env, no secrets. Original local report stayed in temp/ and was not committed.",
    "expectations": {"met": met, "total": total, "reported": smoke.get("expectations")},
    "usage_totals": {"prompt_tokens": prompt, "completion_tokens": completion, "cost": round(total_cost, 8)},
    "cases": cases,
    "limitations": [
        "This smoke covers production Answer Interpretation via /api/poju/answer-interpretation only.",
        "It does not cover a full live Initial Decision Understanding, Blueprint init, Adaptive Question, Personal Analysis, or eight-page report model run.",
        "/api/poju/chat was stubbed because no Next server ran in the smoke process.",
        "Later cases hit OpenRouter HTTP 402 in_flight_budget_exhausted; those cases are not successes.",
        "C09b orchestrator replay uses a test hook after a real probe; the hook is not real-model validation of the orchestrator.",
        "C10b uses a rejected credential path to assert fail-closed behavior.",
        "The smoke printed in-memory KV because UPSTASH Redis REST was not used by this process; MemoryKv is not production Redis/Lua evidence.",
    ],
}
(EVID / "22-openrouter-smoke-redacted-summary.json").write_text(
    json.dumps(slim, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

commands = [
    {"command": "pnpm test:di2-feature-landing-main-path", "exit_code": 0, "exit_source": "pass_footer", "log": "01-test-di2-feature-landing-main-path.log", "result": "22 passed, 0 failed"},
    {"command": "pnpm test:m1-production-adaptive-question-loop", "exit_code": 0, "exit_source": "pass_footer", "log": "02-test-m1-production-adaptive-question-loop.log", "result": "PASS=188 FAIL=0"},
    {"command": "pnpm test:m1-r-fresh-session-main-loop", "exit_code": 0, "exit_source": "pass_footer", "log": "03-test-m1-r-fresh-session-main-loop.log", "result": "PASS=8 FAIL=0"},
    {"command": "pnpm test:m2-1-readiness-confirm-freeze", "exit_code": 0, "exit_source": "pass_footer", "log": "04-test-m2-1-readiness-confirm-freeze.log", "result": "19 passed, 0 failed"},
    {"command": "pnpm test:m2-2-freeze-report-binding", "exit_code": 0, "exit_source": "pass_footer", "log": "05-test-m2-2-freeze-report-binding.log", "result": "43 passed, 0 failed"},
    {"command": "pnpm test:m2-3-decision-blueprint", "exit_code": 0, "exit_source": "pass_footer", "log": "06-test-m2-3-decision-blueprint.log", "result": "18 passed, 0 failed"},
    {"command": "pnpm test:m2-4-r2-production-closure", "exit_code": 0, "exit_source": "pass_footer", "log": "07-test-m2-4-r2-production-closure.log", "result": "PASS=20 FAIL=0"},
    {"command": "pnpm test:m3-decision-report", "exit_code": 0, "exit_source": "pass_footer", "log": "08-test-m3-decision-report.log", "result": "27 passed, 0 failed"},
    {"command": "pnpm test:m4-decision-authority", "exit_code": 0, "exit_source": "pass_footer", "log": "09-test-m4-decision-authority.log", "result": "27 passed, 0 failed"},
    {"command": "pnpm test:m4-1-freeze-recovery", "exit_code": 0, "exit_source": "pass_footer", "log": "10-test-m4-1-freeze-recovery.log", "result": "10 passed, 0 failed"},
    {"command": "pnpm test:m5-di2-main-path", "exit_code": 0, "exit_source": "pass_footer", "log": "11-test-m5-di2-main-path.log", "result": "29 passed, 0 failed"},
    {"command": "pnpm test:m6-di2-full-lifecycle", "exit_code": 0, "exit_source": "pass_footer", "log": "12-test-m6-di2-full-lifecycle.log", "result": "7 passed, 0 failed"},
    {"command": "pnpm test:m8-di2-non-model-closure", "exit_code": 0, "exit_source": "captured", "log": "13-test-m8-di2-non-model-closure.log", "result": "deterministic non-model closure checks complete", "note": "Re-run after the implementation commit; process exit captured as 0."},
    {"command": "pnpm test:m8-r1-internal-turn-trust-boundary", "exit_code": 0, "exit_source": "pass_footer", "log": "14-test-m8-r1-internal-turn-trust-boundary.log", "result": "M8-R1 / M8-R1-FU1 / R2 / R2-R1 internal turn trust boundary checks complete"},
    {"command": "pnpm test:m9-server-authoritative-session", "exit_code": 0, "exit_source": "pass_footer", "log": "15-test-m9-server-authoritative-session.log", "result": "M9 server-authoritative session checks complete"},
    {"command": "pnpm test:m9-r1-session-authority-remediation", "exit_code": 0, "exit_source": "pass_footer", "log": "16-test-m9-r1-session-authority-remediation.log", "result": "M9-R1 session authority remediation checks complete"},
    {"command": "pnpm test:m9-r1-fu1-redis-lua-integrity-parity", "exit_code": 0, "exit_source": "pass_footer", "log": "17-test-m9-r1-fu1-redis-lua-integrity-parity.log", "result": "complete; REAL_REDIS_LUA_EXECUTED=no"},
    {"command": "pnpm test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding", "exit_code": 0, "exit_source": "pass_footer", "log": "18-test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.log", "result": "complete; REAL_REDIS_LUA_EXECUTED=no"},
    {"command": "pnpm test:m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding", "exit_code": 0, "exit_source": "pass_footer", "log": "19-test-m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding.log", "result": "complete; REAL_REDIS_LUA_EXECUTED=no"},
    {"command": "pnpm exec tsc --noEmit --pretty false", "exit_code": 0, "exit_source": "captured", "log": "20-tsc-noemit.log", "result": "empty stdout, exit 0", "note": "Re-run after the implementation commit; process exit captured as 0."},
    {"command": "pnpm build", "exit_code": 0, "exit_source": "captured", "log": "21-pnpm-build.log", "result": "production build exit 0", "note": "Re-run after the implementation commit. public/sw.js was rewritten to sha256 377530ca9931d2d0c30da03775ff993e063559e36900a2b380c27bdef4934c5c and restored byte-for-byte to 38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980. The file was left unstaged."},
    {"command": "pnpm smoke:m2-4-r2-openrouter", "exit_code": 0, "exit_source": "captured", "log": "22-openrouter-smoke-redacted-summary.json", "result": "process exit 0, expectations met 43/55", "note": "Process exit 0 is the smoke runner exit, not a claim that every case passed. C07, C08, and the C10a retry failed on OpenRouter HTTP 402 in_flight_budget_exhausted. Full unredacted local report remains uncommitted in temp/."},
]
(EVID / "command-exit-codes.json").write_text(json.dumps({
    "note": "exit_source=pass_footer means the original process exit was not separately captured; the log footer shows a clean pass and no failure. exit_source=captured means the process return code was recorded in this delivery pass.",
    "implementation_commit": "c72b81a7121ef2d18568ea86cfc310a4912c57b0",
    "implementation_parent": "ee9ef36617779f7c1d8a140d27f80772c6c009e0",
    "baseline_head_at_start": "ee9ef36617779f7c1d8a140d27f80772c6c009e0",
    "baseline_unchanged": True,
    "sw_js": {
        "required_pre_build_sha256": "38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980",
        "after_build_sha256": "377530ca9931d2d0c30da03775ff993e063559e36900a2b380c27bdef4934c5c",
        "after_restore_sha256": "38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980",
        "staged": False,
    },
    "commands": commands,
    "copied_logs": copied,
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("wrote logs and json", EVID)
for p in sorted(EVID.iterdir()):
    print(p.name, p.stat().st_size)
