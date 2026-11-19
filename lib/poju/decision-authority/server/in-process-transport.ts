/**
 * Server-only Decision Authority transport.
 * Authoritative chat / Session CAS must not self-fetch `/api/poju/decision-authority`
 * with a relative URL. This module calls `handleDecisionAuthority` in-process under
 * AsyncLocalStorage so concurrent sessions never share a swapped global transport.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import {
  bindDecisionAuthorityTransportRuntime,
  type DecisionAuthorityTransport,
} from "@/lib/poju/decision-authority/client-transport";
import {
  handleDecisionAuthority,
  type DecisionAuthorityAction,
} from "@/lib/poju/decision-authority/server/service";

function wire<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInProcessDecisionAuthorityTransport(): DecisionAuthorityTransport {
  const call = async <T>(action: DecisionAuthorityAction, body: object): Promise<T> => {
    const res = await handleDecisionAuthority(action, wire<Record<string, unknown>>(body));
    return wire<T>(res.body);
  };
  return {
    append: (req) => call("append", req),
    freeze: (req) => call("freeze", req),
    recoverFreeze: (req) => call("recover_freeze", req),
    registerProfile: (req) => call("register_profile", req),
    head: (req) => call("head", req),
  };
}

const requestTransportAls = new AsyncLocalStorage<DecisionAuthorityTransport>();

bindDecisionAuthorityTransportRuntime({
  getRequestTransport: () => requestTransportAls.getStore() ?? null,
});

/** Run `fn` with the in-process Decision Authority transport for this async chain only. */
export function runWithInProcessDecisionAuthority<T>(
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(
    requestTransportAls.run(createInProcessDecisionAuthorityTransport(), fn),
  );
}
