"use client";

import { useTranslations } from "next-intl";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";

type SyncroDesktopOnlyViewProps = {
  /** After full marketing page — skip duplicate page chrome. */
  embedded?: boolean;
};

export function SyncroDesktopOnlyView({ embedded = false }: SyncroDesktopOnlyViewProps) {
  const t = useTranslations("syncro");

  const body = (
    <div className={embedded ? "border-t border-white/10 pt-10 md:pt-12" : "mt-8 md:mt-12"}>
      <div className="text-center">
        {!embedded ? (
          <>
            <h1 className="text-3xl font-semibold tracking-[0.18em] text-text-primary sm:text-4xl">SYNCRO</h1>
            <p className="mt-4 text-lg text-cyan-100/90">{t("subtitle")}</p>
          </>
        ) : (
          <h2 className="text-xl font-semibold tracking-[0.12em] text-cyan-100/95 sm:text-2xl">
            {t("desktop_section_heading")}
          </h2>
        )}
        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-8 text-text-secondary">{t("desktop_message_1")}</p>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-8 text-text-secondary">{t("desktop_message_2")}</p>

        <ul className="mx-auto mt-10 max-w-lg space-y-4 text-left text-sm leading-7 text-text-secondary sm:text-center">
          <li>{t("feature_realtime_desc")}</li>
          <li>{t("feature_directional_desc")}</li>
          <li>{t("feature_vr_desc")}</li>
        </ul>

        <p className="mt-10 text-sm font-medium text-cyan-200/80">{t("open_on_mobile_hint")}</p>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <section id="syncro-start" className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-8">
        {body}
      </section>
    );
  }

  return (
    <main className="bg-bg-deep text-text-body">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-8">
        <ArchiveReturnBanner />
        {body}
      </div>
    </main>
  );
}
