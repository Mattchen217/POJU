/**
 * Unit: transient network disconnect retry helper + progress-preserve contract.
 * Keep ASCII-only string literals for Windows shells.
 * Run: pnpm exec tsx scripts/test-transient-network-retry.ts
 */
import assert from "node:assert/strict";
import {
  TRANSIENT_NETWORK_BACKOFF_MS,
  TRANSIENT_NETWORK_MAX_ATTEMPTS,
  isIntentionalAbortError,
  isTransientAuthFetchError,
  isTransientNetworkDisconnect,
  withTransientNetworkRetry,
} from "../lib/client/transient-network-retry";

assert.equal(TRANSIENT_NETWORK_MAX_ATTEMPTS, 3);
assert.deepEqual([...TRANSIENT_NETWORK_BACKOFF_MS], [400, 1200]);

assert.equal(
  isTransientNetworkDisconnect(new TypeError("Failed to fetch")),
  true,
);
assert.equal(
  isTransientNetworkDisconnect(new TypeError("Load failed")),
  true,
);
assert.equal(
  isTransientNetworkDisconnect(new Error("net::ERR_CONNECTION_CLOSED")),
  true,
);
assert.equal(
  isTransientNetworkDisconnect(new Error("ERR_CONNECTION_RESET")),
  true,
);
assert.equal(
  isTransientNetworkDisconnect(
    new Error("NetworkError when attempting to fetch resource."),
  ),
  true,
);

const intentional = new Error("AbortError");
intentional.name = "AbortError";
assert.equal(isIntentionalAbortError(intentional), true);
assert.equal(isTransientNetworkDisconnect(intentional), false);

const aborted = new AbortController();
aborted.abort();
assert.equal(
  isTransientNetworkDisconnect(new TypeError("Failed to fetch"), aborted.signal),
  false,
);

assert.equal(
  isTransientAuthFetchError({
    name: "AuthRetryableFetchError",
    status: 0,
    message: "Failed to fetch",
  }),
  true,
);
assert.equal(
  isTransientAuthFetchError({
    name: "AuthSessionMissingError",
    status: 400,
    message: "Auth session missing!",
  }),
  false,
);

async function progressPreserveContract(): Promise<void> {
  const progress = { hops: 0, completed: false };
  const sleeps: number[] = [];
  let calls = 0;

  const result = await withTransientNetworkRetry(
    async () => {
      calls += 1;
      progress.hops += 1;
      if (calls < 3) {
        throw new TypeError("Failed to fetch");
      }
      progress.completed = true;
      return { ok: true, hops: progress.hops };
    },
    {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  );

  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [400, 1200]);
  assert.equal(progress.hops, 3);
  assert.equal(progress.completed, true);
  assert.deepEqual(result, { ok: true, hops: 3 });
}

async function noRetryOnAbort(): Promise<void> {
  let calls = 0;
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    async () =>
      withTransientNetworkRetry(
        async () => {
          calls += 1;
          throw new TypeError("Failed to fetch");
        },
        { signal: ac.signal, sleep: async () => undefined },
      ),
    (err: unknown) => err instanceof Error && err.name === "AbortError",
  );
  assert.equal(calls, 0);
}

async function exhaustRetries(): Promise<void> {
  let calls = 0;
  await assert.rejects(
    async () =>
      withTransientNetworkRetry(
        async () => {
          calls += 1;
          throw new TypeError("Failed to fetch");
        },
        { sleep: async () => undefined },
      ),
    (err: unknown) => err instanceof TypeError,
  );
  assert.equal(calls, TRANSIENT_NETWORK_MAX_ATTEMPTS);
}

async function permanentAuthShapeNotRetriedAsDisconnect(): Promise<void> {
  let calls = 0;
  const permanent = Object.assign(
    new Error("Invalid Refresh Token: Refresh Token Not Found"),
    {
      name: "AuthApiError",
      status: 400,
    },
  );
  await assert.rejects(
    async () =>
      withTransientNetworkRetry(
        async () => {
          calls += 1;
          throw permanent;
        },
        { sleep: async () => undefined },
      ),
    (err: unknown) => err === permanent,
  );
  assert.equal(calls, 1);
}

async function main(): Promise<void> {
  await progressPreserveContract();
  await noRetryOnAbort();
  await exhaustRetries();
  await permanentAuthShapeNotRetriedAsDisconnect();
  console.log("ok: transient network retry + progress preserve");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});