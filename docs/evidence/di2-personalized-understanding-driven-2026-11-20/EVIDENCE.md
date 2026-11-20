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
| `pnpm exec tsx scripts/test-di2-personalized-understanding-full-path.ts` | `0` |
| `pnpm exec tsx scripts/test-di2-personalized-understanding-auth-chat-profile.ts` | `0` |

## Live OpenRouter

### Smoke (no matrix)

- Log: `logs/openrouter-understanding-smoke.log`
- Provider: Sail Research / `deepseek/deepseek-v4-pro-0813` ~12.8s
- Markers: `LIVE_SMOKE_OK`

### Full path (real ProfileStructured)

- Log: `logs/full-path-run.log` + `logs/full-path-evidence.json`
- Two local charts (1990-F / 1985-M): distinct `day_master` + `profile_hash`; field coverage includes four_pillars / da_yun / ziwei
- 3× `handleUserMessage` turns: `model_response_text` + exactly 3 `options`; Understanding hook saw non-null profile each turn
- Live OpenRouter with matrix: non-null `profile_hash` + structured day_master; narrative not `Decision:` stats; 3 suggested replies
- Markers: `FULL_PATH_OK`

## What this proves

1. Full local ProfileStructured can enter every Understanding model turn (with rebuild-from-birth if structured stripped).
2. Ordinary adaptive turns return model chat + 3 suggested replies (not template Q / not generic chat LLM).
3. Fresh readiness empty-set inflation fixed; need labels sanitized.
4. Code still owns Blueprint/DC/budget; incomplete birth+missing chart fails closed (`profile_incomplete`).

### Auth-chat Profile handoff (no preloaded matrix)

- Log: `logs/auth-chat-profile-handoff.log` + `logs/auth-chat-profile-handoff.json`
- Session starts with `selected_stored_profile_id` + `server_invoke.profile` and **no** `matrix_payload`
- `ensureMatrixPayloadOnSession` builds local ProfileStructured before M1
- Understanding hook receives non-null `profile_hash` + day_master; assistant has 3 options; `sessionOut.matrix_payload` retained
- Markers: `AUTH_CHAT_PROFILE_OK`

## Known limits (not claimed product PASS)

- Live Vercel browser deploy not exercised in this pack.
- Independent review acceptance still required.

**Do not treat this document as product acceptance PASS.**
