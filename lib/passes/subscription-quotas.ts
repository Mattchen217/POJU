/** Monthly renewal quotas (no first-month bonus). */
export const SUBSCRIPTION_MONTHLY_QUOTA: Record<"personal" | "team", number> = {
  personal: 5,
  team: 15,
};

/** First-month grant on checkout (includes limited-time bonus). */
export const SUBSCRIPTION_FIRST_GRANT: Record<"personal" | "team", number> = {
  personal: 7,
  team: 20,
};
