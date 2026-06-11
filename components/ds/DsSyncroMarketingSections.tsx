import { CalendarCheck, Gauge, Link2, Plane, Sun } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { MarketingIconChip } from "@/components/marketing/marketing-icon-chip";
import { SyncroMarketingPhonePreview } from "@/components/marketing/syncro-marketing-phone-preview";
import { SyncroPricingCta } from "@/components/marketing/syncro-pricing-cta";
import {
  DsBand,
  DsCurrentRow,
  DsGlassCard,
  DsMutedCard,
  DsSectionHeading,
} from "@/components/ds/primitives";

const STEP_GRADIENTS = ["#60a5fa", "#b565f0", "#e879f9", "#f472b6"] as const;
const CURRENT_COLORS = [
  "var(--pj-open)",
  "var(--pj-following)",
  "var(--pj-still)",
  "var(--pj-cross)",
  "var(--pj-under)",
] as const;

const USE_CASE_KEYS = ["before_matters", "pace_off", "daily_rhythm", "traveling", "poju_companion"] as const;
const USE_CASE_ICONS = [CalendarCheck, Gauge, Sun, Plane, Link2] as const;

/** DS syncro.jsx sections — added alongside legacy Syncro marketing blocks */
export async function DsSyncroMarketingSections() {
  const t = await getTranslations("marketingSite.syncro");
  const whatShowsItems = t.raw("what_shows.items") as string[];
  const showsItems = t.raw("what_it_is.shows.items") as string[];
  const isntItems = t.raw("what_it_is.isnt.items") as string[];
  const currents = t.raw("five_currents.items") as { name: string; desc: string }[];

  return (
    <>
      <DsBand id="syncro-how-ds">
        <DsSectionHeading>{t("how_it_works.heading")}</DsSectionHeading>
        <div className="ds-grid-auto-210 ds-mt-36">
          {(["step_1", "step_2", "step_3", "step_4"] as const).map((stepKey, idx) => (
            <article
              key={stepKey}
              className="ds-syncro-step-card"
              style={{ background: STEP_GRADIENTS[idx] ?? STEP_GRADIENTS[0] }}
            >
              <p className="m-0 text-[30px] font-semibold leading-none">{idx + 1}</p>
              <p className="mt-3.5 text-base font-semibold">{t(`how_it_works.${stepKey}_title`)}</p>
              <p className="mt-2 text-[13.5px] leading-snug opacity-90">{t(`how_it_works.${stepKey}_desc`)}</p>
            </article>
          ))}
        </div>
      </DsBand>

      <DsBand id="syncro-shows-ds">
        <DsSectionHeading>{t("what_shows.heading")}</DsSectionHeading>
        <p className="marketing-section-intro ds-mt-36 mx-auto max-w-[42rem] text-center">
          {t("what_shows.intro")}
        </p>
        <div className="pj-syncro-shows">
          <SyncroMarketingPhonePreview />
          <div>
            <p className="m-0 text-[13px] uppercase tracking-[0.14em] text-[var(--pj-teal-soft)]">
              {t("what_shows.items_intro")}
            </p>
            <ul className="mt-4 list-none space-y-3 p-0">
              {whatShowsItems.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-snug text-[var(--pj-text-secondary)]">
                  <span className="text-[var(--pj-teal)]">✦</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-[var(--pj-text-tertiary)]">{t("what_shows.footnote")}</p>
          </div>
        </div>
      </DsBand>

      <DsBand id="syncro-currents-ds">
        <DsSectionHeading>{t("five_currents.heading")}</DsSectionHeading>
        <p className="marketing-section-intro ds-mt-36 mx-auto max-w-[42rem] text-center">
          {t("five_currents.intro")}
        </p>
        <ul className="mx-auto mt-8 max-w-[40rem] list-none space-y-3 p-0">
          {currents.map((item, idx) => {
            const dotColor = CURRENT_COLORS[idx] ?? "var(--pj-teal)";
            return (
              <li key={item.name}>
                <DsCurrentRow name={item.name} desc={item.desc} dotColor={dotColor} />
              </li>
            );
          })}
        </ul>
        <p className="marketing-section-intro mx-auto mt-7 max-w-[40rem] text-center text-[15px] text-[var(--pj-text-tertiary)]">
          {t("five_currents.footer")}
        </p>
      </DsBand>

      <DsBand id="syncro-use-cases-ds">
        <DsSectionHeading>{t("use_cases.heading")}</DsSectionHeading>
        <div className="ds-grid-auto-220 ds-mt-36">
          {USE_CASE_KEYS.map((key, idx) => {
            const Icon = USE_CASE_ICONS[idx] ?? CalendarCheck;
            return (
              <DsGlassCard key={key} className="flex gap-3.5">
                <MarketingIconChip tone="cyan">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
                </MarketingIconChip>
                <div>
                  <p className="ds-glass-card__title">{t(`use_cases.${key}.title`)}</p>
                  <p className="ds-glass-card__body whitespace-pre-line">{t(`use_cases.${key}.description`)}</p>
                </div>
              </DsGlassCard>
            );
          })}
        </div>
      </DsBand>

      <DsBand id="syncro-what-is-ds">
        <DsSectionHeading>{t("what_it_is.heading")}</DsSectionHeading>
        <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto mt-9 max-w-[58rem]">
          <DsMutedCard accent="blue">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              {t("what_it_is.shows.title")}
            </p>
            <ul className="mt-4 list-none space-y-3 p-0">
              {showsItems.map((item) => (
                <li key={item} className="text-[15px] leading-snug">
                  <span className="mr-2">✦</span>
                  {item}
                </li>
              ))}
            </ul>
          </DsMutedCard>
          <DsMutedCard accent="magenta">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              {t("what_it_is.isnt.title")}
            </p>
            <ul className="mt-4 list-none space-y-3 p-0">
              {isntItems.map((item) => (
                <li key={item} className="text-[15px] leading-snug">
                  <span className="mr-2">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </DsMutedCard>
        </div>
      </DsBand>

      <DsBand id="syncro-pricing-ds" center>
        <DsSectionHeading>{t("pricing.heading")}</DsSectionHeading>
        <p className="marketing-section-subheading ds-mt-36 mx-auto max-w-[44rem]">
          {t("pricing.description")}
        </p>
        <div className="mt-7">
          <SyncroPricingCta label={t("pricing.cta")} />
        </div>
      </DsBand>
    </>
  );
}
