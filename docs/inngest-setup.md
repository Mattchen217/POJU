# Inngest setup (Eastern OS)

App id in code: `pojulife` ([`lib/inngest/client.ts`](../lib/inngest/client.ts)).  
Serve URL: `https://<your-domain>/api/inngest` (production: `https://easternos.com/api/inngest`).

## 1. Create the Cloud app

1. Sign up at [app.inngest.com](https://app.inngest.com).
2. Create an app (name can match `pojulife`).
3. Open **Manage → Keys** and copy:
   - **Event Key** → `INNGEST_EVENT_KEY`
   - **Signing Key** → `INNGEST_SIGNING_KEY`

## 2. Env vars

Add to Vercel project env (Production + Preview) and local `.env.local`:

```bash
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

Optional delivery knobs:

```bash
# Prefer Inngest for Phase-4 continue/task hops when EVENT_KEY is set (default on).
# DELIVERY_CONTINUE_VIA_INNGEST=1
# Force QStash instead: DELIVERY_CONTINUE_VIA_INNGEST=0 and set QSTASH_TOKEN
```

## 3. Sync the serve endpoint

In Inngest Dashboard → Apps → Sync / Manage:

- Production: `https://easternos.com/api/inngest`
- Local: run `npx inngest-cli@latest dev` and point at `http://localhost:3000/api/inngest`

After sync you should see functions such as:

- `poju-final-delivery-continue`
- `poju-final-delivery-task`
- `companion-batch-fill`
- `companion-drip-tick`

## 4. Verify

1. Trigger a Phase-4 report (or send a test `poju/final-delivery.continue` event).
2. Dashboard → Runs shows a successful run.
3. Vercel logs show `POST/PUT /api/inngest` → 200.

Until keys are set and the app is synced, companion cron/fill and Phase-4 Inngest hops will not run in production.
