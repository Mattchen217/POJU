"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { useRouter } from "@/i18n/navigation";
import { detectDevice } from "@/lib/device-detection";
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

export function SyncroHomePage() {
  const router = useRouter();
  const t = useTranslations("syncro");

  const [canUse, setCanUse] = useState<{
    isFreeAvailable: boolean;
    isSupportedDevice: boolean;
    checking: boolean;
  }>({
    isFreeAvailable: false,
    isSupportedDevice: false,
    checking: true,
  });

  useEffect(() => {
    void checkAccess();
  }, []);

  async function checkAccess() {
    const free = await isFirstTimeFree("syncro");
    const d = detectDevice();
    const touchMobile = isMobileDevice() || d.type === "tablet";
    const orientation = await hasOrientationSensor();

    setCanUse({
      isFreeAvailable: free,
      isSupportedDevice: touchMobile && orientation,
      checking: false,
    });
  }

  function handleStart() {
    if (canUse.isFreeAvailable) {
      router.push("/syncro/task?type=free");
    } else {
      router.push("/syncro/task?type=paid");
    }
  }

  if (canUse.checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-deep text-text-secondary">
        <p>{t("loading")}</p>
      </main>
    );
  }

  if (!canUse.isSupportedDevice) {
    return (
      <main className="min-h-screen bg-bg-deep px-4 py-16 text-center text-text-body">
        <h1 className="text-2xl font-semibold text-text-primary">SYNCRO</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-8 text-text-secondary">{t("not_supported_device")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-deep text-text-body">
      <div className="mx-auto w-full max-w-lg px-4 pb-12 pt-6">
        <ArchiveReturnBanner />

        <header className="mt-6 text-center">
          <h1 className="text-3xl font-semibold tracking-[0.2em] text-text-primary">SYNCRO</h1>
          <p className="mt-3 text-lg text-cyan-100/90">{t("subtitle")}</p>
          <p className="mt-4 text-[15px] leading-8 text-text-secondary">{t("description")}</p>
        </header>

        <div className="mt-10 grid gap-4">
          <FeatureCard icon="🧭" titleKey="feature_realtime" descKey="feature_realtime_desc" />
          <FeatureCard icon="⚡" titleKey="feature_directional" descKey="feature_directional_desc" />
          <FeatureCard icon="📹" titleKey="feature_vr" descKey="feature_vr_desc" />
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={handleStart}
            className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan inline-flex w-full min-w-[220px] max-w-sm justify-center px-8 py-3.5 text-[15px] font-semibold hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:w-auto md:px-10 md:py-4 md:text-base"
          >
            {canUse.isFreeAvailable ? t("start_free") : t("start_paid")}
          </button>
          <p className="mt-4 text-sm leading-7 text-text-dim">
            {canUse.isFreeAvailable ? t("free_note") : t("paid_note")}
          </p>
        </div>
      </div>
    </main>
  );
}
