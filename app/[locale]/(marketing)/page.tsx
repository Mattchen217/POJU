import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { DS_HOME_PRODUCT_ICONS, type DsHomeCopy } from "@/components/ds/DsHomePage";
import { PaymentCancelToast } from "@/components/marketing/payment-cancel-toast";
import { WorkspaceAwareHome } from "@/components/workspace/WorkspaceAwareHome";

export const dynamic = "force-dynamic";

const PRODUCT_STYLES = [
  {
    href: "/poju",
    kind: "poju",
    productKey: "poju" as const,
    cardGradient:
      "linear-gradient(122deg, rgba(150,105,245,0.45) 0%, transparent 18%), linear-gradient(145deg, #050508 0%, #0a0712 40%, #0c0a16 100%)",
    ringStyle: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    glowColor: "rgba(139,92,246,0.45)",
    badgeColor: "#fcd34d",
  },
  {
    href: "/glyph",
    kind: "glyph",
    productKey: "glyph" as const,
    cardGradient:
      "linear-gradient(118deg, rgba(235,120,55,0.45) 0%, transparent 18%), linear-gradient(145deg, #050505 0%, #0b0806 40%, #0f0c0a 100%)",
    ringStyle: "linear-gradient(135deg, rgba(251,191,36,0.5), rgba(217,70,239,0.55))",
    glowColor: "rgba(251,191,36,0.32)",
    badgeColor: "#7dd3fc",
  },
  {
    href: "/syncro",
    kind: "syncro",
    productKey: "syncro" as const,
    cardGradient:
      "linear-gradient(120deg, rgba(50,200,195,0.4) 0%, transparent 18%), linear-gradient(145deg, #050708 0%, #081012 40%, #0a1416 100%)",
    ringStyle: "linear-gradient(135deg, rgba(34,211,238,0.6), rgba(30,58,138,0.7))",
    glowColor: "rgba(34,211,238,0.4)",
    badgeColor: "#7dd3fc",
  },
  {
    href: "/match",
    kind: "match",
    productKey: "match" as const,
    cardGradient:
      "linear-gradient(118deg, rgba(244,114,182,0.42) 0%, transparent 18%), linear-gradient(145deg, #080506 0%, #10080c 40%, #140a10 100%)",
    ringStyle: "linear-gradient(135deg, rgba(244,114,182,0.6), rgba(157,23,77,0.7))",
    glowColor: "rgba(244,114,182,0.4)",
    badgeColor: "#7dd3fc",
  },
] as const;

export default async function LandingPage() {
  const tHome = await getTranslations("home");
  const tp = await getTranslations("home.products");

  const copy: DsHomeCopy = {
    hero: {
      headline: tHome("hero.headline"),
      descLines: [tHome("hero.descLine1"), tHome("hero.descLine2"), tHome("hero.descLine3")],
      trustLine: tHome("hero.trustLine"),
    },
    fourWays: { heading: tHome("fourWays.heading"), subtitle: tHome("fourWays.subtitle") },
    products: PRODUCT_STYLES.map((style) => ({
      ...style,
      name: tp(`${style.productKey}.name`),
      badge: tp(`${style.productKey}.badge`),
      line1: tp(`${style.productKey}.line1`),
      line2: tp(`${style.productKey}.line2`),
      cta: tp(`${style.productKey}.cta`),
      icon: DS_HOME_PRODUCT_ICONS[style.kind],
    })),
    built: {
      heading: tHome("built.heading"),
      intro: tHome("built.intro"),
      easternTitle: tHome("built.easternTitle"),
      easternBody: tHome("built.easternBody"),
      modernTitle: tHome("built.modernTitle"),
      modernBody: tHome("built.modernBody"),
      aiTitle: tHome("built.aiTitle"),
      aiBody: tHome("built.aiBody"),
      closingHeading: tHome("built.closingHeading"),
      closingBody: tHome("built.closingBody"),
    },
    meetsMoment: {
      heading: tHome("meetsMoment.heading"),
      subtitle: tHome("meetsMoment.subtitle"),
      cards: (
        [
          { key: "card1" as const, href: "/poju", imageSrc: "/animations/S1.jpg", accent: "violet" as const },
          { key: "card2" as const, href: "/glyph", imageSrc: "/animations/S2.jpg", accent: "magenta" as const },
          { key: "card3" as const, href: "/syncro", imageSrc: "/animations/S3.jpg", accent: "blue" as const },
          { key: "card4" as const, href: "/match", imageSrc: "/animations/S4.jpg", accent: "fuchsia" as const },
        ] as const
      ).map(({ key, href, imageSrc, accent }) => ({
        href,
        imageSrc,
        accent,
        title: tHome(`meetsMoment.${key}.title`),
        text: tHome(`meetsMoment.${key}.text`),
        cta: tHome(`meetsMoment.${key}.cta`),
      })),
    },
    promises: {
      heading: tHome("promises.heading"),
      subtitle: tHome("promises.subtitle"),
      cards: (
        [
          { key: "card1" as const },
          { key: "card2" as const },
          { key: "card3" as const },
        ] as const
      ).map(({ key }) => ({
        title: tHome(`promises.${key}.title`),
        content: tHome(`promises.${key}.content`),
      })),
      readMore: tHome("promises.readMore"),
    },
    finalCta: {
      readyHeading: tHome("finalCta.readyHeading"),
      readySubheading: tHome("finalCta.readySubheading"),
      items: [
        {
          href: "/poju",
          title: tHome("finalCta.poju.title"),
          sub: tHome("finalCta.poju.sub"),
          variant: "gold" as const,
        },
        {
          href: "/glyph",
          title: tHome("finalCta.glyph.title"),
          sub: tHome("finalCta.glyph.sub"),
          variant: "violet" as const,
        },
        {
          href: "/syncro",
          title: tHome("finalCta.syncro.title"),
          sub: tHome("finalCta.syncro.sub"),
          variant: "cyan" as const,
        },
        {
          href: "/match",
          title: tHome("finalCta.match.title"),
          sub: tHome("finalCta.match.sub"),
          variant: "rose" as const,
        },
      ],
    },
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--pj-bg-deep)]" />}>
      <PaymentCancelToast />
      <WorkspaceAwareHome copy={copy} />
    </Suspense>
  );
}
