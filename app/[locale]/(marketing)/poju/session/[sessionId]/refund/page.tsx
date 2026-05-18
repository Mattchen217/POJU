"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  RefundConfirmStage,
  RefundErrorStage,
  RefundProcessingStage,
  RefundSuccessStage,
  type RefundApiSuccess,
} from "@/components/poju/RefundDialog";
import {
  deletePOJUSession,
  getPOJUSessionRecord,
  loadPOJUSession,
} from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { POJU_SESSION_PRICE_USD } from "@/lib/poju/session-payment";
import type { POJUSessionRecord } from "@/lib/db/poju-db";
import "@/styles/refund.css";

type RefundStage = "confirm" | "processing" | "success" | "error";

type PaymentMeta = Pick<POJUSessionRecord, "payment_id" | "payment_processor">;

export default function SessionRefundPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("refund");
  const tPrep = useTranslations("session_prep");

  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const [stage, setStage] = useState<RefundStage>("confirm");
  const [paymentMeta, setPaymentMeta] = useState<PaymentMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundData, setRefundData] = useState<RefundApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    void (async () => {
      try {
        const [state, row] = await Promise.all([
          loadPOJUSession(sessionId),
          getPOJUSessionRecord(sessionId),
        ]);
        if (!state || !row?.payment_id) {
          router.replace("/poju");
          return;
        }
        if (cancelled) return;
        setPaymentMeta({
          payment_id: row.payment_id,
          payment_processor: row.payment_processor ?? "dodopayments",
        });
      } catch (err) {
        console.error("[refund] Load failed:", err);
        router.replace("/poju");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  const handleConfirmRefund = useCallback(async () => {
    if (!paymentMeta || !sessionId) return;

    setStage("processing");
    setError(null);
    setRetrying(true);

    try {
      const response = await fetch("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          payment_id: paymentMeta.payment_id,
          payment_processor: paymentMeta.payment_processor,
          reason: "user_declined_profile",
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        refund_id?: string;
        amount?: number;
        eta_days?: number;
        error?: string;
        fallback?: string;
      };

      if (data.success && data.refund_id) {
        const successPayload: RefundApiSuccess = {
          refund_id: data.refund_id,
          amount: typeof data.amount === "number" ? data.amount : POJU_SESSION_PRICE_USD,
          eta_days: data.eta_days,
        };
        setRefundData(successPayload);
        setStage("success");
        await deletePOJUSession(sessionId);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("poju_pending_order_id");
          sessionStorage.removeItem("poju_pending_question");
        }
        clearPendingStoredProfileId();
      } else {
        setError(data.error ?? data.fallback ?? t("error_message"));
        setStage("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    } finally {
      setRetrying(false);
    }
  }, [paymentMeta, sessionId, t]);

  function handleCancel() {
    router.push(`/poju/session/${sessionId}/prepare`);
  }

  if (loading) {
    return <div className="refund-page-loading">{tPrep("loading")}</div>;
  }

  if (!paymentMeta) return null;

  return (
    <main className="refund-page">
      <div className="refund-content">
        <h1 className="refund-title">{t("title")}</h1>

        {stage === "confirm" ? (
          <RefundConfirmStage
            onConfirm={() => void handleConfirmRefund()}
            onCancel={handleCancel}
            disabled={retrying}
          />
        ) : null}

        {stage === "processing" ? <RefundProcessingStage /> : null}

        {stage === "success" && refundData ? <RefundSuccessStage refundData={refundData} /> : null}

        {stage === "error" ? (
          <RefundErrorStage
            error={error}
            onRetry={() => void handleConfirmRefund()}
            retrying={retrying}
          />
        ) : null}
      </div>
    </main>
  );
}
