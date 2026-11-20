# DI2 Production Cutover — Deploy Evidence

Date: 2026-11-20  
Project: `easternos` (`prj_CaLkKcuSQkqqGpFQn6xqzuhEVPWX`)  
Team: `yangwu11214-1009s-projects`

This record documents merge + Production deploy only.  
**It does not claim DI2 product acceptance.**

## Git

| Item | SHA |
|---|---|
| Pre-merge `origin/main` | `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` |
| Pre-merge feature | `4c8d2d4eca7e85d7dbdf53dc44bdf6722ca76e1f` |
| Merge-base | `ee8c96e8a7a128fa8e059c2a9f81c9f0d2127688` |
| Ahead/behind (`main...feature`) | `0 204` |
| Post-merge `origin/main` | `4c8d2d4eca7e85d7dbdf53dc44bdf6722ca76e1f` |

- Merge method: **fast-forward** (`git merge --ff-only` + `git push origin main`)
- Tracked working tree dirty count before merge: `0`
- Feature HEAD matched previously reviewed evidence HEAD; no extra commits after review

## Production Deployment

| Item | Value |
|---|---|
| Deployment ID | `dpl_6AuMLE8qDaGX53LK32tkZpAbREXb` |
| State | `READY` |
| Target | `production` |
| Git SHA | `4c8d2d4eca7e85d7dbdf53dc44bdf6722ca76e1f` |
| Branch | `main` |
| Production URL | `https://www.easternos.com` / `https://easternos.com` |
| Inspector | https://vercel.com/yangwu11214-1009s-projects/easternos/6AuMLE8qDaGX53LK32tkZpAbREXb |
| Runtime | `nodejs22.x` |
| Package manager (build log) | `pnpm@10.33.2` |

Build notes (from deployment events):

- `Detected pnpm-lock.yaml ... packageManager pnpm@10.33.2`
- `Done in 1.3s using pnpm v10.33.2`
- Next.js `16.2.4` webpack build completed
- `[assert-next-routes-manifest] ok`
- `Deployment completed` / `Build Completed in /vercel/output [3m]`

Infra alignment performed before deploy:

- Vercel project `nodeVersion` set from `24.x` → `22.x` to match `package.json` engines

## Production env checklist (names only)

| Key / capability | Production status |
|---|---|
| `OPENROUTER_API_KEY` | configured |
| `OPENROUTER_MODEL` | unset (code default `deepseek/deepseek-v4-pro-0813`) |
| `OPENROUTER_PROVIDER_ORDER` | configured |
| `OPENROUTER_PROVIDER_ESCAPE` | configured |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | configured (Upstash/Vercel KV aliases; `UPSTASH_REDIS_REST_*` not separately set) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | configured |
| `OPS_SESSION_SECRET` (+ `OPS_USER` / `OPS_PASSWORD`) | configured → Decision Authority signing fallback available |
| `POJU_AUTHORITY_SIGNING_SECRET` | not set as dedicated key (fallback via `OPS_SESSION_SECRET`) |
| `NEXT_PUBLIC_SITE_URL` | configured |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | configured |
| `RESEND_API_KEY` | configured |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **not present** in project env list |
| Production branch | `main` (confirmed by Production deployments from `main`) |
| `vercel.json` `maxDuration: 300` routes | present in repo; prior Production already served these routes |

No secret values are recorded in this evidence pack.

## Smoke tests (post-deploy)

Artifacts:

- `postdeploy-smoke.json`
- `redis-smoke.json`

Observed:

1. `GET https://www.easternos.com/` → `200`
2. Product entry `/app` → `200` (auth redirect path; not Delivery Lab)
3. `POST /api/poju/chat` empty body → `400` expected session-shape error (route live)
4. `GET /api/inngest` → `401` + `X-Inngest-Sdk-Handled: true` (signing active; unsigned probe rejected)
5. `POST /api/ops/login` wrong creds → `401 invalid_credentials` (not `ops_not_configured`)
6. Hosted Redis via local KV credentials (same Upstash store as Production aliases) → SET/GET/DEL OK
7. Runtime log search for `MemoryKv` on this deployment → no hits
8. Runtime errors observed were Inngest unsigned GET signature failures from probes (expected), on `nodejs22.x`

## Not completed (real acceptance still required)

- Browser creation of a fresh POJU Session through the normal product UI
- Live OpenRouter turn proving model request egress and failure fail-closed behavior
- End-to-end Freeze / Decision Authority / Decision Report / Final Delivery on Production
- Inngest job receive + continue for a real report task (beyond unsigned route probe)
- Stripe checkout / Pass entitlement path (Stripe env keys absent)
- Full DI2 product acceptance

## Verdict

DI2 code is on `main` and deployed to Vercel Production at SHA `4c8d2d4e`.  
Production infrastructure checklist for starting real acceptance is in place for Redis (KV aliases), Inngest keys, OpenRouter key, Ops/authority signing fallback, and Supabase.  

**Not accepted as finished DI2 product QA.**
