"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { createPOJUSession } from "@/lib/poju/session-manager";

type StepStatus = "verifying" | "creating" | "success" | "error";

function PojuPaymentSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const [status, setStatus] = useState<StepStatus>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const orderId = sessionStorage.getItem("poju_pending_order_id") ?? params.get("order_id") ?? "";
        const fromRaw = params.get("q")?.trim();
        let fromQuery = "";
        if (fromRaw) {
          try {
            fromQuery = decodeURIComponent(fromRaw);
          } catch {
            fromQuery = fromRaw;
          }
        }
        let question =
          sessionStorage.getItem("poju_pending_question")?.trim() || fromQuery;
        const isMockOrder =
          orderId.startsWith("mockpoju_") || orderId.startsWith("mock-");
        if (!question && isMockOrder) {
          question = "I'd like to begin a POJU session.";
        }
        if (!orderId || !question) {
          throw new Error("Missing order context");
        }

        setStatus("verifying");
        const verifyRes = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });
        const verification = (await verifyRes.json()) as { valid?: boolean };
        if (!verifyRes.ok || !verification.valid) {
          throw new Error("Payment verification failed");
        }

        setStatus("creating");
        const sessionId = await createPOJUSession({
          payment_id: orderId,
          original_question: question,
        });

        sessionStorage.removeItem("poju_pending_order_id");
        sessionStorage.removeItem("poju_pending_question");
        if (cancelled) return;
        setStatus("success");
        router.replace(`/${locale}/poju/session/${sessionId}`);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "unknown_error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, params, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center text-white">
      {status === "verifying" ? <p>Verifying payment...</p> : null}
      {status === "creating" ? <p>Setting up your POJU session...</p> : null}
      {status === "success" ? <p>Redirecting...</p> : null}
      {status === "error" ? (
        <div className="space-y-4">
          <p>Error: {error ?? "Unknown error"}</p>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/poju`)}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
          >
            Back to POJU
          </button>
        </div>
      ) : null}
    </main>
  );
}

function PojuPaymentSuccessFallback() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center text-white">
      <p>Verifying payment...</p>
    </main>
  );
}

/** `useSearchParams()` requires Suspense during static prerender (Next.js 14+). */
export default function PojuPaymentSuccessPage() {
  return (
    <Suspense fallback={<PojuPaymentSuccessFallback />}>
      <PojuPaymentSuccessInner />
    </Suspense>
  );
}
