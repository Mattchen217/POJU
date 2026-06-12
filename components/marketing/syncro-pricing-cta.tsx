"use client";

import { SyncroPwaInstallTrigger } from "@/components/syncro/SyncroPwaInstallGuide";
import { cn } from "@/lib/utils/classnames";

export function SyncroPricingCta({ label, className }: { label: string; className?: string }) {
  return (
    <SyncroPwaInstallTrigger
      variant="button"
      className={cn(
        "pj-pill-outline pj-pill-outline--cyan mt-8 px-[30px] py-3.5 text-[15px]",
        className,
      )}
    >
      {label}
    </SyncroPwaInstallTrigger>
  );
}
