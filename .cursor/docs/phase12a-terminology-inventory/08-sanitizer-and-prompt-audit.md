# Sanitizer and prompt audit

## Core APIs
| API | file | notes |
|---|---|---|
| resolvePojuTerm | lib/glossary/term-resolve.ts | namespace-aware resolve |
| pojuTermBySlug | lib/glossary/pojulife-terms.ts | slug authority for ⟦t:⟧ |
| pojuTermByTraditional | lib/glossary/pojulife-terms.ts | **deprecated** without ns (warns) |
| buildTermContextForFacts | lib/glossary/term-context-for-facts.ts | prompt fact context |
| ziweiTokenDisposition | lib/ziwei/token-disposition.ts | internal_only / unknown_blocked |
| softZiweiLabel / sanitizeZiweiLeaksInPromptText | lib/ziwei/soft-zfp-labels.ts, sanitize-prompt-ziwei-leaks.ts | Phase 10 |
| applyNsAwareSurfacePolicy | lib/glossary/ns-aware-surface-sanitize.ts | P1 dual-ns |
| sanitizeExportSurface / sanitizePlainExport | lib/glossary/sanitize-export-surface.ts | export exits |
| resolveShenshaDisposition | lib/glossary/shensha-disposition.ts | unknown_blocked; no raw fallback |
| TERM_FORBIDDEN_REGISTRY | lib/glossary/term-forbidden-registry.ts | bazi redlines |
| term-marking / compliance-terms | lib/llm/sanitize/* | ⟦t:⟧ |
| qimen display-policy | lib/qimen/display-policy.ts | soft maps |
| audit-output / banned-terms | lib/llm/compliance/* | post-hoc leak scan |

## Call sites still using pojuTermByTraditional (grep)
| file | risk |
|---|---|
| lib/llm/sanitize/term-marking.ts | some no-ns + bazi-fallback chains |
| lib/base-analysis/core-judgments.ts | bazi then no-ns fallback |
| lib/glossary/term-glossary-closed.ts | bazi then no-ns |
| lib/glossary/term-glossary.ts | no-ns first |
| lib/llm/compliance/banned-terms.ts | bazi then no-ns |
| lib/poju/build-matrix-fact-panel.ts | **no-ns** on ten_god |
| lib/poju/matrix-term-labels.ts | **no-ns** |
| lib/poju/shensha-alias.ts | bazi then no-ns |

## Findings (report-only — no fixes in Phase 12-A)
1. **No-ns lookup still live** in matrix / glossary / term-marking paths → cross-ns first-match risk for dual-ns hans (七杀/文昌/流年/空亡/白虎).
2. **Dual-ns 空亡/白虎**: P1 confirmedTerms + sourceId; bare text fail-closed on ns-aware surfaces; paths that skip confirmedTerms remain risky.
3. **Ziwei pattern names**: isolated via hit_id in judgment prompts; raw FactPack retains classical names; Phase 10 scrub on free-text.
4. **CFP (bazi)** intentionally keeps traditional in judgment feed; user-visible body contract is zero-classical.
5. **Export surfaces** unified; companion/reminder HTML accept optional confirmedTerms — **callers must wire** or dual-ns soft may not apply.
6. **Unknown ziwei** fail-closed (empty soft / blocked) — no traditional fallback (shensha disposition same philosophy).
7. **qm_* markers**: P1 — slug authority only; unknown qm_* no traditional-fallback resolve.
8. **FactPack vs projection**: raw traditional retained in packs; safety projection (soft/hit_id) can drop classical surface while mechanism remains for model — product must accept that semantic loss is intentional for user surfaces.
9. **Path skew**: `lib/poju/**` HTML builders do not all call `sanitizeExportSurface` directly (grep empty under lib/poju for that symbol) — some rely on upstream marked HTML / companion wrappers; verify each exit in later phase.
10. Do **not** treat all traditional as forbidden — banned-terms/audit is leak detection complementary to SSOT soft map.

## Prompt builders checked
- oriental-prompt-context(+v6)
- base-analysis-stream-prompt
- book-judgment/generate feedBlock
- page-slice-feed / fill-prompt / deep-evidence-*
- companion-daily-prompt (decision-anchor five slots)
