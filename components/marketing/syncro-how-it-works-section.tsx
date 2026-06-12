"use client";

import { SyncroHowItWorksFlow } from "@/components/marketing/syncro-how-it-works-flow";
import { MarketingSection } from "@/components/marketing/marketing-section";

type SyncroHowStep = {
  title: string;
  desc: string;
};

/** How Syncro works — radar scan + step cards (marketing band) */
export function SyncroHowItWorksSection({
  heading,
  intro,
  steps,
}: {
  heading: string;
  intro: string;
  steps: readonly SyncroHowStep[];
}) {
  return (
    <MarketingSection
      id="syncro-how-it-works"
      className="syncro-how-it-works-band syncro-how-it-works-flow"
      title={heading}
      padding="lg"
    >
      <p className="marketing-section-intro mx-auto max-w-2xl text-center">{intro}</p>
      <div className="mt-9">
        <SyncroHowItWorksFlow steps={[...steps]} />
      </div>
    </MarketingSection>
  );
}
