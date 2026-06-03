"use client";

import { SyncroPwaInstallTrigger } from "@/components/syncro/SyncroPwaInstallGuide";

export function SyncroPricingCta({ label }: { label: string }) {
  return (
    <SyncroPwaInstallTrigger variant="button" className="glass-btn glass-btn-primary glass-btn-large mt-8">
      {label}
    </SyncroPwaInstallTrigger>
  );
}
