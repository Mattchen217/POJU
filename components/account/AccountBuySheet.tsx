"use client";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";

type Props = {
  open: boolean;
  onClose: () => void;
  /** flex — buy Passes; subscribe — change / start plan */
  mode: "flex" | "subscribe";
  currentPlan?: "personal" | "team" | null;
  /** Kept for call-site compat; plan switch scheduling lives in Payments paths */
  pendingPlan?: "personal" | "team" | null;
  periodEnd?: string | null;
  hasSubscription?: boolean;
  onPlanScheduled?: () => void;
};

/**
 * Thin wrapper — opens the unified PassPurchaseModal (center portal Pricing twin).
 * Divergent AccountBuySheet chrome retired (SoT 12-unified-buy-ui).
 */
export function AccountBuySheet({
  open,
  onClose,
  mode,
  currentPlan = null,
}: Props) {
  return (
    <PassPurchaseModal
      open={open}
      onClose={onClose}
      reason="choose"
      variant={mode === "flex" ? "flex" : "subscribe"}
      currentPlan={currentPlan}
    />
  );
}
