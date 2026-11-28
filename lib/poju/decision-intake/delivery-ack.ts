/**
 * Unit D — idempotent delivery ACK after local IndexedDB persistence succeeds.
 *
 * ACK requires browser task credential. Content purge reuses Unit C lifecycle.
 */

import { createHash } from "node:crypto";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { assertBrowserTaskCredential } from "./browser-task-credential";
import { loadCompletedReport } from "./decision-report-store";
import {
  loadReportLifecycle,
  markReportLifecycleAcked,
  purgeReportPersonalContent,
} from "./report-data-lifecycle";

export type DeliveryAckRecord = {
  v: 1;
  job_id: string;
  session_id: string;
  content_integrity: string;
  acked_at: string;
  purge_attempted_at: string | null;
  purge_completed_at: string | null;
};

export type DeliveryAckResult =
  | {
      ok: true;
      outcome: "acked" | "already_acked";
      acked_at: string;
      purged: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      retryable: boolean;
    };

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export function deliveryAckKey(job_id: string): string {
  return `poju-di2:ack:${safe(job_id)}`;
}

export function computeDeliveryContentIntegrity(input: {
  report_job_id: string;
  full_text: string;
  committed_at: string;
}): string {
  return createHash("sha256")
    .update(
      `poju-delivery-integrity|${input.report_job_id}|${input.committed_at}|${input.full_text}`,
    )
    .digest("hex");
}

export async function loadDeliveryAck(job_id: string): Promise<DeliveryAckRecord | null> {
  const got = await durableKv().get<DeliveryAckRecord>(deliveryAckKey(job_id));
  if (!got || got.v !== 1 || got.job_id !== job_id) return null;
  return got;
}

/**
 * Idempotent ACK: credential + completed report + client-asserted integrity.
 * Persists ACK first, then purges personal content (retry-safe).
 */
export async function acknowledgeReportDelivery(input: {
  session_id: string;
  job_id: string;
  browser_task_credential: unknown;
  content_integrity: string;
  local_persisted: boolean;
}): Promise<DeliveryAckResult> {
  if (input.local_persisted !== true) {
    return {
      ok: false,
      status: 400,
      code: "LOCAL_PERSIST_REQUIRED",
      error: "ACK requires confirmed local IndexedDB persistence",
      retryable: false,
    };
  }
  const integrity = typeof input.content_integrity === "string" ? input.content_integrity.trim() : "";
  if (!/^[a-f0-9]{64}$/i.test(integrity)) {
    return {
      ok: false,
      status: 400,
      code: "INTEGRITY_REQUIRED",
      error: "content_integrity sha256 required",
      retryable: false,
    };
  }

  const gate = await assertBrowserTaskCredential({
    job_id: input.job_id,
    session_id: input.session_id,
    credential: input.browser_task_credential,
  });
  if (!gate.ok) {
    return {
      ok: false,
      status: gate.status,
      code: gate.code,
      error: gate.error,
      retryable: false,
    };
  }

  const prior = await loadDeliveryAck(input.job_id);
  if (prior) {
    if (prior.content_integrity.toLowerCase() !== integrity.toLowerCase()) {
      return {
        ok: false,
        status: 409,
        code: "ACK_INTEGRITY_CONFLICT",
        error: "ACK already recorded with a different content integrity",
        retryable: false,
      };
    }
    // Idempotent success — ensure purge completed.
    if (!prior.purge_completed_at) {
      await purgeReportPersonalContent({
        job_id: input.job_id,
        session_id: input.session_id,
        reason: "ack",
      }).catch(() => undefined);
      const refreshed: DeliveryAckRecord = {
        ...prior,
        purge_attempted_at: prior.purge_attempted_at ?? new Date().toISOString(),
        purge_completed_at: new Date().toISOString(),
      };
      await durableKv().set(deliveryAckKey(input.job_id), refreshed, {
        ex: KV_TTL.REPORT_JOB_ABSOLUTE,
      });
    }
    return {
      ok: true,
      outcome: "already_acked",
      acked_at: prior.acked_at,
      purged: true,
    };
  }

  const completed = await loadCompletedReport(input.session_id, input.job_id).catch(() => null);
  if (!completed) {
    const life = await loadReportLifecycle(input.job_id);
    if (life?.state === "acked" || life?.state === "purged") {
      return {
        ok: true,
        outcome: "already_acked",
        acked_at: life.acked_at ?? life.last_purge_at ?? new Date().toISOString(),
        purged: true,
      };
    }
    return {
      ok: false,
      status: 409,
      code: "REPORT_NOT_COMPLETE",
      error: "Cannot ACK before a completed report exists",
      retryable: true,
    };
  }

  const expected = computeDeliveryContentIntegrity({
    report_job_id: completed.report_job_id,
    full_text: completed.result.full_text,
    committed_at: completed.committed_at,
  });
  if (expected.toLowerCase() !== integrity.toLowerCase()) {
    return {
      ok: false,
      status: 409,
      code: "INTEGRITY_MISMATCH",
      error: "Local content integrity does not match server CompletedReport",
      retryable: false,
    };
  }

  const now = new Date().toISOString();
  const ack: DeliveryAckRecord = {
    v: 1,
    job_id: input.job_id,
    session_id: input.session_id,
    content_integrity: integrity.toLowerCase(),
    acked_at: now,
    purge_attempted_at: null,
    purge_completed_at: null,
  };
  const set = await durableKv().set(deliveryAckKey(input.job_id), ack, {
    ex: KV_TTL.REPORT_JOB_ABSOLUTE,
    nx: true,
  });
  const stored = await loadDeliveryAck(input.job_id);
  if (!stored) {
    return {
      ok: false,
      status: 503,
      code: "ACK_PERSIST_UNCONFIRMED",
      error: "ACK could not be confirmed",
      retryable: true,
    };
  }
  if (set !== "OK" && stored.content_integrity.toLowerCase() !== integrity.toLowerCase()) {
    return {
      ok: false,
      status: 409,
      code: "ACK_INTEGRITY_CONFLICT",
      error: "Concurrent ACK recorded a different integrity",
      retryable: false,
    };
  }

  await markReportLifecycleAcked({ job_id: input.job_id, now });
  await purgeReportPersonalContent({
    job_id: input.job_id,
    session_id: input.session_id,
    analysis_idempotency_key: completed.analysis.idempotency_key,
    reason: "ack",
    now,
  });

  const finalized: DeliveryAckRecord = {
    ...stored,
    purge_attempted_at: now,
    purge_completed_at: now,
  };
  await durableKv().set(deliveryAckKey(input.job_id), finalized, {
    ex: KV_TTL.REPORT_JOB_ABSOLUTE,
  });

  return {
    ok: true,
    outcome: set === "OK" ? "acked" : "already_acked",
    acked_at: stored.acked_at,
    purged: true,
  };
}
