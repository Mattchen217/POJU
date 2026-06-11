import type { ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

import type { ProductPageTheme } from "./marketing-page-layout";
import { ProductHeroStarrySky } from "./product-hero-starry-sky";

type ProductMarketingHeroProps = {
  children: ReactNode;
  /** Spline / 能量球 / Match 动效 — 保留项目现有动效，不用 DS energyField */
  background?: ReactNode;
  className?: string;
  shellClassName?: string;
  layout?: "centered" | "split";
  backgroundClassName?: string;
  reserveBackgroundSlot?: boolean;
  theme?: ProductPageTheme | "archive";
};

/** DS ProductHero shell（chrome.jsx）— 动效层 + 暗角叠层 + 居中内容 */
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
    <section
      className={cn("product-hero", theme && theme !== "archive" && `product-page--${theme}`, className)}
      data-product-hero={theme}
    >
      <div className={cn("product-hero__shell", shellClassName)}>
        {showBg ? (
          <div className={cn("product-hero__bg", backgroundClassName)} aria-hidden>
            {background}
          </div>
        ) : null}

        <ProductHeroStarrySky />

        <div className="product-hero__vignette" aria-hidden />

        <div
          className={cn(
            "product-hero__stage",
            layout === "split" && "product-hero__stage--align-start",
          )}
        >
          <div className="product-hero__stage-inner ds-fade-in">{children}</div>
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

/** @deprecated Prefer DsGradientTitle in hero — kept for non-hero usage */
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
  bold,
  className,
}: {
  children: ReactNode;
  bright?: boolean;
  bold?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "product-hero__meta",
        bright && "product-hero__meta--bright",
        bold && "product-hero__meta--bold",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ProductHeroActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("product-hero__actions", className)}>{children}</div>;
}

export function ProductHeroSecondaryLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={cn("product-hero__secondary-link", className)}>
      {children}
    </a>
  );
}

export function ProductHeroSplit({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("product-hero__split", className)}>{children}</div>;
}
