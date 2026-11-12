# M5-R1-FU4 · Completed report delivery authorization evidence

Evidence for independent review only. This record does not declare FU4, M5-R1, or Decision Intake 2.0 accepted.

## Baseline and commits

- Branch: `feat/m1-r-fresh-session-main-loop`
- Remote baseline before implementation: `8719aec51c9cbdabe5011187df30c2e10d369e7c`
- FU4 implementation commit already present at task start: `2114c0b7c2e29a9934ccaff68163c8460f5e2d6f`
- FU4 mutation test follow-up: `ae37b1165bdf2d5da47d68273f39c33b269988b1`
- No PR, merge, rebase, deployment, or force-push was performed.

## FU4-specific verification

Command: `pnpm test:m5-r1-fu4`

- Result: 8 passed, 0 failed (FU4-01 through FU4-08).
- Runtime used process-memory `MemoryKv`; missing Upstash variables were reported by the test harness.
- The first sandbox launch failed before tests started (`uv_os_get_passwd` / `ENOMEM`); the same command was retried with elevated execution and completed successfully.

Command: `pnpm exec tsx scripts/test-m5-r1-fu4-mutations.ts`

- Result: script exit 0; all four deliberately introduced mutants were killed by the FU4 suite.
- Mutations: remove completed-status authorization check; ignore per-job revocation; ignore job delivery `charge_ref` binding; require the expiring execution grant to serve a historical report.
- The harness restores both production source files in `finally` after every mutant. The production source files were clean after the run.

## Regression and build evidence

The following recorded run is at implementation HEAD `2114c0b7` (the subsequent `ae37b116` commit adds only the mutation harness):

- `test:m5-r1-authorization`: 49 passed, 0 failed; FU1/FU2/FU3/FU4 subsets: 5/10/13/8 passed, 0 failed each.
- M5, M4.1, M4, M3, M2.1–M2.4, M1-R: all recorded successful.
- intake-r6 four suites: three successful; the S7 lifecycle suite retains its three known baseline failures below.
- `tsc --noEmit` and the M5/M5-R1 test-file TypeScript check: exit 0.
- `pnpm build`: completed successfully with warnings, including warnings from `app/api/ops/delivery-lab/create/route.ts`.

The retained S7 failures are:

1. Call B maps Agenda to DIR and keeps fingerprint.
2. Collecting appends unverified fact and never auto-confirms.
3. Freeze remains blocked without Stage3 sufficiency (S5 invariant).

These failures were not changed or masked by FU4.

## Validation boundary

- KV used by these runs was process-memory `MemoryKv`; Upstash Redis and its Lua/CAS execution were not exercised.
- The pass ledger was a stub; Supabase and real debit RPC behavior were not exercised.
- No serverless deployment/runtime was exercised.
- No real OpenRouter request, full E2E, browser test, or live route server was run, consistent with the task limits.
