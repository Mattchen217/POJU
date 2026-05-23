import type { ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

export type ProductPageTheme = "poju" | "glyph" | "syncro" | "match";

const productClass: Record<ProductPageTheme, string> = {
  poju: "product-page--poju",
  glyph: "product-page--glyph",
  syncro: "product-page--syncro",
  match: "product-page--match",
};

/** 产品介绍页 / Match 首页外壳：透明底 + 与落地页一致的区块间距 */
export function MarketingPageLayout({
  children,
  theme,
  className,
  component: Component = "main",
}: {
  children: ReactNode;
  theme?: ProductPageTheme;
  className?: string;
  /** Syncro 等外层已有 `<main>` 时用 `div` */
  component?: "main" | "div";
}) {
  return (
    <Component className={cn("text-text-body", theme && productClass[theme], className)}>
      <div className="w-full pb-12 pt-2 sm:pt-4">{children}</div>
    </Component>
  );
}

/** 与首页 landing-sections 相同的灰白毛玻璃板块栈 */
export function MarketingPageSections({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("landing-sections", className)}>{children}</div>;
}

/** Hero 区置于毛玻璃栈之外 */
export function MarketingPageHero({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-3 sm:px-4 md:px-6", className)}>{children}</div>;
}
