"use client";

import { Suspense } from "react";

import { CheckoutConfirmBanner } from "@/components/account/CheckoutConfirmBanner";
import { PassSpendToast } from "@/components/account/PassSpendToast";
import { ResumePendingPaywallUnlock } from "@/components/account/ResumePendingPaywallUnlock";
import { dispatchPassesCredited, PASSES_CREDITED_EVENT } from "@/lib/passes/pass-client-events";

/** @deprecated Import from `@/lib/passes/pass-client-events` */
export { PASSES_CREDITED_EVENT };

/**
 * Global checkout return handler for `/app` (any tab).
 * Credits Passes, resumes paywall unlock (auto-spend 1 Pass), shows spend toast.
 */
export function WorkspaceCheckoutConfirm() {
  return (
    <>
      <ResumePendingPaywallUnlock />
      <PassSpendToast />
      <div
        className="workspace-checkout-confirm"
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          zIndex: 90,
          width: "min(420px, 92vw)",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <Suspense fallback={null}>
            <CheckoutConfirmBanner
              onCredited={() => {
                dispatchPassesCredited();
              }}
            />
          </Suspense>
        </div>
      </div>
    </>
  );
}
