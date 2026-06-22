"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  RefundConfirmStage,
  RefundErrorStage,
  RefundProcessingStage,
  RefundSuccessStage,
  type RefundApiSuccess,
} from "@/components/poju/RefundDialog";
import { deletePOJUSession, getPOJUSessionRecord } from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { POJU_SESSION_PRICE_USD } from "@/lib/poju/session-payment";
import type { POJUSessionRecord } from "@/lib/db/poju-db";
import "@/styles/refund.css";

type RefundStage = "confirm" | "processing" | "success" | "error";

type PaymentMeta = Pick<POJUSessionRecord, "payment_id" | "payment_processor">;

export type RefundOfferActionProps = {
  sessionId: string;
  /** Compact inline bar above composer (default). */
  variant?: "inline" | "message";
  onDismiss?: () => void;
};

/** User-initiated refund entry — reuses RefundDialog stages + `/api/payments/refund`. */
export function RefundOfferAction({
  sessionId,
  variant = "inline",
  onDismiss,
}: RefundOfferActionProps) {
  const t = useTranslations("poju.refund_offer");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stage, setStage] = useState<RefundStage>("confirm");
  const [paymentMeta, setPaymentMeta] = useState<PaymentMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [refundData, setRefundData] = useState<RefundApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!dialogOpen || paymentMeta || !sessionId) return;
    let cancelled = false;
    setLoadingMeta(true);
    void (async () => {
      try {
        const row = await getPOJUSessionRecord(sessionId);
        if (!row?.payment_id) {
          if (!cancelled) setError(t("no_payment"));
          return;
        }
        if (!cancelled) {
          setPaymentMeta({
            payment_id: row.payment_id,
            payment_processor: row.payment_processor ?? "dodopayments",
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, paymentMeta, sessionId, t]);

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
        setRefundData({
          refund_id: data.refund_id,
          amount: typeof data.amount === "number" ? data.amount : POJU_SESSION_PRICE_USD,
          eta_days: data.eta_days,
        });
        setStage("success");
        await deletePOJUSession(sessionId);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("poju_pending_order_id");
          sessionStorage.removeItem("poju_pending_question");
        }
        clearPendingStoredProfileId();
      } else {
        setError(data.error ?? data.fallback ?? t("error_fallback"));
        setStage("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    } finally {
      setRetrying(false);
    }
  }, [paymentMeta, sessionId, t]);

  function openDialog() {
    setDialogOpen(true);
    setStage("confirm");
    setRefundData(null);
    setError(null);
  }

  function closeDialog() {
    setDialogOpen(false);
    if (stage === "success") {
      router.push("/poju");
    }
  }

  return (
    <>
      <div className={variant === "inline" ? "refund-offer-prompt" : "refund-offer-prompt refund-offer-prompt--message"}>
        <p className="refund-offer-prompt__text">{t("hint")}</p>
        <div className="refund-offer-prompt__actions">
          <button type="button" className="refund-offer-prompt__primary" onClick={openDialog}>
            {t("open_refund")}
          </button>
          {onDismiss ? (
            <button type="button" className="refund-offer-prompt__secondary" onClick={onDismiss}>
              {t("continue_chat")}
            </button>
          ) : null}
        </div>
      </div>

      {dialogOpen ? (
        <div className="refund-offer-overlay" role="dialog" aria-modal="true" aria-labelledby="refund-offer-title">
          <div className="refund-offer-modal">
            <h2 id="refund-offer-title" className="refund-offer-modal__title">
              {t("modal_title")}
            </h2>
            {loadingMeta && stage === "confirm" ? <p>{t("loading")}</p> : null}
            {stage === "confirm" && paymentMeta ? (
              <RefundConfirmStage
                onConfirm={() => void handleConfirmRefund()}
                onCancel={closeDialog}
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
        </div>
      ) : null}
    </>
  );
}
