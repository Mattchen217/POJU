"use client";

import dynamic from "next/dynamic";

/**
 * Client-only home chrome. `dynamic(..., { ssr: false })` is illegal in Server
 * Components (Next.js App Router) — keep those imports here.
 */
const ClassicQueryRedirect = dynamic(
  () =>
    import("@/components/marketing/classic-query-redirect").then((m) => ({
      default: m.ClassicQueryRedirect,
    })),
  { ssr: false },
);
const ResumePendingCheckout = dynamic(
  () =>
    import("@/components/auth/ResumePendingCheckout").then((m) => ({
      default: m.ResumePendingCheckout,
    })),
  { ssr: false },
);
const PaymentCancelToast = dynamic(
  () =>
    import("@/components/marketing/payment-cancel-toast").then((m) => ({
      default: m.PaymentCancelToast,
    })),
  { ssr: false },
);

export function HomeClientChrome() {
  return (
    <>
      <ClassicQueryRedirect />
      <ResumePendingCheckout />
      <PaymentCancelToast />
    </>
  );
}
