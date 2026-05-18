/**
 * Step B pass-through stub (replaces deleted output-policy.ts until v5 prompt/policy in Part 2).
 */
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export type PolicyContext = {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
};

export function applyPojuOutputPolicies<T extends Record<string, unknown>>(parsed: T, _ctx: PolicyContext): T {
  return parsed;
}
