"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  loadMatchPreviewSession,
  patchMatchPreviewSession,
} from "@/lib/match/match-preview-session";
import {
  clearMatchPendingPaymentStorage,
  MATCH_PENDING_ACTION_KEY,
  MATCH_PENDING_ORDER_KEY,
  MATCH_PENDING_PREVIEW_KEY,
} from "@/lib/match/start-match-unlock-payment";

type StepStatus = "verifying" | "unlocking" | "success" | "error";

function MatchPaymentSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const [status, setStatus] = useState<StepStatus>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const action =
          sessionStorage.getItem(MATCH_PENDING_ACTION_KEY) ?? params.get("action") ?? "unlock";
        const orderId =
          sessionStorage.getItem(MATCH_PENDING_ORDER_KEY) ?? params.get("order_id") ?? "";

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

        if (action !== "unlock") {
          throw new Error("Unsupported payment action");
        }

        setStatus("unlocking");
        const previewId =
          sessionStorage.getItem(MATCH_PENDING_PREVIEW_KEY) ?? params.get("preview_id") ?? "";
        if (!orderId || !previewId) throw new Error("Missing unlock context");

        const pendingFromStorage = sessionStorage.getItem("match_pending_question")?.trim();
        const existing = loadMatchPreviewSession();
        if (!existing || existing.preview_id !== previewId) {
          throw new Error("Match preview session not found");
        }

        const releasedQ = pendingFromStorage || existing.pending_question?.trim() || "";
        patchMatchPreviewSession({
          unlock_status: "unlocked",
          unlock_via: "payment",
          pending_question: releasedQ || undefined,
        });
        if (releasedQ) {
          sessionStorage.setItem("match_relationship", releasedQ);
        }

        clearMatchPendingPaymentStorage();
        if (cancelled) return;
        setStatus("success");
        router.replace("/match/analyzing");
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
      {status === "unlocking" ? <p>Preparing your match analysis...</p> : null}
      {status === "success" ? <p>Redirecting...</p> : null}
      {status === "error" ? (
        <div className="space-y-4">
          <p>Error: {error ?? "Unknown error"}</p>
          <button
            type="button"
            onClick={() => router.push("/match")}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
          >
            Back to Match
          </button>
        </div>
      ) : null}
    </main>
  );
}

function MatchPaymentSuccessFallback() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center text-white">
      <p>Verifying payment...</p>
    </main>
  );
}

export default function MatchPaymentSuccessPage() {
  return (
    <Suspense fallback={<MatchPaymentSuccessFallback />}>
      <MatchPaymentSuccessInner />
    </Suspense>
  );
}
