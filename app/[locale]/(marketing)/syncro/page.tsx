import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";
import { SyncroEnergyBall } from "@/components/syncro/syncro-energy-ball";
import { SyncroViewportBranch } from "@/components/syncro/syncro-viewport-branch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Syncro — pojulife",
  description:
    "Where AI meets a thousand years of wisdom. A light rhythm map you can open through your day — free on mobile.",
};

const USE_CASE_KEYS = ["before_matters", "pace_off", "daily_rhythm", "traveling", "poju_companion"] as const;

async function SyncroContent() {
  const t = await getTranslations("marketingSite.syncro");
  const whatShowsItems = t.raw("what_shows.items") as string[];
  const showsItems = t.raw("what_it_is.shows.items") as string[];
  const isntItems = t.raw("what_it_is.isnt.items") as string[];

  const heroCopy = {
    heading: t("hero.heading"),
    subtitle: t("hero.subtitle"),
    description: t("hero.description"),
    tagline: t("hero.tagline"),
    footnote: t("hero.footnote"),
    qrLabel: t("hero.qr_label"),
    qrAlt: t("hero.qr_label"),
    smsForm: {
      hint: t("hero.sms_label"),
      placeholder: t("hero.phone_placeholder"),
      phoneAriaLabel: t("hero.phone_placeholder"),
      buttonLabel: t("hero.sms_button"),
      smsBodyTemplate: t("hero.sms_body"),
    },
  };

  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <div className="mx-auto mt-2 w-full max-w-6xl px-4 md:px-8">
          <ArchiveReturnBanner />
        </div>

        <SyncroProductHero copy={heroCopy} />

        <section className="mx-auto mt-10 w-full max-w-6xl px-4 md:mt-14 md:px-8">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("what_shows.heading")}
          </h2>
          <div className="mx-auto mt-8 flex max-w-lg flex-col items-center">
            <div className="aspect-[9/19] w-full max-w-[280px] overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-b from-white/10 to-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="relative flex h-full w-full flex-col">
                <p className="absolute left-0 right-0 top-3 z-10 text-center text-[10px] uppercase tracking-[0.16em] text-text-dim">
                  {t("what_shows.preview_label")}
                </p>
                <SyncroEnergyBall className="min-h-0 flex-1 rounded-none" initialZoom={0.95} />
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-5 pt-10 text-center">
                  <p className="text-xs leading-6 text-text-secondary">{t("what_shows.preview_placeholder")}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-2xl space-y-4 text-center text-[15px] leading-8 text-text-secondary">
            <p>{t("what_shows.intro")}</p>
            <p className="text-left sm:text-center">
              {t("what_shows.items_intro")}
              <br />
              {whatShowsItems.map((item) => (
                <span key={item}>
                  ✦ {item}
                  <br />
                </span>
              ))}
            </p>
            <p>{t("what_shows.footnote")}</p>
          </div>
        </section>

        <section id="syncro-use-cases" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("use_cases.heading")}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {USE_CASE_KEYS.map((key) => (
              <article
                key={key}
                className="rounded-xl border border-white/10 bg-black/25 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-[15px] font-semibold text-cyan-100">{t(`use_cases.${key}.title`)}</p>
                <p className="mt-2 text-sm leading-7 text-text-secondary whitespace-pre-line">
                  {t(`use_cases.${key}.description`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("what_it_is.heading")}
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">{t("what_it_is.shows.title")}</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                {showsItems.map((item) => (
                  <li key={item}>
                    <span className="text-cyan-200">✦</span> {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">{t("what_it_is.isnt.title")}</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                {isntItems.map((item) => (
                  <li key={item}>
                    <span className="text-red-300/90">✗</span> {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="poju-cosmic-panel syncro-cta-panel mx-auto mt-8 w-full max-w-6xl px-4 py-8 text-center md:mt-10 md:px-8 md:py-10">
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
            <h2 className="text-[30px] font-semibold text-text-primary sm:text-[34px] md:text-[38px]">
              {t("always_free.heading")}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-8 text-text-secondary sm:text-base">{t("always_free.description")}</p>
            <Link
              href="/start?next=%2Fsyncro"
              className="mt-7 inline-flex w-full min-w-[220px] max-w-sm justify-center rounded-full border border-cyan-300/40 bg-cyan-400/20 px-8 py-3 text-sm font-semibold text-cyan-100 shadow-[0_10px_26px_rgba(34,211,238,0.2)] hover:bg-cyan-300/25 sm:w-auto sm:text-[15px] md:px-10 md:py-4 md:text-base"
            >
              {t("always_free.cta")}
            </Link>
            <Link
              href="/syncro/live"
              className="mt-3 inline-flex w-full min-w-[220px] max-w-sm justify-center rounded-full border border-white/25 bg-white/5 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto sm:text-[15px]"
            >
              Open Live Compass
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function SyncroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <SyncroViewportBranch>
        <SyncroContent />
      </SyncroViewportBranch>
    </Suspense>
  );
}
