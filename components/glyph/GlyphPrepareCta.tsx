"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { checkGlyphUsage } from "@/lib/glyph/storage";

type Props = {
  className?: string;
  /** Hero / final CTA pill styles from marketing pages */
  variant?: "hero" | "final";
};

export function GlyphPrepareCta({ className = "", variant = "hero" }: Props) {
  const router = useRouter();
  const t = useTranslations("glyph");
  const [hasUsedFree, setHasUsedFree] = useState(false);
  const [checking, setChecking] = useState(true);
  const [paidBusy, setPaidBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const usage = await checkGlyphUsage();
        setHasUsedFree(usage.has_used_free);
      } catch (e) {
        console.error(e);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const pillClass =
    variant === "final"
      ? "pj-pill-outline pj-pill-outline--violet mt-7 inline-flex w-full min-w-[220px] max-w-sm justify-center px-8 py-3.5 text-[15px] md:px-10 md:py-4 md:text-base"
      : "pj-pill-outline pj-pill-outline--violet inline-flex min-w-[200px] justify-center px-8 py-3.5 text-[15px] md:px-10 md:py-4 md:text-base";

  function handleStartFree() {
    router.push("/glyph/prepare?type=free");
  }

  async function handleStartPaid() {
    setPaidBusy(true);
    try {
      const res = await fetch("/api/payments/create", { method: "POST" });
      if (!res.ok) {
        router.push("/glyph/prepare?type=paid");
        return;
      }
      await fetch("/api/glyph/quota", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "consume_paid" }),
      });
      router.push("/glyph/prepare?type=paid");
    } catch {
      router.push("/glyph/prepare?type=paid");
    } finally {
      setPaidBusy(false);
    }
  }

  if (checking) {
    return (
      <button type="button" disabled className={`${pillClass} opacity-60 ${className}`}>
        {t("loading")}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={paidBusy}
      onClick={() => (hasUsedFree ? void handleStartPaid() : handleStartFree())}
      className={`${pillClass} ${className}`}
    >
      {hasUsedFree ? (paidBusy ? t("starting_paid") : t("start_paid")) : t("start_free")}
    </button>
  );
}
