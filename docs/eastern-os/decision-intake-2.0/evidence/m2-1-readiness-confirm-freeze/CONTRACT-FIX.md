# M2.1 contract fix — fact promotion REQUEST CHANGES

**Branch:** `feat/m1-r-fresh-session-main-loop`  
**Review baseline:** `924a81948ab97c35bb82c46c6c14af52117f744e`  
**Prior tip (type fix):** `3c8b16a3b3c82765e892fd8f605d2413ec845f58`  
**Date:** 2026-11-08 (America/Chicago)

## What changed

`lib/poju/decision-intake/confirm-and-freeze.ts`

1. **Events first, then derive** — Confirmation Events are appended (all-or-nothing) before any status/`user_confirmed` mutation.
2. **`user_estimate`** — left `unverified` + `user_estimate`; never rewritten to `confirmed`/`user_asserted`.
3. **`user_asserted` + `unverified`** — becomes `confirmed` only when a valid Confirmation Event exists (provenance: source turn + confirm turn).
4. **`independently_verified` / `unknown` / `declined` / `not_applicable`** — never converted via user confirm.
5. **`user_confirmed`** — always via `deriveUserConfirmedFromEvents` (never hardcoded `true`).
6. **Constraints** — same source + event rules.
7. **Fail-closed** — missing `source_turn_id` or event-create/provenance failure returns original session with `promote_failed` (no partial promotions). Persist failure likewise rolls back to previous session. Version bump only when events/facts actually change (repeat confirm does not duplicate events/versions).

## Tests

`pnpm test:m2-1-readiness-confirm-freeze` → **13/13**

Contract cases: M21-C1…C8 + production E2E M21-01…04 + static wire check.

Also: `pnpm test:m1-r-fresh-session-main-loop` **8/8**; `tsc --noEmit` **PASS**.

## Vercel diagnosis

| Commit | Combined Vercel status | Root cause |
|--------|------------------------|------------|
| `924a8194` (M2.1 feature) | **failure** | Next.js build type error: `POJUMessage.meta` missing `m21_*` fields used by confirm/freeze assistant messages (`BUILD_UTILS_SPAWN_1` / `pnpm run build`). **Caused by M2.1 code.** |
| `3c8b16a3` (type fix) | **success** (`Deployment has completed`) | Same-branch meta typing fix; deployment recovered. |

Vercel API log fetch for team `yangwu11214-1009s-projects` was 403 from this connector; diagnosis uses GitHub combined status + the build error Max pasted (matches the type gap fixed in `3c8b16a3`).

## Honest gaps (unchanged scope)

- No expand of S0–S9 / M2.2
- Answer Interpretation / Qgen still v1 simplified
- Personal Pattern may remain `unavailable`
- Persist/Freeze failure unit injection beyond provenance fail-closed is covered by code paths + C7/C8; full mock of `commitDecisionContextChange` not added

## Forbidden

No main / no PR / no merge / no deploy / no self-PASS.
