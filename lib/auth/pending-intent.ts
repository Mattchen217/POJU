import { z } from "zod";

export const PendingIntentSchema = z.object({
  plan: z.enum(["flex_pass", "personal_plan", "team_plan"]),
  quantity: z.number().int().min(1).max(99).optional(),
  /** Where to return after checkout (pathname+search). Set by paywall / login resume. */
  return_path: z.string().min(1).max(512).optional(),
});

export type PendingIntent = z.infer<typeof PendingIntentSchema>;

export const PENDING_INTENT_KEY = "pending_intent";

export const PLAN_PASS_CREDITS: Record<
  PendingIntent["plan"],
  { kind: "flex" | "subscription"; passes: number | "quantity"; stripeMode: "payment" | "subscription" }
> = {
  flex_pass: { kind: "flex", passes: "quantity", stripeMode: "payment" },
  personal_plan: { kind: "subscription", passes: 7, stripeMode: "subscription" },
  team_plan: { kind: "subscription", passes: 20, stripeMode: "subscription" },
};

export const PLAN_PRICES_CENTS: Record<PendingIntent["plan"], number> = {
  flex_pass: 999,
  personal_plan: 2990,
  team_plan: 5990,
};

export function normalizePlanType(plan: PendingIntent["plan"]): "flex_pass" | "personal" | "team" {
  if (plan === "personal_plan") return "personal";
  if (plan === "team_plan") return "team";
  return "flex_pass";
}

export function passesForCheckout(intent: PendingIntent): number {
  if (intent.plan === "flex_pass") return Math.max(1, intent.quantity ?? 1);
  if (intent.plan === "personal_plan") return 7;
  return 20;
}
