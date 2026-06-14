import Image, { type StaticImageData } from "next/image";
import { Link } from "@/i18n/navigation";
import { Lock, Scale, UserX } from "lucide-react";

import { HeroInstallCta } from "@/components/marketing/hero-install-cta";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeProductTopBar } from "@/components/pwa/AppModeProductTopBar";
import { ProductCardSpline } from "@/components/marketing/product-card-spline";
import { HERO_ASSET_VERSION, HERO_PNG, LANDING_ASSETS } from "@/lib/marketing/landing-assets";
import { hasPublicFile } from "@/lib/marketing/has-public-file";
import productCardIconG from "@/assets/icons/G.png";
import productCardIconM from "@/assets/icons/match.png";
import productCardIconP from "@/assets/icons/P.png";
import productCardIconS from "@/assets/icons/S.png";

import {
  DsBand,
  DsFadeIn,
  DsGlassCard,
  DsIconChip,
  DsMutedCard,
  DsPageStack,
  DsSectionHeading,
} from "./primitives";

type ProductCardData = {
  href: string;
  kind: string;
  name: string;
  badge: string;
  badgeColor: string;
  line1: string;
  line2: string;
  cta: string;
  cardGradient: string;
  ringStyle: string;
  glowColor: string;
  icon: StaticImageData;
};

const ICONS: Record<string, StaticImageData> = {
  poju: productCardIconP,
  glyph: productCardIconG,
  syncro: productCardIconS,
  match: productCardIconM,
};

function DsHomeProductCard({ card }: { card: ProductCardData }) {
  return (
    <Link href={card.href} className="ds-product-card" aria-label={`${card.name} · ${card.cta}`}>
      <span className="ds-product-card__bg" style={{ backgroundImage: card.cardGradient }} aria-hidden />
      <span className="absolute inset-0 opacity-70 pointer-events-none" aria-hidden>
        <ProductCardSpline kind={card.kind as "poju" | "glyph" | "syncro" | "match"} />
      </span>
      <span
        className="ds-product-card__glow"
        style={{ background: `radial-gradient(circle, ${card.glowColor}, transparent 70%)` }}
        aria-hidden
      />
      <span className="ds-product-card__inner">
        <span className="ds-product-card__head">
          <span className="ds-product-card__ring" style={{ background: card.ringStyle, boxShadow: `0 0 22px ${card.glowColor}` }}>
            <Image src={card.icon} alt="" width={32} height={32} className="h-[72%] w-[72%] object-contain" />
          </span>
          <span className="ds-product-card__name">{card.name}</span>
          <span className="ds-product-card__badge" style={{ color: card.badgeColor }}>
            {card.badge}
          </span>
        </span>
        <span className="ds-product-card__lines">
          <span>{card.line1}</span>
          <span>{card.line2}</span>
        </span>
        <span className="ds-product-card__cta">{card.cta}</span>
      </span>
    </Link>
  );
}

function DsSceneBand({
  imageSrc,
  side,
  accent,
  title,
  body,
}: {
  imageSrc: string;
  side: "left" | "right";
  accent: "violet" | "blue" | "magenta";
  title: string;
  body: string;
}) {
  const grad =
    side === "right"
      ? "linear-gradient(270deg, rgba(0,0,0,0.82), rgba(0,0,0,0.5) 46%, rgba(0,0,0,0.12))"
      : "linear-gradient(90deg, rgba(0,0,0,0.82), rgba(0,0,0,0.5) 46%, rgba(0,0,0,0.12))";

  return (
    <div className="ds-scene-band">
      <Image src={imageSrc} alt="" fill className="object-cover" sizes="(max-width:1200px) 100vw, 1152px" />
      <div className="absolute inset-0" style={{ background: grad }} aria-hidden />
      <div
        className={`absolute inset-0 flex items-center p-7 sm:p-9 md:p-14 ${side === "right" ? "justify-end" : "justify-start"}`}
      >
        <div className={`ds-scene-band__caption ds-scene-band__caption--${accent}`}>
          <p className="text-[clamp(18px,2.2vw,21px)] font-semibold">{title}</p>
          <p className="mt-3 whitespace-pre-line text-[clamp(14px,1.6vw,16px)] leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

function DsScenarioCard({
  href,
  imageSrc,
  accent,
  lines,
  cta,
}: {
  href: string;
  imageSrc: string;
  accent: "violet" | "magenta" | "blue" | "fuchsia";
  lines: string[];
  cta: string;
}) {
  return (
    <Link href={href} className="ds-scenario-card group">
      <div className="ds-scenario-card__media">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width:640px) 100vw, 25vw"
        />
      </div>
      <div className={`ds-scenario-card__body ds-scenario-card__body--${accent}`}>
        {lines.map((line) => (
          <p key={line} className="m-0 text-base leading-relaxed">
            {line}
          </p>
        ))}
        <p className="m-0 mt-3 text-[17px] font-semibold transition-transform duration-300 group-hover:translate-x-1">
          → {cta}
        </p>
      </div>
    </Link>
  );
}

function DsPromiseCard({
  accent,
  icon,
  title,
  paras,
}: {
  accent: "violet" | "blue" | "gold";
  icon: React.ReactNode;
  title: string;
  paras: string[];
}) {
  return (
    <DsMutedCard accent={accent}>
      <div className="flex items-start gap-4">
        <DsIconChip size={44}>{icon}</DsIconChip>
        <div className="min-w-0">
          <p className="m-0 text-[21px] font-semibold">{title}</p>
          {paras.map((p) => (
            <p key={p} className="mt-3 text-base leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </div>
    </DsMutedCard>
  );
}

export type DsHomeCopy = {
  hero: {
    headline: string;
    descLines: [string, string, string];
    trustLine: string;
  };
  fourWays: { heading: string };
  products: ProductCardData[];
  built: {
    heading: string;
    intro: string;
    easternTitle: string;
    easternBody: string;
    modernTitle: string;
    modernBody: string;
    aiTitle: string;
    aiBody: string;
    closingHeading: string;
    closingBody: string;
  };
  meetsMoment: {
    heading: string;
    subtitle: string;
    cards: { href: string; imageSrc: string; accent: "violet" | "magenta" | "blue" | "fuchsia"; lines: string[]; cta: string }[];
  };
  promises: {
    heading: string;
    neverStoredTitle: string;
    neverStoredParas: string[];
    neverRequiredTitle: string;
    neverRequiredParas: string[];
    neverManipulativeTitle: string;
    neverManipulativeParas: string[];
    dataLine: string;
    readMore: string;
  };
  finalCta: {
    readyHeading: string;
    readySubheading: string;
    items: { href: string; title: string; sub: string; variant: "gold" | "violet" | "cyan" | "rose" }[];
  };
};

export function DsHomePage({ copy }: { copy: DsHomeCopy }) {
  const heroBg = hasPublicFile(LANDING_ASSETS.hero) ? `${LANDING_ASSETS.hero}?v=${HERO_ASSET_VERSION}` : null;

  return (
    <main className="pj-page pj-page--home text-[var(--pj-text-secondary)]">
      <AppModeProductTopBar />
      <section className="ds-home-hero">
        <div className="ds-home-hero__media">
          {heroBg ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroBg}
                alt=""
                width={HERO_PNG.width}
                height={HERO_PNG.height}
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                className="ds-home-hero__bg"
              />
              <div className="ds-home-hero__overlay" aria-hidden />
            </>
          ) : (
            <div className="h-full min-h-[var(--marketing-hero-min-height)] bg-[var(--pj-bg-deep)]" aria-hidden />
          )}
          <div className="ds-home-hero__content">
            <DsFadeIn>
              <h1 className="ds-home-hero__title">{copy.hero.headline}</h1>
            </DsFadeIn>
            <DsFadeIn delay={120}>
              <div className="ds-home-hero__lines">
                {copy.hero.descLines.map((line) => (
                  <p key={line} className="m-0">
                    {line}
                  </p>
                ))}
              </div>
            </DsFadeIn>
            <DsFadeIn delay={240}>
              <p className="ds-home-hero__trust">{copy.hero.trustLine}</p>
            </DsFadeIn>
            <DsFadeIn delay={340}>
              <HeroInstallCta />
            </DsFadeIn>
          </div>
        </div>
        <div className="ds-home-hero__fade-bottom" aria-hidden />
      </section>

      <DsPageStack variant="home">
        <DsBand>
          <DsSectionHeading>{copy.fourWays.heading}</DsSectionHeading>
          <div className="ds-grid-auto-220 ds-mt-48">
            {copy.products.map((p) => (
              <DsHomeProductCard key={p.kind} card={p} />
            ))}
          </div>
        </DsBand>

        {/* Project intro — desktop site only. App mode: hero + four cards + promises. */}
        <NotPWA>
        <DsBand>
          <DsSectionHeading>{copy.built.heading}</DsSectionHeading>
          <p className="ds-prose-center max-w-3xl ds-mt-36">{copy.built.intro}</p>
          <DsSceneBand
            imageSrc="/animations/P2V1.jpg"
            side="right"
            accent="violet"
            title={copy.built.easternTitle}
            body={copy.built.easternBody}
          />
          <DsSceneBand
            imageSrc="/animations/P3.jpg"
            side="left"
            accent="blue"
            title={copy.built.modernTitle}
            body={copy.built.modernBody}
          />
          <DsSceneBand
            imageSrc="/animations/P3-1.jpg"
            side="right"
            accent="magenta"
            title={copy.built.aiTitle}
            body={copy.built.aiBody}
          />
          <div className="mt-11">
            <DsSectionHeading>{copy.built.closingHeading}</DsSectionHeading>
            <p className="ds-prose-center max-w-4xl ds-mt-36 whitespace-pre-line">{copy.built.closingBody}</p>
          </div>
        </DsBand>

        <DsBand>
          <DsSectionHeading>{copy.meetsMoment.heading}</DsSectionHeading>
          <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-white">{copy.meetsMoment.subtitle}</p>
          <div className="ds-grid-auto-240 ds-mt-40">
            {copy.meetsMoment.cards.map((card) => (
              <DsScenarioCard key={card.href} {...card} />
            ))}
          </div>
        </DsBand>
        </NotPWA>

        <DsBand>
          <DsSectionHeading>{copy.promises.heading}</DsSectionHeading>
          <div className="ds-gap-col mx-auto max-w-5xl ds-mt-40">
            <DsPromiseCard
              accent="violet"
              icon={<Lock className="h-[22px] w-[22px]" strokeWidth={2} />}
              title={copy.promises.neverStoredTitle}
              paras={copy.promises.neverStoredParas}
            />
            <DsPromiseCard
              accent="blue"
              icon={<UserX className="h-[22px] w-[22px]" strokeWidth={2} />}
              title={copy.promises.neverRequiredTitle}
              paras={copy.promises.neverRequiredParas}
            />
            <DsPromiseCard
              accent="gold"
              icon={<Scale className="h-[22px] w-[22px]" strokeWidth={2} />}
              title={copy.promises.neverManipulativeTitle}
              paras={copy.promises.neverManipulativeParas}
            />
          </div>
          <p className="mx-auto mt-11 max-w-3xl text-center text-lg leading-relaxed text-white whitespace-pre-line">
            {copy.promises.dataLine}
          </p>
          <p className="mt-5 text-center">
            <Link href="/privacy" className="font-medium text-[var(--pj-gold-soft)] hover:underline">
              {copy.promises.readMore}
            </Link>
          </p>
        </DsBand>

        <NotPWA>
        <DsBand center>
          <DsSectionHeading style={{ maxWidth: "40rem", marginInline: "auto" }}>
            {copy.finalCta.readyHeading}
          </DsSectionHeading>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/80">{copy.finalCta.readySubheading}</p>
          <div className="ds-grid-cta-row ds-mt-36">
            {copy.finalCta.items.map((item) => (
              <div key={item.href} className="ds-cta-col">
                <Link href={item.href} className={`pj-pill-outline pj-pill-outline--${item.variant} w-full justify-center px-6 py-3.5 text-[15px]`}>
                  {item.title}
                </Link>
                <p className="m-0 max-w-[14rem] text-[13px] leading-snug text-white/72">{item.sub}</p>
              </div>
            ))}
          </div>
        </DsBand>
        </NotPWA>
      </DsPageStack>
    </main>
  );
}

export { ICONS as DS_HOME_PRODUCT_ICONS };
