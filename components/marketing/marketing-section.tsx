import type { ReactNode } from "react";

import { DsBand, DsSectionHeading } from "@/components/ds/primitives";
import { cn } from "@/lib/utils/classnames";

type MarketingSectionProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  padding?: "default" | "lg" | "sm" | "none";
  allowOverflow?: boolean;
  title?: string;
  subtitle?: string;
  center?: boolean;
};

/** DS Band — frosted glass section (pj-glass-section) */
export function MarketingSection({
  children,
  id,
  className,
  padding,
  allowOverflow,
  title,
  subtitle,
  center,
}: MarketingSectionProps) {
  const padClass =
    padding === "lg"
      ? "py-10 md:py-12"
      : padding === "sm"
        ? "py-6"
        : padding === "none"
          ? "p-0"
          : undefined;

  return (
    <DsBand
      id={id}
      center={center}
      className={cn(padClass, allowOverflow && "overflow-visible", className)}
    >
      {title ? <DsSectionHeading>{title}</DsSectionHeading> : null}
      {subtitle ? <p className="marketing-section-subheading ds-mt-36">{subtitle}</p> : null}
      <div className={cn(title || subtitle ? "ds-mt-36" : undefined)}>{children}</div>
    </DsBand>
  );
}
