import type { ReactNode } from "react";

import { GlassSection } from "@/components/ui/GlassSection";
import { cn } from "@/lib/utils/classnames";

type MarketingSectionProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  padding?: "default" | "lg" | "sm" | "none";
  allowOverflow?: boolean;
  title?: string;
  subtitle?: string;
};

/** 灰白毛玻璃板块 + 可选居中标题（与首页 GlassSection 一致） */
export function MarketingSection({
  children,
  id,
  className,
  padding = "default",
  allowOverflow,
  title,
  subtitle,
}: MarketingSectionProps) {
  return (
    <GlassSection id={id} className={className} padding={padding} allowOverflow={allowOverflow}>
      {title ? <h2 className="marketing-section-heading">{title}</h2> : null}
      {subtitle ? <p className="marketing-section-subheading">{subtitle}</p> : null}
      <div className={cn(title || subtitle ? "mt-8 md:mt-10" : undefined)}>{children}</div>
    </GlassSection>
  );
}
