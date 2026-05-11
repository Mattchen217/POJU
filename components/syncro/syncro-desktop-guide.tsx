"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import { routing } from "@/i18n/routing";

/**
 * 桌面端打开 Syncro：扫码到手机（POJU_v4.0_Batch2_Patch.md §5.7）
 */
export function SyncroDesktopGuide() {
  const locale = useLocale();
  const syncroUrl = useMemo(() => {
    const path = locale === routing.defaultLocale ? "/syncro" : `/${locale}/syncro`;
    if (typeof window === "undefined") return `https://pojulife.com${path}?ref=desktop_qr`;
    return `${window.location.origin}${path}?ref=desktop_qr`;
  }, [locale]);

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(syncroUrl)}`,
    [syncroUrl],
  );

  return (
    <main className="min-h-screen bg-bg-deep px-4 py-12 text-text-body md:px-8">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-[32px] font-semibold text-text-primary sm:text-[38px]">Syncro</h1>
        <p className="mt-3 text-lg text-cyan-100/95">See your natural rhythms.</p>

        <div className="mx-auto mt-10 max-w-md border-t border-white/10 pt-10 text-left">
          <h2 className="text-center text-xl font-semibold text-text-primary">Syncro lives on your phone</h2>
          <p className="mt-4 text-[15px] leading-8 text-text-secondary">
            Syncro is a directional compass — it needs a real compass and your position. Your phone has both.
          </p>
        </div>

        <section className="mx-auto mt-10 max-w-md border-t border-white/10 pt-10">
          <h2 className="text-lg font-semibold text-text-primary">Open Syncro on your phone</h2>
          <div className="mx-auto mt-6 flex justify-center">
            <div className="rounded-xl border border-white/12 bg-white p-3">
              <img src={qrSrc} alt="QR code to open Syncro on mobile" width={220} height={220} className="h-auto w-[220px]" />
            </div>
          </div>
          <p className="mt-4 text-sm text-text-dim">Scan with your phone camera</p>
          <p className="mt-6 break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-xs text-text-secondary">
            {syncroUrl}
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-md border-t border-white/10 pt-10 text-left">
          <h2 className="text-center text-lg font-semibold text-text-primary">What Syncro does</h2>
          <p className="mt-4 text-[15px] leading-8 text-text-secondary">
            <strong className="text-text-primary">Browse mode (free):</strong> lay your phone flat, see eight directions and how they
            align for the current two-hour window.
          </p>
          <p className="mt-3 text-[15px] leading-8 text-text-secondary">
            <strong className="text-text-primary">AR task mode ($1.99):</strong> ritual calibration, camera, and task-specific guidance
            across five windows — coming in a later release.
          </p>
        </section>
      </div>
    </main>
  );
}
