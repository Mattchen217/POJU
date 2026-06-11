"use client";

import { SyncroPwaInstallTrigger } from "@/components/syncro/SyncroPwaInstallGuide";

export function SyncroPricingCta({ label }: { label: string }) {
  return (
    <SyncroPwaInstallTrigger
      variant="button"
      className="pj-pill-outline pj-pill-outline--cyan mt-8 px-[30px] py-3.5 text-[15px]"
    >
      {label}
    </SyncroPwaInstallTrigger>
  );
}
