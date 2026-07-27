import { Suspense } from "react";

import { DsHomePage } from "@/components/ds/DsHomePage";
import { PaymentCancelToast } from "@/components/marketing/payment-cancel-toast";
import { buildClassicHomeCopy } from "@/lib/marketing/build-classic-home-copy";

export const dynamic = "force-dynamic";

/**
 * Legacy V1 marketing home — kept at a stable URL until the classic tree is retired.
 * Canonical public entry is `/` (V2 workspace landing).
 */
export default async function ClassicLandingPage() {
  const copy = await buildClassicHomeCopy();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--pj-bg-deep)]" />}>
      <PaymentCancelToast />
      <DsHomePage copy={copy} />
    </Suspense>
  );
}
