import { Suspense } from "react";

import { ResumePendingCheckout } from "@/components/auth/ResumePendingCheckout";
import { V2WorkspaceLandingPage } from "@/components/ds/v2/V2WorkspaceLandingPage";
import { ClassicQueryRedirect } from "@/components/marketing/classic-query-redirect";
import { PaymentCancelToast } from "@/components/marketing/payment-cancel-toast";

export const dynamic = "force-dynamic";

/**
 * Public home = V2 workspace landing (iframe → /v2-landing).
 * Classic marketing home remains at `/classic` until retired.
 */
export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--pj-bg-deep)]" />}>
      <ClassicQueryRedirect />
      <ResumePendingCheckout />
      <PaymentCancelToast />
      <V2WorkspaceLandingPage />
    </Suspense>
  );
}
