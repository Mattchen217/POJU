const fs = require("fs");

const finalDoc = `# PHASE3-FINAL-ACCEPTANCE

> Phase 3 Final Acceptance package (Max §10.2).  
> Branch: \`feat/decision-context-phase1\` · PR #32  
> Local evidence date: 2026-11-03 (America/Chicago)  
> **Conclusion: READY_FOR_PASS_PENDING_CI** (local mandatory suites + tsc green; Actions PENDING_PUSH)

Do **not** treat this document as Final PASS until GitHub Actions is green on the pushed SHA.

## 1. Final HEAD SHA (local)

\`d3681bb91b808305b53cdd21cdf1991e125601c9\` — \`phase3 rem: restore fail-closed on blob load\`

Ahead of \`origin/feat/decision-context-phase1\`: **10** commits (unpushed).

## 2. Full diff vs baseline \`96cf819d26bbbb7a1eb174848fb0366c1eebfe9f\`

Reproduce:

\`\`\`
git fetch origin
git log --oneline 96cf819d26bbbb7a1eb174848fb0366c1eebfe9f..HEAD
git diff --stat 96cf819d26bbbb7a1eb174848fb0366c1eebfe9f..HEAD
git diff 96cf819d26bbbb7a1eb174848fb0366c1eebfe9f..HEAD
\`\`\`

Summary at acceptance HEAD: **61 files**, +16674 / −321 (includes Phase 3 S0–S5 product + remediations + tests + docs).

Remediation-only commits since \`b17d583654b2f0156896077c681f53642f8981af\`:

| SHA | Subject |
|-----|---------|
| 39469ed5 | phase3 rem: P3-70 real encrypt failure injection |
| 0d30eac1 | phase3 rem: P3-71 real Dexie mid-txn abort rollback |
| ae989533 | phase3 rem: P3-91 Path A multi-table atomic abort |
| c8b102e8 | phase3 rem: P3-99/100 generation consistency hard guards |
| d4862046 | phase3 rem: P3-112 confirmation source provenance |
| 818b55b0 | phase3 rem: Job unique create and index recovery |
| e0a56539 | phase3 rem: C1 metadata-blob write protocol |
| 4748c918 | phase3 rem: C5 vault rename decrypt-fail index |
| 70a98d86 | phase3 rem: J4 shared job store isolation |
| d3681bb9 | phase3 rem: restore fail-closed on blob load |

## 3. Modified file list (vs baseline)

See \`git diff --name-only 96cf819d..HEAD\` (61 paths). Primary rem/runtime surfaces:

- Session CAS: \`lib/poju/session-mutation.ts\`, \`lib/poju/session-manager.ts\`, \`lib/poju/cycle-db-sync.ts\`
- Generation: \`lib/poju/generation/*\`, consistency + commit paths
- Confirmation: \`lib/poju/decision-context/confirmation-event.ts\`
- Job store: \`lib/poju/xhigh-job-store.ts\`, \`xhigh-job-types.ts\`; resume guards in breakthrough-core/agenda/synthesis routes
- Vault/C5: \`lib/archive/poju-session-vault.ts\`, \`WorkspaceSidebar.tsx\`
- Restore: \`lib/poju/v4-lifecycle.ts\`
- Tests: \`scripts/test-decision-context-phase3-{unit,idb,e2e,job-idempotency}.ts\`
- Docs: \`docs/phase3/PHASE3-*\` incl. \`PHASE3-J4-JOB-STORE-ISOLATION.md\`
- CI: \`.github/workflows/phase3-decision-context.yml\`, \`package.json\` scripts

## 4. New / changed tests (remediations + acceptance)

| IDs | Suite | Topic |
|-----|-------|-------|
| P3-70, P3-71, P3-91 | idb | encrypt fail / mid-txn abort / staged Registry abort |
| P3-99, P3-100, P3-112 | e2e (+ consistency unit paths) | Gen consistency; confirmation provenance |
| P3-96, P3-131–135, P3-144–147 | job-idempotency | Job NX/create/recovery + J4 isolation |
| P3-136–138 | idb | C1 metadata↔blob unified write |
| P3-139–143 | idb | C5 rename fail-closed |
| P3-148 | idb | restore fail-closed on blob load |

Full index: \`docs/phase3/PHASE3-S5-P3-TEST-INDEX.md\`.

## 5. Core blocker set (26 IDs) — local

Command (PowerShell-safe; avoid npm script \`&&\`):

\`\`\`
$env:PHASE3_CORE_ONLY="1"
node ./node_modules/tsx/dist/cli.mjs scripts/test-decision-context-phase3-unit.ts --core
node ./node_modules/tsx/dist/cli.mjs scripts/test-decision-context-phase3-idb.ts --core
node ./node_modules/tsx/dist/cli.mjs scripts/test-decision-context-phase3-e2e.ts --core
\`\`\`

| Layer | PASS | FAIL | SKIP | Ran |
|-------|------|------|------|-----|
| unit --core | 18 | 0 | 17 | 18 |
| idb --core | 6 | 0 | 15 | 6 |
| e2e --core | 2 | 0 | 21 | 2 |
| **Core IDs** | **26** | **0** | — | **26** |

Core ID set: P3-61,62,63,67,68,69,72,73,74,78,80,86,87,94,98,101,107,110,113,116,118,121,125,128,129,130 — each observed \`PASS\` in core logs.

## 6. Full L1 / L2 / L3 + Job — local

| Suite | Command | PASS | FAIL | SKIP |
|-------|---------|------|------|------|
| L1 unit | \`pnpm test:decision-context-phase3-unit\` / \`tsx scripts/test-decision-context-phase3-unit.ts\` | 35 | 0 | 0 |
| L2 idb | \`pnpm test:decision-context-phase3-idb\` | 21 | 0 | 0 |
| L3 e2e | \`pnpm test:decision-context-phase3-e2e\` | 23 | 0 | 0 |
| Job | \`pnpm test:decision-context-phase3-job\` | 10 | 0 | 0 |

Remediation spot-checks observed PASS: P3-70,71,91,99,100,112,96,131–138,139–148,144–147.

## 7. TypeScript (match CI)

\`\`\`
pnpm exec next typegen   # exit 0 — Types generated successfully
pnpm exec tsc --noEmit   # exit 0 — clean
\`\`\`

## 8. GitHub Actions

**PENDING_PUSH** — no remote run URL/SHA until parent pushes \`feat/decision-context-phase1\`.  
Workflow file present: \`.github/workflows/phase3-decision-context.yml\`.

Suggested push (parent only, after review):

\`\`\`
git push -u origin feat/decision-context-phase1
\`\`\`

Then record Actions run URL + SHA here / in PR before Final PASS.

## 9. C1 / C5 / J4 final status

| Item | Status | Honest claim |
|------|--------|--------------|
| **C1** | CLOSED | Row-atomic renewals-in-CAS (\`append_renewal\`); not distributed txn |
| **C5** | CLOSED | Rename decrypt/load fail → fail-closed; no wrong plaintext index authority |
| **J4** | CLOSED | Phase+session keys + strict \`generation_type\` when supplied; resume phase guards; see \`PHASE3-J4-JOB-STORE-ISOLATION.md\` |
| Restore leftover | CLOSED | Fail-closed before status/renewals/archive delete (P3-148) |

## 10. Unresolved risks / known limits

1. \`getXhighJob(job_id)\` remains unscoped; callers must check \`job.phase\` (resume/FD guarded; other readers must not assume).
2. Lab shares phase namespace with product segment2/synthesis when using the same \`session_id\` — isolation via optional Generation identity fields + \`jobMatchesIdentity\`, not a separate Lab KV namespace (no Contract fifth phase).
3. Restore: status flip + archive delete still **after** CAS; if that post-step fails mid-flight, blob may already be extended while row still \`archived\` and archive retained → retryable; not wrong plaintext index authority.
4. Product Call A/B UI / Job wiring Hold; Stage4 / Page / Lab SoT redesign Holds — out of Phase 3 rem scope.
5. This package is **READY_FOR_PASS_PENDING_CI**, not Final PASS.

## 11. Contract vs Mapping compliance (itemization)

| Topic | Contract | Mapping | Local status |
|-------|----------|---------|--------------|
| Session CAS single write authority | §7 | §3 | Unified \`casWritePOJUSession\` / mutate; no second blob writer introduced by rem |
| Encrypt outside Dexie txn | §7.5 | — | Preserved; P3-70 proves encrypt fail leaves no write |
| Mid-txn abort | §7 / §18.1 | — | P3-71 / P3-91 Dexie abort |
| Generation identity / Path A·B·C | §6 / §18.2–3 | §2 | Consistency hard-fail P3-99/100; Job NX + recovery ITEM6 |
| Confirmation provenance | §11 / §18 | — | P3-112 |
| Job client_task recovery | §6.3 / §22 | §2.4 | Implemented; J4 isolation documented |
| C1 extend metadata↔blob | Max rem §7 | S0 C1 | Closed with honest row-atomic claim |
| C5 vault rename index | Max rem §8 | S0 C5 | Fail-closed |
| J4 shared store | Max rem §9 | S0 J4 | Closed with known limits §10 |
| No Contract text invented | — | — | Rem chose fail-closed / fold-into-existing-CAS / phase guards only |

## Verdict

**READY_FOR_PASS_PENDING_CI** — all mandatory local suites + typegen + tsc green at \`d3681bb9…\`.  
Await parent push + Actions green before Final PASS. No merge/prod.
`;

fs.writeFileSync("docs/phase3/PHASE3-FINAL-ACCEPTANCE.md", finalDoc);

const s5 = `# PHASE3 S5 Writeup — Verification & Delivery

**Date:** 2026-11-03 (America/Chicago)  
**Branch:** \`feat/decision-context-phase1\`  
**PR:** #32  
**Acceptance HEAD (local):** \`d3681bb91b808305b53cdd21cdf1991e125601c9\`  
**Baseline:** \`96cf819d26bbbb7a1eb174848fb0366c1eebfe9f\`  
**Max prior:** S5 PASS_WITH_GAPS → remediations → Final Acceptance package

## Deliverables

| Item | Path |
|---|---|
| L1 unit | \`scripts/test-decision-context-phase3-unit.ts\` |
| L2 IDB | \`scripts/test-decision-context-phase3-idb.ts\` |
| L3 e2e | \`scripts/test-decision-context-phase3-e2e.ts\` |
| Job idempotency | \`scripts/test-decision-context-phase3-job-idempotency.ts\` |
| Test index | \`docs/phase3/PHASE3-S5-P3-TEST-INDEX.md\` |
| Final acceptance | \`docs/phase3/PHASE3-FINAL-ACCEPTANCE.md\` |
| J4 isolation | \`docs/phase3/PHASE3-J4-JOB-STORE-ISOLATION.md\` |
| CI workflow | \`.github/workflows/phase3-decision-context.yml\` |

## Commands (local acceptance evidence)

\`\`\`
# Core 26 (PowerShell: set CORE then run each; do not rely on npm &&)
$env:PHASE3_CORE_ONLY="1"
node ./node_modules/tsx/dist/cli.mjs scripts/test-decision-context-phase3-unit.ts --core
node ./node_modules/tsx/dist/cli.mjs scripts/test-decision-context-phase3-idb.ts --core
node ./node_modules/tsx/dist/cli.mjs scripts/test-decision-context-phase3-e2e.ts --core

Remove-Item Env:PHASE3_CORE_ONLY -ErrorAction SilentlyContinue
pnpm test:decision-context-phase3-unit
pnpm test:decision-context-phase3-idb
pnpm test:decision-context-phase3-e2e
pnpm test:decision-context-phase3-job
pnpm exec next typegen
pnpm exec tsc --noEmit
\`\`\`

## Results (this acceptance package)

| Suite | PASS | FAIL | SKIP |
|---|---|---|---|
| Core 26 IDs | 26 | 0 | — |
| L1 unit | 35 | 0 | 0 |
| L2 idb | 21 | 0 | 0 |
| L3 e2e | 23 | 0 | 0 |
| Job | 10 | 0 | 0 |
| next typegen | OK | — | — |
| tsc --noEmit | 0 errors | — | — |

## Remediation status (former PASS_WITH_GAPS items)

| ID | Status | Notes |
|----|--------|-------|
| P3-70 | CLOSED | Real encrypt inject; no rev/blob change; retry OK |
| P3-71 | CLOSED | Real Dexie mid-txn abort after clear; full rollback |
| P3-91 | CLOSED | Staged Registry then fail before Binding; abort |
| P3-99/100 | CLOSED | Generation consistency hard-fail |
| P3-112 | CLOSED | Confirmation requires real user-message provenance |
| ITEM6 Job | CLOSED | SET NX + latest candidate recovery |
| C1 | CLOSED | Renewals folded into CAS row update (honest row-atomic) |
| C5 | CLOSED | Rename decrypt-fail fail-closed |
| J4 | CLOSED | Shared store isolation + resume phase guards |
| Restore leftover | CLOSED | Fail-closed on blob load (P3-148) |

## CI

Workflow: \`.github/workflows/phase3-decision-context.yml\`.  
**Remote Actions:** PENDING_PUSH (do not claim Final PASS until green on pushed SHA).

## Known limits (honest — not PASS_WITH_GAPS re-label)

- \`getXhighJob(job_id)\` unscoped; callers must verify phase.
- Lab shares phase namespace with product when same \`session_id\`.
- Restore post-CAS status/archive step can leave retryable archived+extended mid-flight if interrupted after CAS.
- Product Call A/B UI Hold; Stage4/Page/Lab redesign Holds remain out of scope.

## Ready

**READY_FOR_PASS_PENDING_CI** — local mandatory evidence green. No merge/deploy/push performed in this package.
`;

fs.writeFileSync("docs/phase3/PHASE3-S5-WRITEUP.md", s5);

// Light touch S2/S3/S4 carry-forward lines if still claiming C1/C5/J4 open
for (const [file, from, to] of [
  [
    "docs/phase3/PHASE3-S2-WRITEUP.md",
    "- **J4** — flagged shared store; same recovery API; no Lab-specific policy.",
    "- **J4** — rem CLOSED (see PHASE3-J4-JOB-STORE-ISOLATION.md / FINAL-ACCEPTANCE).",
  ],
  [
    "docs/phase3/PHASE3-S4-WRITEUP.md",
    "Remaining S4 gaps unchanged: C1 extend two-phase; C5 vault rename plaintext; J4 shared xhigh; product Call A/B UI Hold; Stage4/Page/Lab Holds.",
    "S4 gaps rem CLOSED: C1/C5/J4 (see PHASE3-FINAL-ACCEPTANCE.md). Product Call A/B UI Hold; Stage4/Page/Lab Holds remain.",
  ],
]) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(from)) {
    s = s.replace(from, to);
    fs.writeFileSync(file, s);
    console.log("patched", file);
  } else {
    console.log("skip stale line", file);
  }
}

// Ensure S5 index header notes rem acceptance
{
  const p = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("Acceptance HEAD")) {
    s = s.replace(
      "**HEAD baseline for S5 work:**",
      "**Acceptance HEAD (local rem package):** `d3681bb91b808305b53cdd21cdf1991e125601c9`  \n**HEAD baseline for S5 work:**",
    );
    fs.writeFileSync(p, s);
    console.log("patched S5 index header");
  }
}

console.log("acceptance docs written");
