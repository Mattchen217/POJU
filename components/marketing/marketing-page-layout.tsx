import type { ReactNode } from "react";

import { DsPageStack } from "@/components/ds/primitives";
import { cn } from "@/lib/utils/classnames";

export type MarketingPageTheme = "home" | "poju" | "glyph" | "syncro" | "match" | "archive";

/** @deprecated Use MarketingPageTheme */
export type ProductPageTheme = Exclude<MarketingPageTheme, "home" | "archive">;

const pageTintClass: Record<MarketingPageTheme, string> = {
  home: "pj-page pj-page--home",
  poju: "pj-page pj-page--poju product-page--poju",
  glyph: "pj-page pj-page--glyph product-page--glyph",
  syncro: "pj-page pj-page--syncro product-page--syncro",
  match: "pj-page pj-page--match product-page--match",
  archive: "pj-page pj-page--archive",
};

/** 产品介绍页 / Match 首页外壳 */
export function MarketingPageLayout({
  children,
  theme,
  className,
  component: Component = "main",
}: {
  children: ReactNode;
  theme?: MarketingPageTheme;
  className?: string;
  component?: "main" | "div";
}) {
  return (
    <Component className={cn("text-[var(--pj-text-secondary)]", theme && pageTintClass[theme], className)}>
      <div className="w-full pb-12 pt-2 sm:pt-4">{children}</div>
    </Component>
  );
}

/** DS page stack — 72rem bands with unified hero gap + section rhythm */
export function MarketingPageSections({
  children,
  className,
  /** When true, entire stack is hidden in installed PWA (see pwa-product-begin.css). */
  hideInPwa,
}: {
  children: ReactNode;
  className?: string;
  hideInPwa?: boolean;
}) {
  return (
    <DsPageStack
      className={cn(
        "ds-page-stack--after-hero px-3 sm:px-4 md:px-6",
        hideInPwa && "marketing-page-sections",
        className,
      )}
    >
      {children}
    </DsPageStack>
  );
}

/** Hero 区置于毛玻璃栈之外 */
export function MarketingPageHero({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-3 sm:px-4 md:px-6", className)}>{children}</div>;
}
