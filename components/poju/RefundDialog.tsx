"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { POJU_SESSION_PRICE_USD } from "@/lib/poju/session-payment";

export interface RefundApiSuccess {
  refund_id: string;
  amount: number;
  eta_days?: number;
}

export function RefundConfirmStage({
  onConfirm,
  onCancel,
  disabled,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("refund");
  const amountLabel = `$${POJU_SESSION_PRICE_USD.toFixed(2)}`;

  return (
    <div className="refund-confirm">
      <p className="confirm-text">{t("confirm_text")}</p>
      <div className="refund-info-box">
        <div>
          <span className="label">{t("amount_label")}</span>
          <span className="value">{amountLabel}</span>
        </div>
        <div>
          <span className="label">{t("eta_label")}</span>
          <span className="value">{t("eta_value")}</span>
        </div>
      </div>
      <p className="reassure">{t("reassure")}</p>
      <div className="refund-actions">
        <button type="button" onClick={onCancel} disabled={disabled} className="secondary">
          {t("go_back")}
        </button>
        <button type="button" onClick={onConfirm} disabled={disabled} className="primary">
          {t("confirm_refund")}
        </button>
      </div>
    </div>
  );
}

export function RefundProcessingStage() {
  const t = useTranslations("refund");
  return (
    <div className="refund-processing">
      <div className="spinner" aria-hidden />
      <p>{t("processing")}</p>
    </div>
  );
}

export function RefundSuccessStage({ refundData }: { refundData: RefundApiSuccess }) {
  const t = useTranslations("refund");
  const router = useRouter();
  const amount = `$${Number(refundData.amount).toFixed(2)}`;
  const days = String(refundData.eta_days ?? 3);

  return (
    <div className="refund-success">
      <div className="success-icon" aria-hidden>
        ✓
      </div>
      <h2>{t("success_title")}</h2>
      <p>{t("success_message", { amount, days })}</p>
      <div className="refund-id-box">
        <span className="label">{t("refund_id_label")}</span>
        <span className="value">{refundData.refund_id}</span>
      </div>
      <button type="button" onClick={() => router.push("/poju")} className="primary refund-home-btn">
        {t("back_to_home")}
      </button>
    </div>
  );
}

export function RefundErrorStage({
  error,
  onRetry,
  retrying,
}: {
  error: string | null;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const t = useTranslations("refund");

  return (
    <div className="refund-error">
      <div className="error-icon" aria-hidden>
        ✕
      </div>
      <h2>{t("error_title")}</h2>
      <p>{t("error_message")}</p>
      {error ? <div className="error-detail">{error}</div> : null}
      <div className="refund-actions">
        <button type="button" onClick={onRetry} disabled={retrying} className="primary">
          {t("retry")}
        </button>
        <a href="mailto:support@pojulife.com" className="email-btn">
          {t("contact_support")}
        </a>
      </div>
    </div>
  );
}
