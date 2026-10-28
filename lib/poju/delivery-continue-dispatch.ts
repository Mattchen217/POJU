/**
 * Phase-4 stage handoff dispatcher.
 *
 * Preference: Inngest (when INNGEST_EVENT_KEY is set) → QStash → direct fetch.
 * Vercel returns HTTP 508 when a /continue invoke self-fetches /continue;
 * Inngest/QStash publish from outside so the next hop is a fresh root request.
 *
 * Publish is not attachment. The continue function allows one run per job, so a
 * hop sent from inside that function cannot ack until the sender returns.
 * A missing ack runs the stage in this isolate (fast parent) or leaves
 * `await_task_attach` for the status poll to host the next worker.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { deliveryTaskLeaseHeld } from "@/lib/llm/pro/delivery/dispatch/task-store";
import { hasLiveDeliveryContinueForStage } from "@/lib/llm/pro/delivery/delivery-stage-store";
import { getXhighJob, setXhighJobContent } from "@/lib/poju/xhigh-job-store";
import { deliveryContinueFetchAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { inngest } from "@/lib/inngest/client";
import type { DeliveryPipelineStage } from "@/lib/poju/final-delivery-stage-runner";

/** Short enough that a blocked continue slot is released before status's 45s kill. */
const CONTINUE_ATTACH_WAIT_MS = 8_000;
const TASK_ATTACH_WAIT_MS = 8_000;

const directStageDepth = new AsyncLocalStorage<number>();

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

/** Prefer Inngest when event key is present (unless explicitly disabled). */
export function shouldDispatchContinueViaInngest(): boolean {
  if (!process.env.INNGEST_EVENT_KEY?.trim()) return false;
  if (process.env.DELIVERY_CONTINUE_VIA_INNGEST?.trim() === "0") return false;
  if (process.env.DELIVERY_CONTINUE_VIA_INNGEST?.trim() === "1") return true;
  return true;
}

/** Prefer QStash on Vercel when Inngest is off (or when explicitly forced). */
export function shouldDispatchContinueViaQStash(): boolean {
  if (shouldDispatchContinueViaInngest()) return false;
  if (!qstashToken()) return false;
  if (process.env.DELIVERY_CONTINUE_VIA_QSTASH?.trim() === "1") return true;
  if (process.env.DELIVERY_CONTINUE_VIA_QSTASH?.trim() === "0") return false;
  return process.env.VERCEL === "1";
}

export async function publishContinueViaInngest(
  job_id: string,
  stage: string,
): Promise<"published" | "failed"> {
  try {
    await inngest.send({
      name: "poju/final-delivery.continue",
      data: { job_id, stage: stage as DeliveryPipelineStage },
    });
    console.info("[final-delivery] Inngest continue published", { job_id, stage });
    return "published";
  } catch (e) {
    console.warn("[final-delivery] Inngest continue publish failed", { job_id, stage, e });
    return "failed";
  }
}

export async function publishTaskViaInngest(
  job_id: string,
  task_id: string,
): Promise<"published" | "failed"> {
  try {
    await inngest.send({
      name: "poju/final-delivery.task",
      data: { job_id, task_id },
    });
    console.info("[final-delivery] Inngest task published", { job_id, task_id });
    return "published";
  } catch (e) {
    console.warn("[final-delivery] Inngest task publish failed", { job_id, task_id, e });
    return "failed";
  }
}

async function waitForContinueAck(
  job_id: string,
  stage: string,
  timeoutMs: number,
): Promise<boolean> {
  const started = Date.now();
  let lastBeat = 0;
  while (Date.now() - started < timeoutMs) {
    if (await hasLiveDeliveryContinueForStage(job_id, stage)) return true;
    // Status hard-stops a running job after 45s without updated_at.
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      await setXhighJobContent(job_id, `await_continue_ack:${stage}:${Date.now()}`).catch(
        () => undefined,
      );
    }
    await sleep(250);
  }
  return hasLiveDeliveryContinueForStage(job_id, stage);
}

async function taskWorkerAttached(job_id: string, task_id: string): Promise<boolean> {
  if (await deliveryTaskLeaseHeld(job_id, task_id)) return true;
  const job = await getXhighJob(job_id);
  const content = job?.accumulated_content ?? "";
  return content.startsWith(`dispatch_task:${task_id}:`);
}

async function waitForTaskAttach(job_id: string, task_id: string, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  // Stamp immediately. The caller's dispatch_task interval is already cleared,
  // and a killed wait must not leave that stale heartbeat as the last write.
  let lastBeat = 0;
  while (Date.now() - started < timeoutMs) {
    if (await taskWorkerAttached(job_id, task_id)) return true;
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      await setXhighJobContent(job_id, `await_task_attach:${task_id}:${Date.now()}`).catch(
        () => undefined,
      );
    }
    await sleep(250);
  }
  return taskWorkerAttached(job_id, task_id);
}

/**
 * Continue publish succeeded but nobody took the lease.
 * Run the stage here when this isolate can still host the parent hop.
 * Deeper nests (assemble inside an already-direct stage) leave a fresh
 * await_continue_ack so the status poll hosts them on a new 300s budget.
 */
async function runStageInThisIsolate(
  job_id: string,
  stage: string,
): Promise<ContinuePostResult> {
  const depth = directStageDepth.getStore() ?? 0;
  if (depth >= 2) {
    await setXhighJobContent(job_id, `await_continue_ack:${stage}:${Date.now()}`).catch(
      () => undefined,
    );
    console.warn("[final-delivery] direct stage deferred to status", { job_id, stage, depth });
    return "accepted";
  }
  console.warn("[final-delivery] continue published but no worker — direct stage", {
    job_id,
    stage,
    depth,
  });
  try {
    return await directStageDepth.run(depth + 1, async () => {
      const { DELIVERY_PIPELINE_STAGES, runFinalDeliveryStage } = await import(
        "@/lib/poju/final-delivery-stage-runner"
      );
      if (!(DELIVERY_PIPELINE_STAGES as readonly string[]).includes(stage)) return "rejected";
      await runFinalDeliveryStage(job_id, stage as DeliveryPipelineStage);
      return "accepted";
    });
  } catch (e) {
    console.error("[final-delivery] direct stage failed", { job_id, stage, e });
    return "rejected";
  }
}

async function finishTaskPublish(
  job_id: string,
  task_id: string,
  published: "published" | "failed",
): Promise<"published" | "failed"> {
  if (published !== "published") return published;
  if (await waitForTaskAttach(job_id, task_id, TASK_ATTACH_WAIT_MS)) return "published";
  await setXhighJobContent(job_id, `await_task_attach:${task_id}:${Date.now()}`).catch(
    () => undefined,
  );
  console.warn("[final-delivery] task published but no worker — awaiting status rescue", {
    job_id,
    task_id,
  });
  return "published";
}

/**
 * True once a continue worker has the lease/ACK or the job has left pending.
 * Publish-alone is not attachment — Inngest send can succeed and never run.
 */
export async function waitForDeliveryWorker(
  job_id: string,
  stage: string,
  timeoutMs: number,
): Promise<boolean> {
  const started = Date.now();
  let lastBeat = 0;
  while (Date.now() - started < timeoutMs) {
    if (await hasLiveDeliveryContinueForStage(job_id, stage)) return true;
    const job = await getXhighJob(job_id);
    if (job && (job.status === "running" || job.status === "completed")) return true;
    if (job?.status === "failed") return false;
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      await setXhighJobContent(job_id, `await_worker_attach:${stage}:${Date.now()}`).catch(
        () => undefined,
      );
    }
    await sleep(500);
  }
  if (await hasLiveDeliveryContinueForStage(job_id, stage)) return true;
  const job = await getXhighJob(job_id);
  return Boolean(job && (job.status === "running" || job.status === "completed"));
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
 * Schedule the next continue hop.
 * Prefer Inngest → QStash → direct fetch (508 → QStash/Inngest if available).
 */
export async function dispatchDeliveryContinue(
  job_id: string,
  stage: string,
  secret: string,
): Promise<ContinuePostResult> {
  if (shouldDispatchContinueViaInngest()) {
    const published = await publishContinueViaInngest(job_id, stage);
    if (published === "published") {
      // Inngest is async; ACK appears when the function acquires the lease.
      // Same-job continue concurrency is 1, so this wait cannot see a child
      // that we ourselves are blocking. Missing ACK is not success.
      if (await waitForContinueAck(job_id, stage, CONTINUE_ATTACH_WAIT_MS)) return "accepted";
      return runStageInThisIsolate(job_id, stage);
    }
    console.warn("[final-delivery] Inngest continue failed — falling through", {
      job_id,
      stage,
    });
  }

  const origin = continueOrigin();
  if (!origin) {
    console.error("[final-delivery] continue origin missing", { job_id, stage });
    return "rejected";
  }

  const viaQStash = async (): Promise<ContinuePostResult> => {
    const published = await publishContinueViaQStash(job_id, stage, secret, origin);
    if (published !== "published") return "rejected";
    if (await waitForContinueAck(job_id, stage, CONTINUE_ATTACH_WAIT_MS)) return "accepted";
    return runStageInThisIsolate(job_id, stage);
  };

  if (shouldDispatchContinueViaQStash()) {
    return viaQStash();
  }

  const direct = await postDeliveryContinueDirect(job_id, stage, secret, origin);
  if (direct === "loop_blocked") {
    if (shouldDispatchContinueViaInngest()) {
      const pub = await publishContinueViaInngest(job_id, stage);
      if (pub === "published") {
        if (await waitForContinueAck(job_id, stage, CONTINUE_ATTACH_WAIT_MS)) return "accepted";
        return runStageInThisIsolate(job_id, stage);
      }
    }
    if (qstashToken()) {
      console.info("[final-delivery] 508 → falling back to QStash", { job_id, stage });
      return viaQStash();
    }
    console.error(
      "[final-delivery] continue blocked by Vercel 508 (INFINITE_LOOP_DETECTED). " +
        "Set INNGEST_EVENT_KEY (preferred) or QSTASH_TOKEN so stage hops are not self-fetch.",
      { job_id, stage },
    );
    return "loop_blocked";
  }
  return direct;
}

/**
 * Publish one atomic delivery task worker.
 * Prefer Inngest → QStash → direct fetch for local/dev.
 */
export async function publishDeliveryTask(
  job_id: string,
  task_id: string,
  secret: string,
): Promise<"published" | "failed"> {
  if (shouldDispatchContinueViaInngest()) {
    return finishTaskPublish(job_id, task_id, await publishTaskViaInngest(job_id, task_id));
  }

  const origin = continueOrigin();
  if (!origin) {
    console.error("[final-delivery] task origin missing", { job_id, task_id });
    return "failed";
  }

  const destination = `${origin}/api/poju/final-delivery/task`;
  const body = JSON.stringify({ job_id, task_id });

  if (shouldDispatchContinueViaQStash()) {
    const token = qstashToken();
    if (!token) return "failed";
    const publishUrl = `https://qstash.upstash.io/v2/publish/${destination}`;
    try {
      const res = await fetch(publishUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Upstash-Forward-Content-Type": "application/json",
          "Upstash-Forward-x-poju-delivery-continue": secret,
          "Upstash-Retries": "2",
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[final-delivery] QStash task publish non-ok", {
          job_id,
          task_id,
          status: res.status,
          body: text.slice(0, 300),
        });
        return "failed";
      }
      console.info("[final-delivery] QStash task published", { job_id, task_id });
      return finishTaskPublish(job_id, task_id, "published");
    } catch (e) {
      console.warn("[final-delivery] QStash task publish failed", { job_id, task_id, e });
      return "failed";
    }
  }

  // Local/dev: fire-and-forget direct POST (do not await worker completion).
  try {
    void fetch(destination, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-poju-delivery-continue": secret,
        Connection: "close",
      },
      body,
    }).catch((e) => {
      console.warn("[final-delivery] direct task fetch failed", { job_id, task_id, e });
    });
    return finishTaskPublish(job_id, task_id, "published");
  } catch (e) {
    console.warn("[final-delivery] direct task publish failed", { job_id, task_id, e });
    return "failed";
  }
}

/**
 * Delayed continue for dispatch safety sweep (dead-worker recovery).
 * Prefer Inngest future `ts`; else QStash Upstash-Delay; else skip locally.
 */
export async function publishDeliveryContinueDelayed(
  job_id: string,
  stage: string,
  secret: string,
  delaySec: number,
): Promise<"published" | "failed" | "skipped"> {
  const delay = Math.max(15, Math.min(600, Math.floor(delaySec)));

  if (shouldDispatchContinueViaInngest()) {
    try {
      await inngest.send({
        name: "poju/final-delivery.continue",
        data: { job_id, stage: stage as DeliveryPipelineStage },
        ts: Date.now() + delay * 1000,
      });
      console.info("[final-delivery] delayed Inngest continue published", {
        job_id,
        stage,
        delay_s: delay,
      });
      return "published";
    } catch (e) {
      console.warn("[final-delivery] delayed Inngest continue failed", { job_id, stage, e });
      return "failed";
    }
  }

  const origin = continueOrigin();
  if (!origin) return "failed";
  const token = qstashToken();
  if (!token || !shouldDispatchContinueViaQStash()) {
    return "skipped";
  }

  const destination = `${origin}/api/poju/final-delivery/continue`;
  const publishUrl = `https://qstash.upstash.io/v2/publish/${destination}`;

  try {
    const res = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Forward-Content-Type": "application/json",
        "Upstash-Forward-x-poju-delivery-continue": secret,
        "Upstash-Delay": `${delay}s`,
        "Upstash-Retries": "2",
      },
      body: JSON.stringify({ job_id, stage, dispatch_sweep: true }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[final-delivery] delayed continue publish non-ok", {
        job_id,
        stage,
        delay,
        status: res.status,
        body: text.slice(0, 200),
      });
      return "failed";
    }
    console.info("[final-delivery] delayed continue published", { job_id, stage, delay_s: delay });
    return "published";
  } catch (e) {
    console.warn("[final-delivery] delayed continue publish failed", { job_id, stage, e });
    return "failed";
  }
}
