"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { readFromToolPending, clearFromToolPending } from "@/lib/cross-product/from-tool-pending";
import { injectToolResultToPoju } from "@/lib/poju/inject-tool-result";
import {
  clearExpiryReminderSnooze,
  setExpiryReminderSnoozed,
} from "@/lib/poju/expiry-reminder";
import { createPOJUSession, extendPOJUV4Session, loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId, readPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import {
  clearPojuPendingPaymentStorage,
  POJU_PENDING_ACTION_KEY,
  POJU_PENDING_EXTEND_SESSION_KEY,
  POJU_PENDING_ORDER_KEY,
  POJU_PENDING_RESTORE_SESSION_KEY,
  readPendingPaymentSnoozeFlag,
} from "@/lib/poju/start-poju-session-payment";
import {
  bindPreviewProfileToSession,
  POJU_PENDING_UNLOCK_SESSION_KEY,
  POJU_UNLOCK_SURFACE_KEY,
  POJU_UNLOCK_SURFACE_WORKSPACE,
  POJU_WORKSPACE_UNLOCK_RITUAL_KEY,
} from "@/lib/poju/preview-unlock";
import { restorePOJUV4ArchivedSession } from "@/lib/poju/v4-lifecycle";

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
        const action =
          sessionStorage.getItem(POJU_PENDING_ACTION_KEY) ?? params.get("action") ?? "create";
        const orderId =
          sessionStorage.getItem(POJU_PENDING_ORDER_KEY) ?? params.get("order_id") ?? "";

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

        if (action === "extend") {
          const sessionId = sessionStorage.getItem(POJU_PENDING_EXTEND_SESSION_KEY);
          if (!orderId || !sessionId) throw new Error("Missing extend context");
          const next = await extendPOJUV4Session(sessionId, orderId);
          if (!next) throw new Error("Unable to extend session");
          if (readPendingPaymentSnoozeFlag()) {
            setExpiryReminderSnoozed(sessionId);
          } else {
            clearExpiryReminderSnooze(sessionId);
          }
          clearPojuPendingPaymentStorage();
          if (cancelled) return;
          setStatus("success");
          router.replace(`/poju/session/${sessionId}`);
          return;
        }

        if (action === "restore") {
          const sessionId = sessionStorage.getItem(POJU_PENDING_RESTORE_SESSION_KEY);
          if (!orderId || !sessionId) throw new Error("Missing restore context");
          const ok = await restorePOJUV4ArchivedSession(sessionId, orderId);
          if (!ok) throw new Error("Unable to restore session");
          clearPojuPendingPaymentStorage();
          if (cancelled) return;
          setStatus("success");
          router.replace(`/poju/session/${sessionId}`);
          return;
        }

        if (action === "unlock") {
          const sessionId =
            sessionStorage.getItem(POJU_PENDING_UNLOCK_SESSION_KEY) ?? params.get("session_id") ?? "";
          if (!orderId || !sessionId) throw new Error("Missing unlock context");

          const pendingFromStorage = sessionStorage.getItem("poju_pending_question")?.trim();
          const loaded = await loadPOJUSession(sessionId);
          if (loaded) {
            const pendingQ = pendingFromStorage || loaded.pending_question?.trim();
            await savePOJUSession({
              ...loaded,
              unlock_status: "unlocked",
              unlock_via: "payment",
              original_question: pendingQ || loaded.original_question,
              pending_question: pendingQ || loaded.pending_question,
            });
          }

          const unlockSurface = sessionStorage.getItem(POJU_UNLOCK_SURFACE_KEY);
          sessionStorage.removeItem(POJU_PENDING_UNLOCK_SESSION_KEY);
          sessionStorage.removeItem(POJU_PENDING_ORDER_KEY);
          sessionStorage.removeItem("poju_pending_question");
          sessionStorage.removeItem(POJU_PENDING_ACTION_KEY);
          sessionStorage.removeItem(POJU_UNLOCK_SURFACE_KEY);
          if (cancelled) return;
          setStatus("success");
          if (unlockSurface === POJU_UNLOCK_SURFACE_WORKSPACE) {
            sessionStorage.setItem(POJU_WORKSPACE_UNLOCK_RITUAL_KEY, sessionId);
            router.replace("/app?tab=poju");
            return;
          }
          router.replace(`/poju/session/${sessionId}/preparing?unlock=1`);
          return;
        }

        const fromRaw = params.get("q")?.trim();
        let fromQuery = "";
        if (fromRaw) {
          try {
            fromQuery = decodeURIComponent(fromRaw);
          } catch {
            fromQuery = fromRaw;
          }
        }
        let question = sessionStorage.getItem("poju_pending_question")?.trim() || fromQuery;
        const isMockOrder = orderId.startsWith("mockpoju_") || orderId.startsWith("mock-");
        if (!question && isMockOrder) {
          question = "I'd like to begin a POJU session.";
        }
        if (!orderId || !question) {
          throw new Error("Missing order context");
        }

        const pendingProfile = readPendingStoredProfileId();
        const sessionId = await createPOJUSession({
          payment_id: orderId,
          original_question: question,
          selected_stored_profile_id: pendingProfile,
        });
        const fromTool = readFromToolPending();
        if (fromTool) {
          await injectToolResultToPoju({
            session_id: sessionId,
            tool: fromTool.tool,
            result_id: fromTool.result_id,
            result_data: fromTool.result_data,
          });
          clearFromToolPending();
        }
        clearPendingStoredProfileId();

        sessionStorage.removeItem(POJU_PENDING_ORDER_KEY);
        sessionStorage.removeItem("poju_pending_question");
        if (cancelled) return;
        setStatus("success");
        if (pendingProfile?.trim()) {
          const local = await loadPOJUSession(sessionId);
          if (local) {
            const bound = await bindPreviewProfileToSession(local, pendingProfile.trim(), locale);
            await savePOJUSession(bound);
          }
          router.replace(
            `/poju/session/${sessionId}/preparing?profile=${encodeURIComponent(pendingProfile.trim())}`,
          );
        } else {
          router.replace(`/poju/session/${sessionId}/prepare`);
        }
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
