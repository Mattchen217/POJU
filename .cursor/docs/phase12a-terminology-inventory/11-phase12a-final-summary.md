# Phase 12-A final summary

| Field | Value |
|---|---|
| Git SHA | `53fd647fdda4f8f0ef501c15fc920f1204eeeeee` |
| Branch | `main` |
| Extracted at | 2026-10-31T00:49:51.940Z |
| SSOT total terms | 281 |
| SSOT by ns | {"bazi":184,"qimen":54,"glyph":17,"zodiac":12,"ziwei":14} |
| Local term rows (incl. multi-source) | 2001 |
| Authoritative rows | 439 |
| Candidate scan rows | 1555 |
| Unique missing (all layers) | 884 |
| Unique missing (authoritative) | 65 |
| Cross-ns SSOT collisions | 3 |
| Coverage histogram (all rows) | {"dynamic_unresolved":7,"blocked":26,"mapped_complete":731,"missing":995,"ambiguous":15,"internal_only":227} |
| Coverage histogram (authoritative) | {"blocked":26,"mapped_complete":148,"missing":74,"internal_only":191} |
| Local rows by namespace | {"bazi":354,"engine_scan":1038,"qimen":275,"shared":29,"ziwei":305} |
| Ziwei SSOT on tip | 14 |
| Phase 11 new-36 on tip | 0/36 |
| Phase 11 branch ziwei count | 50 |

## Statistical口径
- **SSOT total**: rows in `POJU_TERMS` on this checkout.
- **Local rows**: one row per (namespace, traditional, source_file, source_symbol); same traditional may appear from multiple sources.
- **Authoritative**: closed-set, relation enum, runtime consts, pattern library, forbidden registry, Phase 9 FactPack inventory tokens.
- **Candidate**: comment-stripped Han string literals — require human verify; not asserted classical.
- **missing**: no ns-aware SSOT resolve hit; **not** auto-classified internal/blocked.
- **internal_only / blocked**: from disposition hints (ziwei runtime, forbidden registry, pattern policy) — not inferred from missing alone.

## Method
1. Full dump of `POJU_TERMS`.
2. Import closed-set / runtime / dictionary / forbidden / pattern library + Phase 9 inventory.
3. Comment-stripped candidate Han literal scan of calc-related dirs.
4. FactPack + output-path + sanitizer file audit from source reading.
5. Cross-check Phase 11 branch tip for 50 ziwei SSOT without merging.

## Not done (by design)
- No SSOT mutations
- No business code changes
- No PR for inventory
- No invented terms outside code
- No 补词 / test publish

## Next phase inputs
Use `06` authoritative missing + `09` matrix + `05` collisions for product triage before Phase 12-B.
