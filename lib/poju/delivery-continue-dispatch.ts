/**
 * Phase-4 stage handoff dispatcher.
 *
 * Vercel returns HTTP 508 INFINITE_LOOP_DETECTED when a /continue invoke
 * self-fetches /continue (mark→mark hops especially). QStash publishes from
 * outside the deployment so the next hop is a fresh root request — not a
 * nested self-call. Direct fetch remains for local/dev and as a fallback.
 */

import { hasLiveDeliveryContinueForStage } from "@/lib/llm/pro/delivery/delivery-stage-store";
import { deliveryContinueFetchAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";

export type ContinuePostResult =
  | "accepted"
  | "rejected"
  | "network_error"
  | "loop_blocked";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function continueOrigin(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}

function qstashToken(): string | null {
  const t = process.env.QSTASH_TOKEN?.trim();
  return t || null;
}

/** Prefer QStash on Vercel (or when explicitly forced) to avoid 508 self-fetch loops. */
export function shouldDispatchContinueViaQStash(): boolean {
  if (!qstashToken()) return false;
  if (process.env.DELIVERY_CONTINUE_VIA_QSTASH?.trim() === "1") return true;
  if (process.env.DELIVERY_CONTINUE_VIA_QSTASH?.trim() === "0") return false;
  return process.env.VERCEL === "1";
}

async function waitForContinueAck(
  job_id: string,
  stage: string,
  timeoutMs: number,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await hasLiveDeliveryContinueForStage(job_id, stage)) return true;
    await sleep(250);
  }
  return hasLiveDeliveryContinueForStage(job_id, stage);
}

/**
 * Publish continue via Upstash QStash (external HTTP → breaks Vercel 508 loop).
 * Uses REST so we do not add an SDK dependency.
 */
export async function publishContinueViaQStash(
  job_id: string,
  stage: string,
  secret: string,
  origin: string,
): Promise<"published" | "failed"> {
  const token = qstashToken();
  if (!token) return "failed";

  const destination = `${origin}/api/poju/final-delivery/continue`;
  const publishUrl = `https://qstash.upstash.io/v2/publish/${destination}`;

  try {
    const res = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Forward auth + JSON content-type to the destination invoke.
        "Upstash-Forward-Content-Type": "application/json",
        "Upstash-Forward-x-poju-delivery-continue": secret,
        // Infrastructure retries on QStash side (not model/quality retries).
        "Upstash-Retries": "3",
      },
      body: JSON.stringify({ job_id, stage }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[final-delivery] QStash publish non-ok", {
        job_id,
        stage,
        status: res.status,
        body: text.slice(0, 300),
      });
      return "failed";
    }

    console.info("[final-delivery] QStash continue published", { job_id, stage });
    return "published";
  } catch (e) {
    console.warn("[final-delivery] QStash publish failed", { job_id, stage, e });
    return "failed";
  }
}

/** Direct self-fetch (local/dev). Retries network blips; 508 → loop_blocked (no burn). */
export async function postDeliveryContinueDirect(
  job_id: string,
  stage: string,
  secret: string,
  origin: string,
): Promise<ContinuePostResult> {
  const url = `${origin}/api/poju/final-delivery/continue`;
  const CONTINUE_FETCH_ATTEMPTS = deliveryContinueFetchAttempts();

  for (let attempt = 1; attempt <= CONTINUE_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-poju-delivery-continue": secret,
          // Undici keep-alive races on Vercel often surface as ECONNRESET on self-fetch.
          Connection: "close",
        },
        body: JSON.stringify({ job_id, stage }),
      });

      if (res.status === 202) {
        const body = (await res.json().catch(() => ({}))) as { accepted?: unknown };
        if (body.accepted === true) return "accepted";
      }
      if (res.status === 200) {
        const body = (await res.json().catch(() => ({}))) as {
          skipped?: unknown;
          status?: unknown;
        };
        if (body.skipped === true && body.status === "completed") return "accepted";
        if (body.skipped === true && body.status === "failed") return "rejected";
      }

      // Vercel INFINITE_LOOP_DETECTED — retrying the same self-fetch never helps.
      if (res.status === 508) {
        console.warn("[final-delivery] continue HTTP 508 loop detected", {
          job_id,
          stage,
          attempt,
        });
        return "loop_blocked";
      }

      console.warn("[final-delivery] continue HTTP non-ok", {
        job_id,
        stage,
        status: res.status,
        attempt,
        max_attempts: CONTINUE_FETCH_ATTEMPTS,
      });
      if (res.status === 409) return "rejected";
    } catch (e) {
      console.warn("[final-delivery] schedule continue fetch failed", {
        job_id,
        stage,
        attempt,
        max_attempts: CONTINUE_FETCH_ATTEMPTS,
        e,
      });
      if (attempt >= CONTINUE_FETCH_ATTEMPTS) return "network_error";
    }
  }
  return "rejected";
}

/**
 * Schedule the next /continue hop.
 * On Vercel with QSTASH_TOKEN: always QStash (avoids 508).
 * Otherwise direct fetch; on 508, fall back to QStash when token exists.
 */
export async function dispatchDeliveryContinue(
  job_id: string,
  stage: string,
  secret: string,
): Promise<ContinuePostResult> {
  const origin = continueOrigin();
  if (!origin) {
    console.error("[final-delivery] continue origin missing", { job_id, stage });
    return "rejected";
  }

  const viaQStash = async (): Promise<ContinuePostResult> => {
    const published = await publishContinueViaQStash(job_id, stage, secret, origin);
    if (published !== "published") return "rejected";
    // QStash is async — ACK/lease proves the destination accepted.
    if (await waitForContinueAck(job_id, stage, 45_000)) return "accepted";
    // Published to QStash — treat as accepted even if ACK is slow; status stale
    // + heartbeat owns failure if the hop never starts. Avoid false STOP.
    console.warn("[final-delivery] QStash published; ACK slow — assuming accepted", {
      job_id,
      stage,
    });
    return "accepted";
  };

  if (shouldDispatchContinueViaQStash()) {
    return viaQStash();
  }

  const direct = await postDeliveryContinueDirect(job_id, stage, secret, origin);
  if (direct === "loop_blocked") {
    if (qstashToken()) {
      console.info("[final-delivery] 508 → falling back to QStash", { job_id, stage });
      return viaQStash();
    }
    console.error(
      "[final-delivery] continue blocked by Vercel 508 (INFINITE_LOOP_DETECTED). " +
        "Set QSTASH_TOKEN so stage hops publish via Upstash QStash instead of self-fetch.",
      { job_id, stage },
    );
    return "loop_blocked";
  }
  return direct;
}
