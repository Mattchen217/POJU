import { getTranslations } from "next-intl/server";

import { DS_HOME_PRODUCT_ICONS, type DsHomeCopy } from "@/components/ds/DsHomePage";

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
] as const;

/** Classic (V1) marketing home copy — kept for `/classic` until the tree is retired. */
export async function buildClassicHomeCopy(): Promise<DsHomeCopy> {
  const tHome = await getTranslations("home");
  const tp = await getTranslations("home.products");

  return {
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
          { key: "card4" as const },
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
      ],
    },
  };
}
