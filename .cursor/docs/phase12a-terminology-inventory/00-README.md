# Phase 12-A · Terminology inventory

**Nature:** documentation / data extraction only. **No business code changes.**

| | |
|---|---|
| Git SHA | `53fd647fdda4f8f0ef501c15fc920f1204eeeeee` |
| Branch | `main` |
| Extracted | 2026-10-31T00:49:52.055Z |

## Scope checked
- `lib/glossary/**` (SSOT, resolve, forbidden, closed-set, sanitize)
- `lib/calculations/**`, `lib/calendar/**`
- `lib/ziwei/**`, `lib/qimen/**`
- `lib/llm/pro/delivery/**` FactPack + slice + judgment
- `lib/companion/**` reminder/day HTML
- `lib/poju/**` baseline/delivery HTML entrypoints
- `lib/compatibility/calculations/**`

## Out of scope / thin
- `legacy/**` Syncro/match (not primary POJU delivery) — not fully enumerated
- Production user data / live DB
- Runtime enumeration of all 干支 relation strings

## Phase 9–11 note
- Phase 9 inventory JSON (path: .cursor/docs/terms-phase9-ziwei-inventory.json) ingested as authoritative ziwei observations.
- Phase 10 isolation is on this main tip.
- Phase 11 (+36 ziwei → total 50) lives on feat/phase11-ziwei-terminology-completion — tip ziwei count 14; branch count 50; new-36 present 0/36.

## Layers in 02 / 09
- **Authoritative** value_types: enum_closed, relation_enum, runtime_const, pattern_library, forbidden_registry, phase9_inventory
- **Candidate** value_type: candidate_literal (needs human triage)
- **Dynamic** value_type: dynamic (templates only)

## Files
See 01–11 in this directory. Regenerate via:

    pnpm exec tsx .cursor/docs/phase12a-terminology-inventory/_tools/extract-phase12a.ts
