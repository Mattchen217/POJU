"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { checkGlyphUsage } from "@/lib/glyph/storage";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { getActivePOJUSessionsByDevice } from "@/lib/poju/session-manager";
import { isFirstTimeFree, type SyncroProduct } from "@/lib/syncro/device-usage";

import "@/styles/pwa-product-begin.css";

const MOCK_PENDING_QUESTION = "I'd like to begin a POJU session.";

export type BeginProductId = "poju" | "glyph" | "syncro" | "match";

export type BeginButtonProps = {
  productId: BeginProductId;
  price: string;
  /** When true, show free label if the device has not used the free tier yet. */
  freeFirstTime?: boolean;
};

export function BeginButton({ productId, price, freeFirstTime = true }: BeginButtonProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations(`${productId}.begin`);
  const [canUseFree, setCanUseFree] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!freeFirstTime) {
        if (!cancelled) {
          setCanUseFree(false);
          setReady(true);
        }
        return;
      }

      try {
        if (productId === "glyph") {
          const usage = await checkGlyphUsage();
          if (!cancelled) setCanUseFree(usage.can_use_free);
        } else {
          const free = await isFirstTimeFree(productId as SyncroProduct);
          if (!cancelled) setCanUseFree(free);
        }
      } catch {
        if (!cancelled) setCanUseFree(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [productId, freeFirstTime]);

  async function startPoju() {
    const deviceId = getPojuDeviceId();
    const active = await getActivePOJUSessionsByDevice(deviceId);
    if (active.length > 0) {
      active.sort((a, b) => b.last_interaction_at.getTime() - a.last_interaction_at.getTime());
      router.push(`/poju/session/${active[0]!.session_id}`);
      return;
    }

    sessionStorage.setItem("poju_pending_question", MOCK_PENDING_QUESTION);
    const returnUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/${locale}/poju/payment-success`
        : `/${locale}/poju/payment-success`;
    const pay = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product: "poju", locale, return_url: returnUrl }),
    });
    const p = (await pay.json()) as {
      checkout_url?: string;
      payment_url?: string;
      order_id?: string;
    };
    const target = p.payment_url ?? p.checkout_url;
    if (target) {
      if (p.order_id) sessionStorage.setItem("poju_pending_order_id", p.order_id);
      window.location.href = target;
    }
  }

  async function handleClick() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const free = freeFirstTime && canUseFree;

      switch (productId) {
        case "syncro":
          router.push(free ? "/syncro/task?type=free" : "/syncro/task?type=paid");
          break;
        case "glyph":
          router.push(free ? "/glyph/prepare?type=free" : "/glyph/prepare?type=paid");
          break;
        case "match":
          sessionStorage.setItem("match_session_type", free ? "free" : "paid");
          router.push(free ? "/match/select-a" : "/match/payment");
          break;
        case "poju":
          await startPoju();
          break;
        default:
          break;
      }
    } finally {
      setBusy(false);
    }
  }

  const priceLabel = freeFirstTime && canUseFree ? t("free_first_time") : price;

  return (
    <button
      type="button"
      className="begin-btn-large"
      disabled={!ready || busy}
      onClick={() => void handleClick()}
    >
      <span className="begin-btn-main">{busy ? "…" : t("start")}</span>
      {ready ? <span className="begin-btn-price">{priceLabel}</span> : null}
    </button>
  );
}
