/**
 * Unit D — originating browser: persist completed report locally, verify, then ACK.
 */

import { ensurePojuDbReady } from "@/lib/db/poju-db";
import { computeDeliveryContentIntegrity } from "./delivery-ack";
import { loadReportTaskCredential } from "./browser-task-credential-client";

export type LocalDeliveryReportRow = {
  id: string;
  session_id: string;
  job_id: string;
  report_job_id: string;
  committed_at: string;
  full_text: string;
  content_integrity: string;
  verified_at: number;
  created_at: number;
};

function rowId(session_id: string, job_id: string): string {
  return `${session_id}:${job_id}`;
}

export async function persistLocalDeliveryReport(input: {
  session_id: string;
  job_id: string;
  report_job_id: string;
  committed_at: string;
  full_text: string;
}): Promise<{ ok: true; content_integrity: string } | { ok: false; code: string; error: string }> {
  const full_text = input.full_text?.trim() ?? "";
  if (!full_text) {
    return { ok: false, code: "EMPTY_REPORT", error: "Cannot persist an empty report" };
  }
  const content_integrity = computeDeliveryContentIntegrity({
    report_job_id: input.report_job_id,
    full_text,
    committed_at: input.committed_at,
  });
  const db = await ensurePojuDbReady();
  const now = Date.now();
  const id = rowId(input.session_id, input.job_id);
  const row: LocalDeliveryReportRow = {
    id,
    session_id: input.session_id,
    job_id: input.job_id,
    report_job_id: input.report_job_id,
    committed_at: input.committed_at,
    full_text,
    content_integrity,
    verified_at: 0,
    created_at: now,
  };
  await db.local_delivery_reports.put(row);

  // Re-read and verify integrity before ACK is allowed.
  const back = await db.local_delivery_reports.get(id);
  if (!back || back.full_text !== full_text || back.content_integrity !== content_integrity) {
    return {
      ok: false,
      code: "LOCAL_VERIFY_FAILED",
      error: "IndexedDB re-read failed content integrity verification",
    };
  }
  await db.local_delivery_reports.put({ ...back, verified_at: Date.now() });
  return { ok: true, content_integrity };
}

export async function loadLocalDeliveryReport(
  session_id: string,
  job_id: string,
): Promise<LocalDeliveryReportRow | null> {
  const db = await ensurePojuDbReady();
  return (await db.local_delivery_reports.get(rowId(session_id, job_id))) ?? null;
}

/**
 * Claim → local persist+verify → ACK. Does not ACK if local verification fails.
 */
export async function claimPersistAndAckReport(input: {
  session_id: string;
  job_id: string;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; content_integrity: string; ack_outcome: string }
  | { ok: false; code: string; error: string; status?: number }
> {
  const credential = await loadReportTaskCredential(input.session_id, input.job_id);
  if (!credential) {
    return { ok: false, code: "TASK_CREDENTIAL_MISSING", error: "browser task credential missing locally" };
  }

  const claimRes = await fetch("/api/poju/decision-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({
      action: "claim",
      session_id: input.session_id,
      job_id: input.job_id,
      browser_task_credential: credential,
    }),
  });
  const claimJson = (await claimRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!claimRes.ok || claimJson.ok !== true) {
    return {
      ok: false,
      code: String(claimJson.code ?? "CLAIM_FAILED"),
      error: String(claimJson.error ?? "claim failed"),
      status: claimRes.status,
    };
  }

  const result = claimJson.result as { report_job_id?: string; full_text?: string } | undefined;
  const committed_at = String(claimJson.committed_at ?? "");
  const report_job_id = String(result?.report_job_id ?? claimJson.report_job_id ?? "");
  const full_text = String(result?.full_text ?? "");
  if (!report_job_id || !full_text || !committed_at) {
    return { ok: false, code: "CLAIM_INCOMPLETE", error: "claim payload missing report body" };
  }

  const persisted = await persistLocalDeliveryReport({
    session_id: input.session_id,
    job_id: input.job_id,
    report_job_id,
    committed_at,
    full_text,
  });
  if (!persisted.ok) return persisted;

  const ackRes = await fetch("/api/poju/decision-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({
      action: "ack",
      session_id: input.session_id,
      job_id: input.job_id,
      browser_task_credential: credential,
      content_integrity: persisted.content_integrity,
      local_persisted: true,
    }),
  });
  const ackJson = (await ackRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!ackRes.ok || ackJson.ok !== true) {
    return {
      ok: false,
      code: String(ackJson.code ?? "ACK_FAILED"),
      error: String(ackJson.error ?? "ACK failed"),
      status: ackRes.status,
    };
  }
  return {
    ok: true,
    content_integrity: persisted.content_integrity,
    ack_outcome: String(ackJson.outcome ?? "acked"),
  };
}
