"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { loadGlyphDrawSession, updateGlyphDrawSession } from "@/lib/glyph/glyph-draw-session";
import {
  clearGlyphPendingPaymentStorage,
  GLYPH_PENDING_ACTION_KEY,
  GLYPH_PENDING_ORDER_KEY,
  GLYPH_PENDING_READING_KEY,
} from "@/lib/glyph/start-glyph-unlock-payment";

type StepStatus = "verifying" | "unlocking" | "success" | "error";

function GlyphPaymentSuccessInner() {
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
          sessionStorage.getItem(GLYPH_PENDING_ACTION_KEY) ?? params.get("action") ?? "unlock";
        const orderId =
          sessionStorage.getItem(GLYPH_PENDING_ORDER_KEY) ?? params.get("order_id") ?? "";

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
        const readingId =
          sessionStorage.getItem(GLYPH_PENDING_READING_KEY) ?? params.get("reading_id") ?? "";
        if (!orderId || !readingId) throw new Error("Missing unlock context");

        const pendingFromStorage = sessionStorage.getItem("glyph_pending_question")?.trim();
        const existing = loadGlyphDrawSession(readingId);
        if (!existing) throw new Error("Reading session not found");

        const releasedQ =
          pendingFromStorage ||
          existing.pending_question?.trim() ||
          existing.question.trim();

        updateGlyphDrawSession(readingId, {
          unlock_status: "unlocked",
          unlock_via: "payment",
          question: releasedQ,
          pending_question: undefined,
        });

        clearGlyphPendingPaymentStorage();
        if (cancelled) return;
        setStatus("success");
        router.replace(`/glyph/reading/${readingId}`);
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
      {status === "unlocking" ? <p>Preparing your glyph reading...</p> : null}
      {status === "success" ? <p>Redirecting...</p> : null}
      {status === "error" ? (
        <div className="space-y-4">
          <p>Error: {error ?? "Unknown error"}</p>
          <button
            type="button"
            onClick={() => router.push("/glyph")}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
          >
            Back to Glyph
          </button>
        </div>
      ) : null}
    </main>
  );
}

function GlyphPaymentSuccessFallback() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center text-white">
      <p>Verifying payment...</p>
    </main>
  );
}

export default function GlyphPaymentSuccessPage() {
  return (
    <Suspense fallback={<GlyphPaymentSuccessFallback />}>
      <GlyphPaymentSuccessInner />
    </Suspense>
  );
}
