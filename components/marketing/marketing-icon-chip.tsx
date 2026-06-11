import type { ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

export type MarketingIconChipTone = "gold" | "violet" | "cyan" | "rose" | "glyph";

const toneClass: Record<MarketingIconChipTone, string> = {
  gold: "marketing-icon-chip--gold",
  violet: "marketing-icon-chip--violet",
  cyan: "marketing-icon-chip--cyan",
  rose: "marketing-icon-chip--rose",
  glyph: "marketing-icon-chip--glyph",
};

/** DS IconChip — frosted icon container */
export function MarketingIconChip({
  children,
  tone = "gold",
  className,
  size = "md",
}: {
  children: ReactNode;
  tone?: MarketingIconChipTone;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "marketing-icon-chip",
        toneClass[tone],
        size === "sm" && "marketing-icon-chip--sm",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
