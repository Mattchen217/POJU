# M2.3-R1 — Preserve Full DDR Investigation Scope

**Not a design proposal. Not self-PASS. Awaiting independent Max review.**

| Field | Value |
|---|---|
| Branch | `feat/m1-r-fresh-session-main-loop` |
| Parent SHA | `1068d0184217f74b5a3d02c2b8aaab2bce99ad84` |
| HEAD SHA | 510ce71c28eed0ee638cf065655444251a1f4967 |
| Mode | Minimal production fix on same branch |
| Tip / promote | Vercel tip only — **no promote / no PR / no merge / no deploy** |

---

## Problem

M2.3 tip deferred P1/P2-only DIRs from the first DC seed wave by also omitting them from `Blueprint.dir_ids`. Report obligations for selected P1/P2 DDRs then had no investigable DIR path.

## Fix (scope vs seed vs scheduling)

| Layer | Meaning | Implementation |
|---|---|---|
| **Blueprint scope** | Complete formal investigation scope | `buildCatalogBlueprintScope` includes **every** legal `required_dir_ids` from **every** selected DDR (P0, P1, P2) + topic pack → `dir_ids` / `directions` |
| **DC initial seed** | First-wave activated rows on DC | `initial_seed_dir_ids` = P0 DDR required + topic pack only; `ensureDecisionBlueprint` merges only seed defs into DC |
| **AQE scheduling** | When to investigate | P0-first via gate rank; `activateNextBlueprintPriorityBand` pulls unfinished P1 (then P2) from Blueprint onto DC as `unknown` after higher band completes |

Uninvestigated P1/P2 are never auto-marked `known` / `n_a`. Understanding treats Blueprint-scoped DIRs missing from DC as open needs (Readiness safety net).

## Files

- `lib/poju/decision-intake/blueprint.ts` — full scope; `initial_seed_dir_ids`; `activateNextBlueprintPriorityBand`
- `lib/poju/decision-intake/types.ts` — `initial_seed_dir_ids?` on DecisionBlueprint
- `lib/poju/decision-intake/adaptive-turn.ts` — activate before plan candidates
- `lib/poju/decision-intake/understanding-state.ts` — deferred Blueprint DIRs remain open needs
- `lib/poju/decision-context/production-intake-ask.ts` — activate before candidate build
- `lib/poju/decision-intake/index.ts` — export activator
- `scripts/test-m2-3-decision-blueprint.ts` — M2.3-R1 production-entry cases

## Observed evidence (M2.3-R1)

Career question via `createPOJUSession` + `handleUserMessage`:

- `scope=15` `seed=13` (deferred P1: `DIR-VALIDATION-CAPACITY`, `DIR-OPT-IRREV`)
- First ask `gate_class=P0`
- After P0 marked known → activator puts P1 onto DC as `unknown` → AQE selects P1 (`p1Cands=2`)
- Uninvestigated P1 absent from `understood`; still listed in needs

## Tests (real exit codes)

| Command | Exit |
|---|---|
| `pnpm test:m2-3-decision-blueprint` | 0 (7/7 incl. R1) |
| `pnpm test:m1-r-fresh-session-main-loop` | 0 (8/8) |
| `pnpm test:m1-production-adaptive-question-loop` | 0 (16/16) |
| `pnpm test:m2-1-readiness-confirm-freeze` | 0 (19/19) |
| `pnpm test:m2-2-freeze-report-binding` | 0 (43/43) |
| `pnpm test:decision-context-phase2` | 0 (9 passed) |
| `pnpm exec next typegen` | 0 |
| `pnpm exec tsc --noEmit` | 0 |
| `pnpm build` | 0 |

## Limitations / UNTESTED

- P0→P1→P2 band advancement in R1 test marks DIR `known` directly (simulates completion); multi-turn natural-language fill of every P0 role is not re-driven end-to-end here (covered partially by M2.1 answer loops).
- Deterministic topic classify unchanged (non-generative).
- P2-only unique DIRs are rare in v1.1 catalog (`DIR-TIMING-WINDOW` is also P0 via DDR-01-HOLD); band API still exercised after P1 completion.
- No PR / merge / deploy / self-PASS.

## Not self-PASS

Awaiting independent Max review.
