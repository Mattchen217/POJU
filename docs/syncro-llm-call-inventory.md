# callLLM `thinking_effort` / `max_tokens` inventory

Generated for Syncro failure diagnosis (P0.1). Adjusted targets:

| Use case | thinking_effort | max_tokens |
|----------|-----------------|------------|
| base_analysis | medium | 8000 |
| syncro_per_batch | low | 6000 |
| match_report | medium | 10000 |

## Current call sites (`lib/llm/` + API routes)

| File | thinking_effort | max_tokens |
|------|-----------------|------------|
| `app/api/profile/base-analysis/route.ts` | medium (via `baseAnalysisReasoningEffort`) | 8000 |
| `app/api/profile/base-analysis/stream/route.ts` | medium | 8000 |
| `lib/llm/services/syncro-reading-service.ts` (batch) | low (retry: low) | 6000 |
| `lib/llm/services/match-analysis-service.ts` (on-server base) | medium | 10000 |
| `lib/llm/services/match-analysis-service.ts` (report) | medium | 10000 |
| `lib/llm/services/glyph-reading-service.ts` | high | 10000 |
| `lib/llm/poju-llm.ts` | router default | 4096 |
| `lib/llm/phases/*` | phase transport defaults | 800–3600 |

OpenRouter HTTP fetch: **90s** `AbortSignal` in `openrouter-shared.ts` (`llm_batch_timeout` on abort).
