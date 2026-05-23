"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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

/** Mobile / tablet: v5 start CTA after the marketing intro. */
export function SyncroMobileStartSection() {
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
      router.push("/syncro/payment");
    }
  }

  if (canUse.checking) {
    return (
      <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-4 text-center text-text-secondary">
        <p>{t("loading")}</p>
      </section>
    );
  }

  if (!canUse.isSupportedDevice) {
    return (
      <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-4 text-center">
        <p className="text-[15px] leading-8 text-text-secondary">{t("not_supported_device")}</p>
      </section>
    );
  }

  return (
    <section id="syncro-start" className="mx-auto w-full max-w-lg px-4 pb-16 pt-2">
      <div className="mt-6 grid gap-4">
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
    </section>
  );
}
