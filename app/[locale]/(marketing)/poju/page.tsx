import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Compass, GitBranch, RefreshCcw, Search, UserRoundSearch } from "lucide-react";

import { PojuHowWorksRing } from "@/components/marketing/poju-how-works-ring";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";

export const metadata: Metadata = {
  title: "pojulife — Break your deadlock",
  description:
    "Where AI meets a thousand years of wisdom. Decision support for the questions that won't let you go.",
};
export const dynamic = "force-dynamic";

const WHEN_KEYS = ["stuck", "confused", "repeating", "depth", "direction"] as const;
const STEP_NUMS = ["1", "2", "3", "4", "5", "6"] as const;
const WHEN_CARD_META: Record<
  (typeof WHEN_KEYS)[number],
  {
    trigger: string;
    icon: typeof GitBranch;
  }
> = {
  stuck: { trigger: "BINARY DEADLOCK", icon: GitBranch },
  confused: { trigger: "INFO OVERLOAD", icon: Search },
  repeating: { trigger: "CYCLIC BEHAVIOR", icon: RefreshCcw },
  depth: { trigger: "SHALLOW FEEDBACK", icon: UserRoundSearch },
  direction: { trigger: "GUIDANCE REQ", icon: Compass },
};

export default async function PojuProductPage() {
  const t = await getTranslations("marketingSite.poju");
  const tNav = await getTranslations("nav");
  const howSteps = STEP_NUMS.map((k) => t(`how_it_works.steps.${k}`));
  const includedItems = t.raw("two_columns.included.items") as string[];
  const notIncludedItems = t.raw("two_columns.not_included.items") as string[];

  const heroCopy = {
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: t("hero.tagline"),
    ctaPrimary: t("hero.cta_primary"),
  };

  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <PojuProductHero copy={heroCopy} />

        <section id="when-to-poju" className="relative mx-auto mt-8 w-full max-w-6xl px-4 pt-5 pb-10 md:px-8 md:pb-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            {t("when_to_come.heading")}
          </h2>
          <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-0 overflow-hidden rounded-xl bg-black/15 sm:mt-7 md:mt-8 md:grid-cols-2 lg:grid-cols-3">
            {WHEN_KEYS.map((key, idx) => {
              const Icon = WHEN_CARD_META[key].icon;
              return (
                <article
                  key={key}
                  className={`min-h-[172px] border border-white/10 bg-black/35 px-5 py-4 backdrop-blur-[1px] sm:min-h-[188px] sm:px-6 sm:py-5 ${
                    idx === WHEN_KEYS.length - 1 ? "md:col-span-2" : ""
                  }`}
                >
                  <Icon className="h-4 w-4 text-purple-400" strokeWidth={2.2} aria-hidden />
                  <p className="mt-5 max-w-[24ch] text-[21px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[22px]">
                    {t(`when_to_come.${key}.title`)}
                  </p>
                  <p className="mt-2 max-w-[32ch] text-[18px] leading-[1.35] text-white/75 sm:text-[19px]">
                    {t(`when_to_come.${key}.description`)}
                  </p>
                  <p className="mt-4 font-mono text-[14px] uppercase tracking-[0.08em] text-white/30">
                    TRIGGER: {WHEN_CARD_META[key].trigger}
                  </p>
                </article>
              );
            })}
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
          <div className="poju-cosmic-panel poju-final-cta-outline-panel mx-auto mt-10 w-full max-w-6xl px-4 py-8 text-center md:px-8 md:py-10">
            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
              <Link
                href="/start?next=%2Fchat%3Ftoken%3Dui-preview"
                className="marketing-pill-outline-cta marketing-pill-outline-cta--violet inline-flex w-full min-w-[220px] max-w-sm px-8 py-3.5 text-[15px] hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:w-auto md:px-10 md:py-4 md:text-base"
              >
                {t("two_columns.cta")}
              </Link>
              <p className="mt-8 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8 md:text-base">
                {t("two_columns.footnote")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
