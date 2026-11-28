/**
 * Unit B — originating-browser storage for the raw task credential.
 * IndexedDB only; never localStorage / URL / analytics.
 */

import { getPojuDb, ensurePojuDbReady } from "@/lib/db/poju-db";

export type ReportTaskCredentialRow = {
  /** `${session_id}:${job_id}` */
  id: string;
  session_id: string;
  job_id: string;
  /** Raw browser task credential (256-bit). */
  credential: string;
  created_at: number;
  updated_at: number;
};

function rowId(session_id: string, job_id: string): string {
  return `${session_id}:${job_id}`;
}

/** Browser-safe 256-bit credential (base64url). */
export function generateBrowserTaskCredentialClient(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa → base64; convert to base64url
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function saveReportTaskCredential(input: {
  session_id: string;
  job_id: string;
  credential: string;
}): Promise<void> {
  const db = await ensurePojuDbReady();
  const now = Date.now();
  const id = rowId(input.session_id, input.job_id);
  const prior = await db.report_task_credentials.get(id);
  const row: ReportTaskCredentialRow = {
    id,
    session_id: input.session_id,
    job_id: input.job_id,
    credential: input.credential.trim(),
    created_at: prior?.created_at ?? now,
    updated_at: now,
  };
  await db.report_task_credentials.put(row);
}

export async function loadReportTaskCredential(
  session_id: string,
  job_id: string,
): Promise<string | null> {
  const db = await ensurePojuDbReady();
  const row = await db.report_task_credentials.get(rowId(session_id, job_id));
  const c = row?.credential?.trim() ?? "";
  return c.length > 0 ? c : null;
}

export async function deleteReportTaskCredential(session_id: string, job_id: string): Promise<void> {
  const db = await ensurePojuDbReady();
  await db.report_task_credentials.delete(rowId(session_id, job_id));
}

/** Pending credential held until start returns job_id (same browser only). */
const pendingBySession = new Map<string, string>();

export function stashPendingBrowserTaskCredential(session_id: string, credential: string): void {
  pendingBySession.set(session_id, credential.trim());
}

export function takePendingBrowserTaskCredential(session_id: string): string | null {
  const c = pendingBySession.get(session_id) ?? null;
  pendingBySession.delete(session_id);
  return c;
}

export function peekPendingBrowserTaskCredential(session_id: string): string | null {
  return pendingBySession.get(session_id) ?? null;
}

/**
 * Resolve credential for start: reuse prior job credential when resuming,
 * otherwise mint a new one and stash until job_id is known.
 */
export async function resolveCredentialForReportStart(input: {
  session_id: string;
  pending_job_id?: string | null;
}): Promise<string> {
  const pendingJob = input.pending_job_id?.trim() || "";
  if (pendingJob) {
    const existing = await loadReportTaskCredential(input.session_id, pendingJob);
    if (existing) return existing;
  }
  const stashed = peekPendingBrowserTaskCredential(input.session_id);
  if (stashed) return stashed;
  const minted = generateBrowserTaskCredentialClient();
  stashPendingBrowserTaskCredential(input.session_id, minted);
  return minted;
}

export async function persistCredentialAfterStart(input: {
  session_id: string;
  job_id: string;
  credential: string;
}): Promise<void> {
  await saveReportTaskCredential(input);
  takePendingBrowserTaskCredential(input.session_id);
}
