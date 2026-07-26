"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { routing } from "@/i18n/routing";

/**
 * Desktop: show full Syncro marketing page with a compact “open on phone” strip (not a full-page replacement).
 */
export function SyncroDesktopBanner() {
  const locale = useLocale();
  const syncroUrl = useMemo(() => {
    const path = locale === routing.defaultLocale ? "/syncro" : `/${locale}/syncro`;
    if (typeof window === "undefined") return `https://easternos.com${path}?ref=desktop_qr`;
    return `${window.location.origin}${path}?ref=desktop_qr`;
  }, [locale]);

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(syncroUrl)}`,
    [syncroUrl],
  );

  return (
    <div className="border-b border-cyan-400/20 bg-cyan-950/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-5 sm:flex-row sm:justify-between sm:px-8">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200/90">Syncro on mobile</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">
            The live compass needs your phone&apos;s sensors. Scan to open Syncro on mobile — you can still read the full
            introduction below.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="rounded-lg border border-white/12 bg-white p-1.5">
            <img src={qrSrc} alt="" width={120} height={120} className="h-[120px] w-[120px]" />
          </div>
          <p className="hidden max-w-[140px] text-xs leading-5 text-text-dim sm:block">Scan with your phone camera</p>
        </div>
      </div>
    </div>
  );
}
