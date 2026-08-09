"use client";

import { Suspense } from "react";

import { CheckoutConfirmBanner } from "@/components/account/CheckoutConfirmBanner";

/** Dispatched after Passes are credited so account / paywall UIs can refresh. */
export const PASSES_CREDITED_EVENT = "poju:passes-credited";

/**
 * Global checkout return handler for `/app` (any tab).
 * Must mount once at workspace shell — not only on the profile tab —
 * so paywall → Stripe → back-to-current-page still credits Passes.
 */
export function WorkspaceCheckoutConfirm() {
  return (
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
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event(PASSES_CREDITED_EVENT));
              }
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
