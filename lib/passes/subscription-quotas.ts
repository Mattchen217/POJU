/** Monthly renewal quotas (no first-month bonus). */
export const SUBSCRIPTION_MONTHLY_QUOTA: Record<"personal" | "team" | "duo", number> = {
  personal: 5,
  /** Duo = marketed「双人共同决策订阅」; same monthly pool as personal, 2 seats. */
  duo: 5,
  team: 15,
};

/** First-month grant on checkout (includes limited-time bonus). */
export const SUBSCRIPTION_FIRST_GRANT: Record<"personal" | "team" | "duo", number> = {
  personal: 7,
  /** Product copy: 5 PASS/mo shared; first month also 5 (no bonus). */
  duo: 5,
  team: 20,
};
