/**
 * scripts/** only — routes the device-side decision-authority transport straight into
 * the server dispatcher (same handler the API route uses), with a JSON round-trip so
 * nothing is shared by reference across the "wire". Never imported from lib/ or app/.
 */

import {
  setDecisionAuthorityTransport,
  type DecisionAuthorityTransport,
} from "@/lib/poju/decision-authority/client-transport";
import {
  handleDecisionAuthority,
  type DecisionAuthorityAction,
} from "@/lib/poju/decision-authority/server/service";

function wire<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function inProcessDecisionAuthorityTransport(): DecisionAuthorityTransport {
  const call = async <T>(action: DecisionAuthorityAction, body: object): Promise<T> => {
    const res = await handleDecisionAuthority(action, wire<Record<string, unknown>>(body));
    return wire<T>(res.body);
  };
  return {
    append: (req) => call("append", req),
    freeze: (req) => call("freeze", req),
    registerProfile: (req) => call("register_profile", req),
    head: (req) => call("head", req),
  };
}

export function installInProcessDecisionAuthority(): void {
  setDecisionAuthorityTransport(inProcessDecisionAuthorityTransport());
}
