"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";

import { buildSyncroMobileUrl } from "@/components/syncro/SyncroDesktopQRModal";
import { detectDeviceCapability } from "@/lib/syncro/device-capability";

type SyncroDesktopQrSectionProps = {
  qrLabel: string;
  qrAlt: string;
};

/** Desktop marketing: QR only — no SMS / send-link form. */
export function SyncroDesktopQrSection({ qrLabel, qrAlt }: SyncroDesktopQrSectionProps) {
  const locale = useLocale();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    void detectDeviceCapability().then((cap) => setIsDesktop(cap.isDesktop));
  }, []);

  const syncroUrl = useMemo(() => buildSyncroMobileUrl(locale), [locale]);

  if (!isDesktop) return null;

  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center">
      <div className="w-full rounded-2xl border border-white/12 bg-black/35 p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:p-6">
        <div className="mx-auto inline-flex rounded-lg border border-white/12 bg-white p-3">
          <QRCodeCanvas
            value={syncroUrl}
            size={240}
            bgColor="#ffffff"
            fgColor="#1a0a2e"
            level="M"
            aria-label={qrAlt}
          />
        </div>
        <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-text-dim">{qrLabel}</p>
      </div>
    </div>
  );
}
