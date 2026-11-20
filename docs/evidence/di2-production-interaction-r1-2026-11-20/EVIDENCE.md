# DI2 Production Interaction Corrections R1 — Evidence

Date: 2026-11-20 (America/Chicago)  
Parent SHA: `6427903331a00d2a613f06cba87a14d6552b5bc8`  
Implementation SHA: `39a5b583b0243ad322cd86bff738984f4ea823f5`  
Branch: `feat/di2-production-interaction-r1`  
**Not product PASS. Not merged. Not deployed.**

## What was wrong (production screenshot)

1. Welcome text appeared below user/assistant bubbles.
2. Understanding dock sat in `composerTop`, crowding out 3 suggested replies.
3. Already Understood missing; readiness showed misleading 0%.
4. Code preselected `DIR-BIZ-MODEL`; model was forced to match.
5. Investigation needs mixed internal codes; scope not tied to 8-page report purpose.

## Fixes (implementation)

| Area | Change |
|---|---|
| Welcome | Always pin at messages[0]; render in `scrollHeader`, not chat stream |
| Layout | Understanding → `scrollHeader` above chat; suggested replies stay above input |
| Opening facts | `seedOpeningAssertedFacts` extracts 3 user_asserted claims into DC |
| Understood UI | Always show section; project opening facts with fact IDs |
| Readiness | Count user_asserted as investigation started; hide Fresh empty 0% |
| Report map | `investigation-report-map.ts` maps DIR → pages/layer/purpose |
| Model ask | Legal candidates only; model may diverge from code rank hint |
| PPI | Require source_fields + traditional_basis; else `none` |

## Unit tests

```text
pnpm exec tsx scripts/test-di2-understanding-composer-flow.ts  → Passed 19 checks (exit 0)
pnpm exec tsx scripts/test-di2-production-interaction-r1.ts    → ALL R1 unit checks passed (exit 0)
pnpm exec tsx scripts/test-di2-personalized-understanding-path.ts → ALL PASS (exit 0)
```

Readiness with opening facts (same case): `percent=18`, components conflicts=100 others=0 — not fake 0%.

## Live OpenRouter first turn

Command: `pnpm exec tsx scripts/test-di2-production-interaction-r1-openrouter.ts`  
Artifact: `openrouter-first-turn.json`

User statement:

> 我从上一次的创业失败后，已经好几年没有收入了，一直找不到事情做，怎么办？

Observed:

- Opening facts: 3 (`past_venture_failure`, `prolonged_no_income`, `no_clear_next_work`)
- Understood labels include those 3 asserted claims
- Progress: **18%** (not 0%)
- Code rank hint: `cq_dir_DIR-BIZ-MODEL`
- Model selected: `cq_dir_DIR-DEF-OUTCOME` (**diverged** — expectation first)
- `suggested_replies`: exactly 3 (稳定收入 / 做成一件事 / 找回方向感)
- `model_response_text` has no internal Reasoning leak
- PPI: empty / not shown (insufficient evidence bar)

## Known limits

- Continuous multi-turn click-through of suggested replies not re-run live in this pack (unit + first-turn live only).
- Some need labels still show mixed · separators from Blueprint need strings; sanitizer strips snake_case IDs but Chinese Blueprint needs remain.
- Persist mocked in live script (`__setM1rPersistForTests`) — same pattern as other DI2 evidence scripts.
- No merge to main; no production deploy.

## Modified files (implementation commit)

- `components/poju/{PojuChat,POJUChatUI,DecisionUnderstandingPanel,poju-chat.css}`
- `lib/poju/chat-bootstrap.ts`
- `lib/poju/decision-intake/{adaptive-turn,fresh-session-bootstrap,ui-projection,understanding-response-model,understanding-state}.ts`
- `lib/poju/decision-intake/{opening-asserted-facts,investigation-report-map}.ts` (new)
- `scripts/test-di2-understanding-composer-flow.ts`
- `scripts/test-di2-production-interaction-r1.ts` (new)
