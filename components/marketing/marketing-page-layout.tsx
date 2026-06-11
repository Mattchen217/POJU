import type { ReactNode } from "react";

import { DsPageStack } from "@/components/ds/primitives";
import { cn } from "@/lib/utils/classnames";

export type ProductPageTheme = "poju" | "glyph" | "syncro" | "match";

const productClass: Record<ProductPageTheme, string> = {
  poju: "product-page--poju",
  glyph: "product-page--glyph",
  syncro: "product-page--syncro",
  match: "product-page--match",
};

/** 产品介绍页 / Match 首页外壳 */
export function MarketingPageLayout({
  children,
  theme,
  className,
  component: Component = "main",
}: {
  children: ReactNode;
  theme?: ProductPageTheme;
  className?: string;
  component?: "main" | "div";
}) {
  return (
    <Component className={cn("text-[var(--pj-text-secondary)]", theme && productClass[theme], className)}>
      <div className="w-full pb-12 pt-2 sm:pt-4">{children}</div>
    </Component>
  );
}

/** DS page stack — 72rem bands with 32px gap */
export function MarketingPageSections({ children, className }: { children: ReactNode; className?: string }) {
  return <DsPageStack className={cn("px-3 sm:px-4 md:px-6", className)}>{children}</DsPageStack>;
}

/** Hero 区置于毛玻璃栈之外 */
export function MarketingPageHero({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-3 sm:px-4 md:px-6", className)}>{children}</div>;
}
