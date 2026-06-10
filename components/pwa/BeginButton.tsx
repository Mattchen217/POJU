"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { PojuSessionPickerModal } from "@/components/poju/PojuSessionPickerModal";
import { checkGlyphUsage } from "@/lib/glyph/storage";
import {
  listActivePojuSessionsForPicker,
  type ActivePojuSessionPickerRow,
} from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import { redirectToPojuPayment } from "@/lib/poju/start-poju-payment";
import { runPOJUV4SessionMaintenance } from "@/lib/poju/v4-lifecycle";
import { isFirstTimeFree, type SyncroProduct } from "@/lib/syncro/device-usage";

import "@/styles/pwa-product-begin.css";

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
  const [pickerSessions, setPickerSessions] = useState<ActivePojuSessionPickerRow[] | null>(null);
  const [paying, setPaying] = useState(false);

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
    await runPOJUV4SessionMaintenance();
    const sessions = await listActivePojuSessionsForPicker();
    if (sessions.length === 0) {
      await redirectToPojuPayment(locale);
      return;
    }
    setPickerSessions(sessions);
  }

  async function startPojuPaymentFromPicker() {
    if (paying) return;
    setPaying(true);
    try {
      await redirectToPojuPayment(locale);
    } finally {
      setPaying(false);
    }
  }

  function openPojuSession(sessionId: string) {
    setPickerSessions(null);
    queueMicrotask(() => {
      router.push(`/poju/session/${sessionId}`);
    });
  }

  async function handleClick() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const free = freeFirstTime && canUseFree;

      switch (productId) {
        case "syncro":
          router.push(
            free ? "/syncro/task?type=free&new=1" : "/syncro/task?type=paid&new=1",
          );
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
    <>
      <button
        type="button"
        className="begin-btn-large"
        disabled={!ready || busy}
        onClick={() => void handleClick()}
      >
        <span className="begin-btn-main">{busy ? "…" : t("start")}</span>
        {ready ? <span className="begin-btn-price">{priceLabel}</span> : null}
      </button>

      {productId === "poju" && pickerSessions ? (
        <PojuSessionPickerModal
          sessions={pickerSessions}
          onClose={() => setPickerSessions(null)}
          onNewSession={() => void startPojuPaymentFromPicker()}
          onSelectSession={openPojuSession}
          newSessionBusy={paying}
        />
      ) : null}
    </>
  );
}
