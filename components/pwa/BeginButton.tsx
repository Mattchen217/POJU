"use client";

import { useEffect, useMemo, useState } from "react";
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
  /** Match desktop marketing hero CTA copy instead of generic Begin / free_first_time. */
  useMarketingLabels?: boolean;
};

export function BeginButton({
  productId,
  price,
  freeFirstTime = true,
  useMarketingLabels = false,
}: BeginButtonProps) {
  const router = useRouter();
  const locale = useLocale();
  const tBegin = useTranslations(`${productId}.begin`);
  const tPojuHero = useTranslations("marketingSite.poju.hero");
  const tGlyphHero = useTranslations("marketingSite.glyph.hero");
  const tGlyphProduct = useTranslations("glyph");
  const tSyncroHero = useTranslations("marketingSite.syncro.hero");
  const tMatchHome = useTranslations("match.home");
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

  const labels = useMemo(() => {
    const eligibleFree = freeFirstTime && canUseFree;

    if (!useMarketingLabels) {
      return {
        main: tBegin("start"),
        sub: eligibleFree ? tBegin("free_first_time") : price,
      };
    }

    switch (productId) {
      case "poju":
        return { main: tPojuHero("cta_primary"), sub: null as string | null };
      case "glyph":
        return {
          main: eligibleFree ? tGlyphHero("cta") : tGlyphProduct("start_paid"),
          sub: null as string | null,
        };
      case "syncro":
        return { main: tSyncroHero("cta"), sub: null as string | null };
      case "match":
        return { main: tMatchHome("cta"), sub: tMatchHome("billing_notice") };
      default:
        return { main: tBegin("start"), sub: price };
    }
  }, [
    canUseFree,
    freeFirstTime,
    price,
    productId,
    tBegin,
    tGlyphHero,
    tGlyphProduct,
    tMatchHome,
    tPojuHero,
    tSyncroHero,
    useMarketingLabels,
  ]);

  async function startPoju() {
    void runPOJUV4SessionMaintenance().catch(() => {});
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
          sessionStorage.setItem("syncro_session_type", "free");
          router.push("/syncro/prepare?new=1");
          break;
        case "glyph":
          router.push("/glyph/prepare");
          break;
        case "match":
          sessionStorage.setItem("match_session_type", "free");
          router.push("/match/select-a");
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

  return (
    <>
      <button
        type="button"
        className="begin-btn-large"
        disabled={!ready || busy}
        onClick={() => void handleClick()}
      >
        <span className="begin-btn-main">{busy ? "…" : labels.main}</span>
        {ready && labels.sub ? <span className="begin-btn-price">{labels.sub}</span> : null}
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
