/**
 * Unit B — browser-exclusive report task credential.
 *
 * Original credential stays on the originating browser (IndexedDB).
 * Server stores only HMAC verifier material bound to job_id.
 * Account login / session_id / writer_token alone never authorize task access.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { signAuthorityDomain, verifyAuthorityDomain } from "@/lib/poju/decision-authority/server/signing";

export const BROWSER_TASK_CREDENTIAL_BYTES = 32;
export const BROWSER_TASK_CREDENTIAL_DOMAIN = "poju-browser-task-credential-v1";

export type BrowserTaskCredentialRecord = {
  v: 1;
  job_id: string;
  session_id: string;
  /** HMAC hex of job_id|session_id|credential — never the raw credential. */
  verifier: string;
  created_at: string;
  /** Absolute lifecycle start (Unit C). */
  bound_at: string;
};

export type TaskCredentialGateFailure = {
  ok: false;
  status: number;
  code:
    | "TASK_CREDENTIAL_REQUIRED"
    | "TASK_CREDENTIAL_INVALID"
    | "TASK_CREDENTIAL_MISMATCH"
    | "TASK_CREDENTIAL_MISSING_BINDING"
    | "TASK_CREDENTIAL_JOB_MISMATCH";
  error: string;
};

export type TaskCredentialGateSuccess = {
  ok: true;
  record: BrowserTaskCredentialRecord;
};

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export function browserTaskCredentialKey(job_id: string): string {
  return `poju-di2:task-cred:${safe(job_id)}`;
}

/** 256-bit high-entropy credential as URL-safe base64 (no padding). */
export function generateBrowserTaskCredential(): string {
  return randomBytes(BROWSER_TASK_CREDENTIAL_BYTES).toString("base64url");
}

export function isBrowserTaskCredentialFormat(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = value.trim();
  // 32 bytes → 43 base64url chars (no pad)
  return /^[A-Za-z0-9_-]{40,64}$/.test(t);
}

function credentialPayload(job_id: string, session_id: string, credential: string): string {
  return `${job_id}|${session_id}|${credential.trim()}`;
}

export function issueBrowserTaskCredentialVerifier(
  job_id: string,
  session_id: string,
  credential: string,
): string {
  return signAuthorityDomain(
    BROWSER_TASK_CREDENTIAL_DOMAIN,
    credentialPayload(job_id, session_id, credential),
  );
}

export function verifyBrowserTaskCredentialMaterial(
  job_id: string,
  session_id: string,
  credential: unknown,
  verifier: string,
): boolean {
  if (!isBrowserTaskCredentialFormat(credential)) return false;
  return verifyAuthorityDomain(
    BROWSER_TASK_CREDENTIAL_DOMAIN,
    credentialPayload(job_id, session_id, credential),
    verifier,
  );
}

/** Non-secret fingerprint for logs (never the credential). */
export function browserTaskCredentialLogFingerprint(credential: string): string {
  return createHash("sha256").update(`poju-btc-fp|${credential.trim()}`).digest("hex").slice(0, 12);
}

export async function loadBrowserTaskCredentialRecord(
  job_id: string,
): Promise<BrowserTaskCredentialRecord | null> {
  const got = await durableKv().get<BrowserTaskCredentialRecord>(browserTaskCredentialKey(job_id));
  if (!got || got.v !== 1 || got.job_id !== job_id) return null;
  if (typeof got.verifier !== "string" || got.verifier.length < 32) return null;
  return got;
}

/**
 * Bind credential verifier to a job. First bind wins; later binds must present
 * the same credential (idempotent). A different credential is refused.
 */
export async function bindBrowserTaskCredential(input: {
  job_id: string;
  session_id: string;
  credential: string;
  now?: string;
}): Promise<
  | { ok: true; record: BrowserTaskCredentialRecord; outcome: "bound" | "existing" }
  | TaskCredentialGateFailure
> {
  const job_id = input.job_id.trim();
  const session_id = input.session_id.trim();
  if (!job_id || !session_id) {
    return {
      ok: false,
      status: 400,
      code: "TASK_CREDENTIAL_REQUIRED",
      error: "job_id and session_id required to bind task credential",
    };
  }
  if (!isBrowserTaskCredentialFormat(input.credential)) {
    return {
      ok: false,
      status: 400,
      code: "TASK_CREDENTIAL_INVALID",
      error: "browser_task_credential format invalid",
    };
  }

  const key = browserTaskCredentialKey(job_id);
  const store = durableKv();
  const existing = await loadBrowserTaskCredentialRecord(job_id);
  if (existing) {
    if (existing.session_id !== session_id) {
      return {
        ok: false,
        status: 403,
        code: "TASK_CREDENTIAL_JOB_MISMATCH",
        error: "task credential binding belongs to another session",
      };
    }
    if (
      !verifyBrowserTaskCredentialMaterial(
        job_id,
        session_id,
        input.credential,
        existing.verifier,
      )
    ) {
      return {
        ok: false,
        status: 403,
        code: "TASK_CREDENTIAL_MISMATCH",
        error: "browser_task_credential does not match this job",
      };
    }
    return { ok: true, record: existing, outcome: "existing" };
  }

  const now = input.now ?? new Date().toISOString();
  const record: BrowserTaskCredentialRecord = {
    v: 1,
    job_id,
    session_id,
    verifier: issueBrowserTaskCredentialVerifier(job_id, session_id, input.credential),
    created_at: now,
    bound_at: now,
  };
  const set =   await store.set(key, record, {
    ex: KV_TTL.REPORT_JOB_ABSOLUTE,
    nx: true,
  });
  const back = await loadBrowserTaskCredentialRecord(job_id);
  if (!back) {
    return {
      ok: false,
      status: 503,
      code: "TASK_CREDENTIAL_INVALID",
      error: "task credential binding could not be confirmed",
    };
  }
  if (set !== "OK") {
    if (back.session_id !== session_id) {
      return {
        ok: false,
        status: 403,
        code: "TASK_CREDENTIAL_JOB_MISMATCH",
        error: "task credential binding belongs to another session",
      };
    }
    if (
      !verifyBrowserTaskCredentialMaterial(job_id, session_id, input.credential, back.verifier)
    ) {
      return {
        ok: false,
        status: 403,
        code: "TASK_CREDENTIAL_MISMATCH",
        error: "browser_task_credential does not match this job",
      };
    }
    return { ok: true, record: back, outcome: "existing" };
  }
  try {
    const { ensureReportLifecycleStarted } = await import("./report-data-lifecycle");
    await ensureReportLifecycleStarted({ job_id, session_id, now });
  } catch {
    // Lifecycle start is best-effort alongside credential bind.
  }
  return { ok: true, record: back, outcome: "bound" };
}

/**
 * Gate every task access path. Missing binding fail-closes (no account bypass).
 */
export async function assertBrowserTaskCredential(input: {
  job_id: string;
  session_id: string;
  credential: unknown;
}): Promise<TaskCredentialGateSuccess | TaskCredentialGateFailure> {
  const job_id = input.job_id.trim();
  const session_id = input.session_id.trim();
  if (!isBrowserTaskCredentialFormat(input.credential)) {
    return {
      ok: false,
      status: 401,
      code: "TASK_CREDENTIAL_REQUIRED",
      error: "browser_task_credential required",
    };
  }
  const record = await loadBrowserTaskCredentialRecord(job_id);
  if (!record) {
    return {
      ok: false,
      status: 403,
      code: "TASK_CREDENTIAL_MISSING_BINDING",
      error: "no browser task credential is bound to this job",
    };
  }
  if (record.session_id !== session_id) {
    return {
      ok: false,
      status: 403,
      code: "TASK_CREDENTIAL_JOB_MISMATCH",
      error: "task credential binding belongs to another session",
    };
  }
  if (
    !verifyBrowserTaskCredentialMaterial(
      job_id,
      session_id,
      input.credential,
      record.verifier,
    )
  ) {
    return {
      ok: false,
      status: 403,
      code: "TASK_CREDENTIAL_MISMATCH",
      error: "browser_task_credential does not match this job",
    };
  }
  return { ok: true, record };
}

/** Timing-safe helper for tests comparing two hex strings. */
export function safeEqualHexStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}
