"use client";

import { useTranslations } from "next-intl";

import { DsGlassCard } from "@/components/ds/primitives";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SyncroMarketingPhonePreview } from "@/components/marketing/syncro-marketing-phone-preview";

import "@/styles/syncro-marketing-preview.css";

/**
 * Syncro marketing body — phone mockup + side copy only.
 */
export function SyncroMarketingBody(_props?: { includeWhatIs?: boolean }) {
  const t = useTranslations("marketingSite.syncro");
  const whatShowsItems = t.raw("what_shows.items") as string[];

  return (
    <div className="syncro-marketing-body">
      <MarketingSection id="syncro-what-shows" padding="lg">
        <div className="syncro-what-shows-layout">
          <div className="syncro-what-shows-layout__phone">
            <SyncroMarketingPhonePreview />
          </div>
          <div className="syncro-what-shows-layout__copy">
            <p className="marketing-section-intro">{t("what_shows.intro")}</p>
            <DsGlassCard className="text-left text-white">
              <p>{t("what_shows.items_intro")}</p>
              <ul className="mt-4 space-y-2">
                {whatShowsItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </DsGlassCard>
            <p className="marketing-section-intro">{t("what_shows.footnote")}</p>
          </div>
        </div>
      </MarketingSection>
    </div>
  );
}
