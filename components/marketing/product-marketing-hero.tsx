import type { ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

import type { ProductPageTheme } from "./marketing-page-layout";

type ProductMarketingHeroProps = {
  children: ReactNode;
  /** Spline / 能量球 / 后续 Match 动效 */
  background?: ReactNode;
  className?: string;
  shellClassName?: string;
  /** 双栏（Syncro QR 区） */
  layout?: "centered" | "split";
  /** 背景层额外 class（定位尺寸） */
  backgroundClassName?: string;
  /** 无 background 时也保留背景槽（如 Match 待上传动效） */
  reserveBackgroundSlot?: boolean;
  theme?: ProductPageTheme;
};

/**
 * 各产品介绍页统一 Hero 外壳：相同 min-height、内边距与标题/正文尺度。
 * Match 动效：传入 `background` 或后续在 `.product-hero__bg--match` 内挂载。
 */
export function ProductMarketingHero({
  children,
  background,
  className,
  shellClassName,
  layout = "centered",
  backgroundClassName,
  reserveBackgroundSlot,
  theme,
}: ProductMarketingHeroProps) {
  const showBg = Boolean(background) || reserveBackgroundSlot;

  return (
    <section className={cn("product-hero", theme && `product-page--${theme}`, className)} data-product-hero={theme}>
      <div className={cn("product-hero__shell", shellClassName)}>
        {showBg ? (
          <div className={cn("product-hero__bg", backgroundClassName)} aria-hidden>
            {background}
          </div>
        ) : null}

        <div
          className={cn(
            "product-hero__stage",
            layout === "split" && "product-hero__stage--align-start",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function ProductHeroContent({
  children,
  wide,
  alignMd,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  alignMd?: "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "product-hero__content",
        wide && "product-hero__content--wide",
        alignMd === "left" && "product-hero__content--left-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProductHeroTitle({
  children,
  gradient,
  className,
}: {
  children: ReactNode;
  gradient?: boolean;
  className?: string;
}) {
  return (
    <h1 className={cn("product-hero__title", gradient && "product-hero__title--gradient", className)}>
      {children}
    </h1>
  );
}

export function ProductHeroAccent({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("product-hero__accent", className)}>{children}</p>;
}

export function ProductHeroDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("product-hero__description", className)}>{children}</p>;
}

export function ProductHeroMeta({
  children,
  bright,
  className,
}: {
  children: ReactNode;
  bright?: boolean;
  className?: string;
}) {
  return <p className={cn("product-hero__meta", bright && "product-hero__meta--bright", className)}>{children}</p>;
}

export function ProductHeroActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("product-hero__actions", className)}>{children}</div>;
}

export function ProductHeroSplit({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("product-hero__split", className)}>{children}</div>;
}

