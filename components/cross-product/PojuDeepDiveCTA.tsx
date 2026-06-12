"use client";

import { useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import {
  resolveToolHandoffPayload,
  startPojuFromToolHandoff,
} from "@/lib/cross-product/start-poju-from-tool-handoff";
import { loadPojuToolHandoff } from "@/lib/poju/poju-tool-handoff";
import type { ToolName } from "@/lib/poju/types";
import "@/styles/poju-deep-dive.css";

type ProductId = ToolName;

type Props = {
  productId: ProductId;
  result_id: string;
  result_data: Record<string, unknown>;
};

export function PojuDeepDiveCTA({ productId, result_id, result_data }: Props) {
  const locale = useLocale();
  const t = useTranslations(`cross_product.${productId}_to_poju`);
  const [busy, setBusy] = useState(false);

  if (loadPojuToolHandoff(productId)) return null;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const payload = await resolveToolHandoffPayload(productId, result_id, result_data);
      const ok = await startPojuFromToolHandoff({
        tool: productId,
        resultId: result_id,
        resultData: payload,
        locale,
      });
      if (!ok) {
        alert(t("payment_failed"));
      }
    } catch (e) {
      console.error("[poju-deep-dive]", e);
      alert(t("payment_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="poju-deep-dive-cta">
      <div className="pdd-content">
        <div className="pdd-title">{t("title")}</div>
        <div className="pdd-description">{t("description")}</div>
        <div className="pdd-price-line">
          <span className="pdd-price">$9.99</span>
          <span className="pdd-period">/ 30 days</span>
        </div>
        <div className="pdd-value">{t("value_prop")}</div>
      </div>
      <button type="button" className="pdd-cta-btn" onClick={() => void handleClick()} disabled={busy}>
        <span>{busy ? t("starting") : t("button")}</span>
        <IconArrowRight size={18} stroke={1.75} aria-hidden />
      </button>
    </div>
  );
}
