import type { ReactNode } from "react";

import { HeroConstellation } from "@/components/marketing/HeroConstellation";
import { HeroSpline } from "@/components/marketing/hero-spline";
import { DsGradientTitle } from "@/components/ds/primitives";
import {
  HeroInlineBold,
  ProductHeroAccent,
  ProductHeroActions,
  ProductHeroBillingNotice,
  ProductHeroBrandTag,
  ProductHeroContent,
  ProductHeroDescription,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeHeroActions } from "@/components/pwa/AppModeHeroActions";
import { PojuSessionStarter } from "@/components/poju/poju-session-starter";

export type PojuProductHeroCopy = {
  brandTag: string;
  heading: string;
  description: string;
  tagline: string;
  /** Optional Block 1 lead-in under body (Hook stays in tagline; omitted when empty). */
  leadIn?: string;
  ctaPrimary: string;
  billingNotice: string;
};

export function PojuProductHero({
  copy,
  hideActions = false,
  scene = "/animations/POJURENscene.splinecode",
  initialZoom = 0.62,
  hideStarrySky = false,
  hideVignette = false,
  workspaceMotion = "constellation",
  afterDescription = null,
}: {
  copy: PojuProductHeroCopy;
  /** Workspace center: no CTA / billing strip */
  hideActions?: boolean;
  /** Spline scene URL — Atmos workspace uses `/spline/atmoswork.splinecode` (moving blue light) */
  scene?: string;
  initialZoom?: number;
  hideStarrySky?: boolean;
  hideVignette?: boolean;
  /** Optional block under hero description (e.g. joint invite summary). */
  afterDescription?: ReactNode;
  /**
   * Workspace idle background:
   * - constellation — light 2D stars (default for POJU/Glyph/Match)
   * - spline — product Spline only
   * - spline-constellation — original Atmos Spline grid + transparent star canvas on top
   */
  workspaceMotion?: "constellation" | "spline" | "spline-constellation";
}) {
  const useConstellationOnly = hideActions && workspaceMotion === "constellation";
  const useWorkspaceSpline =
    hideActions &&
    (workspaceMotion === "spline" || workspaceMotion === "spline-constellation");
  const useSkyOverSpline =
    hideActions && workspaceMotion === "spline-constellation";

  return (
    <ProductMarketingHero
      theme="poju"
      hideStarrySky={hideStarrySky || useConstellationOnly || useSkyOverSpline}
      hideVignette={hideVignette}
      background={
        useConstellationOnly ? (
          <HeroConstellation className="poju-hero-constellation" />
        ) : useSkyOverSpline ? (
          <>
            {/* Bottom: Atmos moving blue light (atmoswork). Top: transparent stars. */}
            <HeroSpline
              scene={scene}
              initialZoom={initialZoom}
              className="poju-hero-spline poju-hero-spline--under-sky poju-hero-spline--atmos-glow"
              keepAlive
              renderOnDemand={false}
              pointerFollow={false}
              renderScale={1}
            />
            <HeroConstellation className="poju-hero-constellation poju-hero-constellation--over-spline" />
          </>
        ) : (
          <HeroSpline
            scene={scene}
            initialZoom={initialZoom}
            className="poju-hero-spline"
            keepAlive={useWorkspaceSpline}
            renderOnDemand={!useWorkspaceSpline}
            pointerFollow={!useWorkspaceSpline}
          />
        )
      }
    >
      <ProductHeroContent>
        {copy.brandTag ? (
          <ProductHeroBrandTag>{copy.brandTag}</ProductHeroBrandTag>
        ) : null}
        <DsGradientTitle from="#d4af37" to="#e8c56f">
          {copy.heading}
        </DsGradientTitle>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        {afterDescription}
        {copy.leadIn ? (
          <ProductHeroDescription>
            <HeroInlineBold text={copy.leadIn} />
          </ProductHeroDescription>
        ) : null}
        {copy.tagline ? (
          <ProductHeroAccent>
            <HeroInlineBold text={copy.tagline} />
          </ProductHeroAccent>
        ) : null}
        {hideActions ? null : (
          <ProductHeroActions>
            <NotPWA>
              <PojuSessionStarter className="pj-pill-outline pj-pill-outline--gold px-[30px] py-3.5 text-[15px]">
                {copy.ctaPrimary}
              </PojuSessionStarter>
              {copy.billingNotice ? (
                <ProductHeroBillingNotice>{copy.billingNotice}</ProductHeroBillingNotice>
              ) : null}
            </NotPWA>
            <AppModeHeroActions productId="poju" price="$9.99" />
          </ProductHeroActions>
        )}
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
