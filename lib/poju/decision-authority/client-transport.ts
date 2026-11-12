/**
 * M4 — device → server transport for the decision-authority API.
 * Default is HTTP; an in-process transport can be installed (tests) via
 * `setDecisionAuthorityTransport`. Responses are typed; a transport never throws for a
 * server-side refusal, only for "no answer" (network / 5xx after retries).
 */

import type {
  DcAuthorityFailure,
  DcLedgerAppendRequest,
  DcLedgerAppendResponse,
  DcLedgerHeadRef,
  FreezeRecoverRequest,
  FreezeRecoverResponse,
  FreezeSealRequest,
  FreezeSealResponse,
  ProfileRegisterRequest,
  ProfileRegisterResponse,
} from "./types";

export type DecisionAuthorityTransport = {
  append(req: DcLedgerAppendRequest): Promise<DcLedgerAppendResponse>;
  freeze(req: FreezeSealRequest): Promise<FreezeSealResponse>;
  recoverFreeze(req: FreezeRecoverRequest): Promise<FreezeRecoverResponse>;
  registerProfile(req: ProfileRegisterRequest): Promise<ProfileRegisterResponse>;
  head(req: { session_id: string; writer_token: string }): Promise<
    { ok: true; head: DcLedgerHeadRef | null } | DcAuthorityFailure
  >;
};

export class DecisionAuthorityUnreachableError extends Error {
  readonly code = "DC_AUTHORITY_UNREACHABLE";
  constructor(message: string) {
    super(message);
    this.name = "DecisionAuthorityUnreachableError";
  }
}

const ENDPOINT = "/api/poju/decision-authority";
const ATTEMPTS = 3;

async function post<T>(action: string, body: object): Promise<T> {
  let lastError = "no response";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; retryable?: boolean }) | null;
      // Typed refusals are final; only "no answer" (5xx without a typed body) is retried.
      if (json && typeof json === "object" && "ok" in json && res.status < 500) return json;
      if (json && typeof json === "object" && "ok" in json && json.retryable === false) return json;
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  throw new DecisionAuthorityUnreachableError(`decision authority ${action} failed: ${lastError}`);
}

const httpTransport: DecisionAuthorityTransport = {
  append: (req) => post("append", req),
  freeze: (req) => post("freeze", req),
  recoverFreeze: (req) => post("recover_freeze", req),
  registerProfile: (req) => post("register_profile", req),
  head: (req) => post("head", req),
};

let active: DecisionAuthorityTransport = httpTransport;

export function getDecisionAuthorityTransport(): DecisionAuthorityTransport {
  return active;
}

/** Install a transport (tests: in-process server). `null` restores HTTP. */
export function setDecisionAuthorityTransport(t: DecisionAuthorityTransport | null): void {
  active = t ?? httpTransport;
}
