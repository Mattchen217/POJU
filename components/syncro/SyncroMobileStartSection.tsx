"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { buildSyncroMobileUrl, SyncroDesktopQRModal } from "@/components/syncro/SyncroDesktopQRModal";
import { useRouter } from "@/i18n/navigation";
import {
  canUseSyncro,
  detectDeviceCapability,
  type DeviceCapability,
} from "@/lib/syncro/device-capability";
import { isFirstTimeFree } from "@/lib/syncro/device-usage";
import { hasOrientationSensor, isMobileDevice } from "@/lib/syncro/device-check";

function FeatureCard({
  icon,
  titleKey,
  descKey,
}: {
  icon: string;
  titleKey: "feature_realtime" | "feature_directional" | "feature_vr";
  descKey: "feature_realtime_desc" | "feature_directional_desc" | "feature_vr_desc";
}) {
  const t = useTranslations("syncro");
  return (
    <article className="rounded-xl border border-white/10 bg-black/25 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-2xl" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-cyan-100">{t(titleKey)}</h3>
      <p className="mt-2 text-sm leading-7 text-text-secondary">{t(descKey)}</p>
    </article>
  );
}

/** Marketing footer CTA: desktop → QR modal; mobile/tablet → task or payment. */
export function SyncroMobileStartSection() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = useTranslations("syncro");

  const [capability, setCapability] = useState<DeviceCapability | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isFreeAvailable, setIsFreeAvailable] = useState(false);
  const [isSupportedDevice, setIsSupportedDevice] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    if (searchParams.get("desktop") === "true" && capability?.isDesktop) {
      setShowQR(true);
    }
  }, [searchParams, capability]);

  async function init() {
    const [cap, free] = await Promise.all([detectDeviceCapability(), isFirstTimeFree("syncro")]);

    const touchMobile = isMobileDevice() || cap.isTablet;
    const orientation = cap.isTablet || (await hasOrientationSensor());

    setCapability(cap);
    setIsFreeAvailable(free);
    setIsSupportedDevice(canUseSyncro(cap) && touchMobile && orientation);
    setChecking(false);
  }

  function handleStart() {
    if (!capability) return;

    if (!canUseSyncro(capability)) {
      setShowQR(true);
      return;
    }

    if (!isSupportedDevice) return;

    if (isFreeAvailable) {
      router.push("/syncro/task?type=free&new=1");
    } else {
      router.push("/syncro/task?type=paid&new=1");
    }
  }

  const qrUrl = buildSyncroMobileUrl(locale);
  const ctaLabel = isFreeAvailable ? t("start_free") : t("start_paid");

  if (checking) {
    return (
      <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-4 text-center text-text-secondary">
        <p>{t("loading")}</p>
      </section>
    );
  }

  if (capability?.isDesktop) {
    return null;
  }

  if (!isSupportedDevice) {
    return (
      <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-4 text-center">
        <p className="text-[15px] leading-8 text-text-secondary">{t("not_supported_device")}</p>
      </section>
    );
  }

  return (
    <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-2">
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={handleStart}
          className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan inline-flex w-full min-w-[220px] max-w-sm justify-center px-8 py-3.5 text-[15px] font-semibold hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:w-auto md:px-10 md:py-4 md:text-base"
        >
          {ctaLabel}
        </button>
        <p className="mt-4 text-sm leading-7 text-text-dim">
          {isFreeAvailable ? t("free_note") : t("paid_note")}
        </p>
      </div>

      <div className="mt-10 grid gap-4">
        <FeatureCard icon="🧭" titleKey="feature_realtime" descKey="feature_realtime_desc" />
        <FeatureCard icon="⚡" titleKey="feature_directional" descKey="feature_directional_desc" />
        <FeatureCard icon="📹" titleKey="feature_vr" descKey="feature_vr_desc" />
      </div>

      {showQR ? <SyncroDesktopQRModal onClose={() => setShowQR(false)} url={qrUrl} /> : null}
    </section>
  );
}
