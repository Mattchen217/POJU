/**
 * M4 — request dispatch for the decision-authority API (append / freeze /
 * register_profile / head). Every failure is a typed `{ ok:false, code }` — the device
 * mirror only advances on `ok:true`.
 */

import { AuthoritySigningUnavailableError } from "./signing";
import { DcAuthorityError, appendDcLedgerCommit, assertSessionId, assertWriter, readLedgerHead } from "./ledger-store";
import { registerProfileForFreeze, sealFreeze } from "./freeze-authority";
import {
  headRefFromEntry,
  type DcAuthorityFailure,
  type DcLedgerAppendRequest,
  type DcLedgerHeadRef,
  type FreezeSealRequest,
} from "../types";

export type DecisionAuthorityAction = "append" | "freeze" | "register_profile" | "head";

export type DecisionAuthorityResult = { status: number; body: unknown };

function failureBody(e: unknown): { status: number; body: DcAuthorityFailure } {
  if (e instanceof DcAuthorityError) {
    const status =
      e.code === "DC_AUTHORITY_FORBIDDEN"
        ? 403
        : e.code === "DC_AUTHORITY_BAD_REQUEST" || e.code === "DC_LEDGER_SNAPSHOT_INVALID"
          ? 400
          : e.code === "DC_LEDGER_NOT_FOUND" || e.code === "FREEZE_NOT_REGISTERED" || e.code === "PROFILE_NOT_REGISTERED"
            ? 404
            : e.code.startsWith("PROFILE_BIRTH") || e.code === "PROFILE_CALC_FAILED"
              ? 422
              : 409;
    return {
      status,
      body: {
        ok: false,
        code: e.code,
        error: e.message,
        retryable: e.retryable,
        head: e.head ? headRefFromEntry(e.head) : null,
      },
    };
  }
  if (e instanceof AuthoritySigningUnavailableError) {
    return { status: 503, body: { ok: false, code: e.code, error: e.message, retryable: false } };
  }
  throw e;
}

export async function handleDecisionAuthority(
  action: DecisionAuthorityAction,
  body: Record<string, unknown>,
): Promise<DecisionAuthorityResult> {
  try {
    switch (action) {
      case "append": {
        const res = await appendDcLedgerCommit(body as unknown as DcLedgerAppendRequest);
        return { status: res.ok ? 200 : 409, body: res };
      }
      case "freeze": {
        const res = await sealFreeze(body as unknown as FreezeSealRequest);
        return { status: res.ok ? 200 : 409, body: res };
      }
      case "register_profile": {
        const res = await registerProfileForFreeze({
          session_id: body.session_id as string,
          writer_token: body.writer_token as string,
          freeze_receipt: body.freeze_receipt,
          profile_id: typeof body.profile_id === "string" ? body.profile_id : null,
          birth_info: body.birth_info,
        });
        return { status: 200, body: { ok: true, ...res } };
      }
      case "head": {
        assertSessionId(body.session_id);
        await assertWriter(body.session_id, body.writer_token);
        const head = await readLedgerHead(body.session_id);
        const ref: DcLedgerHeadRef | null = head ? headRefFromEntry(head) : null;
        return { status: 200, body: { ok: true, head: ref } };
      }
      default:
        return {
          status: 400,
          body: { ok: false, code: "DC_AUTHORITY_BAD_REQUEST", error: "unknown action", retryable: false },
        };
    }
  } catch (e) {
    return failureBody(e);
  }
}
