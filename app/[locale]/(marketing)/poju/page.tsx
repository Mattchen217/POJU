import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PojuHowWorksRing } from "@/components/marketing/poju-how-works-ring";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";

export const metadata: Metadata = {
  title: "POJU — Break your deadlock",
  description:
    "Guided by 2,000 years of Eastern wisdom, reinforced by modern science, delivered by an AI Agent that walks with you.",
};
export const dynamic = "force-dynamic";

const WHEN_KEYS = ["stuck", "confused", "repeating", "depth", "direction"] as const;
const STEP_NUMS = ["1", "2", "3", "4", "5", "6"] as const;

export default async function PojuProductPage() {
  const t = await getTranslations("marketingSite.poju");
  const tNav = await getTranslations("nav");
  const howSteps = STEP_NUMS.map((k) => t(`how_it_works.steps.${k}`));
  const includedItems = t.raw("two_columns.included.items") as string[];
  const notIncludedItems = t.raw("two_columns.not_included.items") as string[];

  const heroCopy = {
    kicker: tNav("poju"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: t("hero.tagline"),
    ctaPrimary: t("hero.cta_primary"),
    ctaSecondary: t("hero.cta_secondary"),
  };

  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <PojuProductHero copy={heroCopy} />

        <section id="when-to-poju" className="relative mx-auto mt-8 w-full max-w-6xl px-4 pt-5 pb-10 md:px-8 md:pb-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("when_to_come.heading")}
          </h2>
          <div className="mx-auto mt-8 max-w-3xl space-y-10 sm:mt-10 sm:space-y-12 md:mt-10">
            {WHEN_KEYS.map((key) => (
              <article key={key} className="text-left">
                <p className="text-[16px] font-semibold tracking-[0.06em] text-text-primary sm:text-lg md:text-xl">
                  <span className="text-purple-vivid">✦</span> {t(`when_to_come.${key}.title`)}
                </p>
                <p className="mt-3 pl-0 text-[15px] leading-8 text-text-secondary sm:pl-4 sm:text-base sm:leading-8 md:pl-6">
                  {t(`when_to_come.${key}.description`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-poju-works" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("how_it_works.heading")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[15px] leading-7 text-text-secondary sm:mt-6 sm:text-base md:mt-7">
            {t("how_it_works.subtitle")}
          </p>
          <PojuHowWorksRing steps={howSteps} />
          <ol className="sr-only">
            {howSteps.map((label, idx) => (
              <li key={label}>{`${idx + 1}. ${label}`}</li>
            ))}
          </ol>
          <p className="mx-auto mt-8 max-w-2xl text-center text-[15px] leading-8 text-text-secondary sm:mt-10 sm:text-base md:mt-10">
            {t("how_it_works.footer")}
          </p>
        </section>

        <section id="poju-cta" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("two_columns.heading")}
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                {t("two_columns.included.title")}
              </p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                {includedItems.map((item) => (
                  <li key={item}>
                    <span className="text-purple-vivid">✦</span> {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                {t("two_columns.not_included.title")}
              </p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                {notIncludedItems.map((item) => (
                  <li key={item}>
                    <span className="text-red-300/90">✗</span> {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <p className="mx-auto mt-10 max-w-xl text-center text-[15px] leading-8 text-text-secondary">
            {t("two_columns.tagline")}
          </p>
          <div className="poju-cosmic-panel mt-10 w-full px-2 py-8 text-center md:px-4 md:py-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
              <Link
                href="/chat?token=ui-preview"
                className="inline-flex w-full max-w-[300px] min-w-[220px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto md:px-10 md:py-4 md:text-base"
              >
                {t("two_columns.cta")}
              </Link>
              <p className="mt-6 max-w-xl text-sm leading-7 text-text-secondary sm:mt-7 sm:text-[15px] md:text-base">
                {t("two_columns.footnote")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
