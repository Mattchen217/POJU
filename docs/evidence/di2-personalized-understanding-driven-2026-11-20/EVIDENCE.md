# DI2 Personalized Understanding-Driven — Evidence (2026-11-20)

**Branch:** `feat/di2-personalized-understanding-driven`  
**Parent / baseline SHA:** `31cade94efcf474b2cfdafefd96bc6da334b1445`  
**Implementation SHA:** `5fdf1fd9`  
**Scope:** Main-path wiring for Personalized Understanding-Driven Adaptive Investigation (not a product PASS claim).

## Commands

| Command | Exit |
|---|---|
| `pnpm exec tsc --noEmit` (filtered DI2/agent files clean) | `0` |
| `pnpm exec tsx scripts/test-di2-personalized-understanding-path.ts` | `0` |
| `pnpm exec tsx scripts/test-di2-personalized-understanding-openrouter.ts` | `0` |

## Live OpenRouter

- Log: `logs/openrouter-understanding-smoke.log`
- Provider: Sail Research
- Model: `deepseek/deepseek-v4-pro-0813`
- Latency: ~12810 ms
- Result markers: `ok: true`, narrative is not `Decision:` stats summary, `response_text` present, exactly 3 suggested replies, `LIVE_SMOKE_OK`

## What this proves

1. Understanding model path calls real OpenRouter and returns structured narrative + chat reply + 3 suggested replies.
2. Fresh readiness progress no longer inflates empty constraints/conflicts (unit: 0%).
3. Model narrative/question overrides template stats summary (unit).
4. UI need labels strip `missing_roles:` debug prefixes (unit).

## Known limits (not claimed done)

- Full multi-turn Fresh Session e2e with two real Profiles still pending.
- Suggested-reply click path through `/api/poju/chat` still pending in this evidence pack.
- ProfileStructured coverage in the live smoke used a null matrix (profile_hash null) — proves model path, not full chart personalization yet.

**Do not treat this document as product acceptance PASS.**
