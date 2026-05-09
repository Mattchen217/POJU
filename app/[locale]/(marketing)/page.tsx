import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Lock, Scale, UserX } from "lucide-react";
import { ProductCardGlyphSpline } from "@/components/marketing/product-card-glyph-spline";
import { ProductCardPojuSpline } from "@/components/marketing/product-card-poju-spline";
import { ProductCardSyncroSpline } from "@/components/marketing/product-card-syncro-spline";
import { PaymentCancelToast } from "@/components/marketing/payment-cancel-toast";
import { HeroInstallCta } from "@/components/marketing/hero-install-cta";
import { ReadyCtaPillLink } from "@/components/marketing/ready-cta-pill-link";
import { LANDING_ASSETS } from "@/lib/marketing/landing-assets";
import { hasPublicFile } from "@/lib/marketing/has-public-file";
import productCardIconG from "@/assets/icons/G.png";
import productCardIconP from "@/assets/icons/P.png";
import productCardIconS from "@/assets/icons/S.png";

export const dynamic = "force-dynamic";

function firstExisting(...paths: string[]): string | null {
  for (const p of paths) {
    if (hasPublicFile(p)) return p;
  }
  return null;
}

const productCardStyles = [
  {
    href: "/poju",
    // 黑为主 + 一角亮紫；主体实色黑略带紫底，少叠雾
    cardGradient:
      "linear-gradient(122deg, rgba(150,105,245,0.45) 0%, transparent 18%), linear-gradient(145deg, #050508 0%, #0a0712 40%, #0c0a16 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.06) 100%)",
    kind: "poju",
    productKey: "poju" as const,
  },
  {
    href: "/glyph",
    // 黑为主 + 一角橙；衬 BAOZHA
    cardGradient:
      "linear-gradient(118deg, rgba(235,120,55,0.45) 0%, transparent 18%), linear-gradient(145deg, #050505 0%, #0b0806 40%, #0f0c0a 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.06) 100%)",
    kind: "glyph",
    productKey: "glyph" as const,
  },
  {
    href: "/syncro",
    // 黑为主 + 一角青绿（Syncro）
    cardGradient:
      "linear-gradient(120deg, rgba(50,200,195,0.4) 0%, transparent 18%), linear-gradient(145deg, #050708 0%, #081012 40%, #0a1416 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.06) 100%)",
    kind: "syncro",
    productKey: "syncro" as const,
  },
];

function ProductCardIcon({ kind }: { kind: string }) {
  const motion = "transition-transform duration-500 group-hover:scale-105";

  const cfg =
    kind === "poju"
      ? {
          src: productCardIconP,
          ring:
            "bg-gradient-to-br from-violet-500 to-purple-800 shadow-[0_0_22px_rgba(139,92,246,0.45)]",
        }
      : kind === "glyph"
        ? {
            src: productCardIconG,
            ring:
              "bg-gradient-to-br from-amber-400/35 via-orange-500/25 to-fuchsia-950/55 shadow-[0_0_22px_rgba(251,191,36,0.28)]",
          }
        : {
            src: productCardIconS,
            ring:
              "bg-gradient-to-br from-cyan-500/45 to-blue-950/60 shadow-[0_0_22px_rgba(34,211,238,0.35)]",
          };

  return (
    <span
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-11 sm:w-11 ${cfg.ring} ${motion}`}
      aria-hidden
    >
      <Image
        src={cfg.src}
        alt=""
        width={88}
        height={88}
        className="h-[72%] w-[72%] object-contain object-center"
      />
    </span>
  );
}

function ProductCardEffect({ kind }: { kind: string }) {
  return null;
}

function PromiseIconBadge({
  tone,
  children,
}: {
  tone: "violet" | "cyan" | "amber";
  children: ReactNode;
}) {
  const toneCls =
    tone === "violet"
      ? "from-violet-500/32 via-violet-400/16 to-fuchsia-500/12 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.35)]"
      : tone === "cyan"
        ? "from-cyan-500/30 via-sky-400/14 to-teal-500/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.3)]"
        : "from-amber-500/30 via-orange-400/14 to-yellow-500/12 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.3)]";

  return (
    <div
      className={`relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/16 bg-gradient-to-br ${toneCls}`}
      aria-hidden
    >
      <div className="absolute inset-[2px] rounded-[10px] border border-white/14" />
      <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white/60 blur-[0.5px]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** 对角划线划掉价格（左上 → 右下），细线避免盖住数字 */
function StruckPrice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="relative z-0">{children}</span>
      <svg
        className="pointer-events-none absolute -inset-x-0.5 -inset-y-0.5 z-10 h-[calc(100%+4px)] w-[calc(100%+4px)] overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1="5"
          y1="16"
          x2="95"
          y2="84"
          stroke="rgba(255, 248, 220, 0.92)"
          strokeWidth="1.1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}


export default async function LandingPage() {
  const tHome = await getTranslations("home");
  const tp = await getTranslations("home.products");

  const heroBg = hasPublicFile(LANDING_ASSETS.hero) ? LANDING_ASSETS.hero : null;
  const promisesBg = firstExisting(LANDING_ASSETS.promises);

  const cardTexture: Record<(typeof productCardStyles)[number]["kind"], string | null> = {
    poju: firstExisting(LANDING_ASSETS.cardPoju),
    glyph: firstExisting(LANDING_ASSETS.cardGlyph),
    syncro: firstExisting(LANDING_ASSETS.cardSyncro),
  };

  const productCards = productCardStyles.map((style) => ({
    ...style,
    name: tp(`${style.productKey}.name`),
    line1: tp(`${style.productKey}.line1`),
    line2: tp(`${style.productKey}.line2`),
    badge: style.productKey === "glyph" ? null : tp(`${style.productKey}.badge`),
    // 使用 home 命名空间完整路径：避免 getTranslations("home.products") 下嵌套键在部分版本中回退为原始 key
    badgeFree: style.productKey === "glyph" ? tHome("products.glyph.badgeFree") : null,
    badgeStruck: style.productKey === "glyph" ? tHome("products.glyph.badgeStruck") : null,
    cta: tp(`${style.productKey}.cta`),
  }));

  const meetsMomentCards = [
    { key: "card1" as const, href: "/poju", imageSrc: "/animations/S1.jpg" as const },
    { key: "card2" as const, href: "/glyph", imageSrc: "/animations/S2.jpg" as const },
    { key: "card3" as const, href: "/syncro", imageSrc: "/animations/S3.jpg" as const },
    { key: "card4" as const, href: "/poju", imageSrc: "/animations/S4.jpg" as const },
  ];

  return (
    <main className="bg-bg-deep text-text-body">
      <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
        <PaymentCancelToast />

        {/* Hero — 背景满铺；整体高度随视口抬高（min-height），横图 cover 裁切 */}
        <section className="relative w-full overflow-x-hidden overflow-y-visible">
          {heroBg ? (
            <>
              <div className="relative w-full min-h-[min(62vh,720px)] sm:min-h-[min(58vh,760px)] md:min-h-[min(65vh,840px)] lg:min-h-[min(68vh,920px)]">
                <Image
                  src={heroBg}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover object-[80%_42%] sm:object-cover sm:object-[center_38%]"
                />
              </div>
              {/* 压暗背景亮度，减轻亮部星云刺眼，叠在图上、文案下 */}
              <div
                className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-black/48 via-black/32 to-black/42"
                aria-hidden
              />
            </>
          ) : (
            <div className="min-h-[min(62vh,720px)] w-full bg-bg-deep sm:min-h-[min(58vh,760px)] md:min-h-[min(65vh,840px)]" aria-hidden />
          )}

          <div className="absolute inset-0 z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-col items-center justify-center px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-14 md:pb-24 md:pt-16">
            <div className="flex w-full max-w-[min(98vw,72rem)] flex-col items-center px-1">
              {/* [1] 品牌名 · 单行 + 紫色纵渐变（clip）；投影压暗亮背景 */}
              <p className="mx-auto max-w-none whitespace-nowrap bg-[linear-gradient(180deg,#ffffff_0%,#f5f3ff_12%,#ede9fe_28%,#d8b4fe_55%,#9333ea_85%,#7c3aed_100%)] bg-clip-text px-2 text-center font-primary text-[clamp(1.5rem,min(8.5vw,15vmin),7.75rem)] font-semibold uppercase leading-[0.95] tracking-[0.12em] text-transparent antialiased drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] drop-shadow-[0_0_28px_rgba(139,92,246,0.45)] sm:text-[clamp(2.25rem,min(11vw,15vmin),7.75rem)] md:text-[clamp(2.75rem,min(13vw,15vmin),7.75rem)]">
                {tHome("hero.brand")}
              </p>
              {/* [2] 主标题 · 大 */}
              <h1 className="font-primary mt-5 max-w-[min(40rem,92vw)] text-[clamp(1.2rem,3.6vw,2.35rem)] font-medium leading-snug tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] sm:mt-6 md:max-w-[44rem]">
                {tHome("hero.headline")}
              </h1>
              {/* [3] 副描述 · 中 */}
              <div className="font-primary mt-6 max-w-[min(36rem,92vw)] space-y-2 text-[clamp(0.9rem,2.15vw,1.125rem)] font-medium leading-relaxed text-[#f4f4f8] drop-shadow-[0_1px_10px_rgba(0,0,0,0.78)] sm:mt-7 sm:space-y-2.5 md:text-[1.0625rem] md:leading-8">
                <p>{tHome("hero.descLine1")}</p>
                <p>{tHome("hero.descLine2")}</p>
                <p>{tHome("hero.descLine3")}</p>
              </div>
              {/* [4] 信任标语 · 小（避免 text-dim 在深色背景上发绿/看不见） */}
              <p className="font-primary mt-8 max-w-xl text-[11px] font-normal leading-relaxed text-white/78 drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)] sm:mt-9 sm:text-xs md:text-[13px]">
                {tHome("hero.trustLine")}
              </p>
              <HeroInstallCta />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[11] h-6 bg-gradient-to-b from-transparent to-bg-deep" aria-hidden />
        </section>

        <div className="w-full px-4 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24">
          <section id="products" className="relative mx-auto w-full max-w-6xl">
            <h2 className="text-center text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[30px] md:text-[32px]">
              {tHome("threeWays.heading")}
            </h2>
            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 md:mt-24">
              {productCards.map((card, index) => {
                const tex = cardTexture[card.kind];
                return (
                  <Link
                    key={card.kind}
                    href={card.href}
                    aria-label={`${card.name} · ${card.cta}`}
                    className="group relative flex min-h-[300px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] p-4 text-left shadow-[0_24px_60px_rgba(0,0,0,0.35)] transition-all duration-500 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_28px_70px_rgba(6,10,28,0.5)] sm:min-h-[320px] sm:p-5"
                  >
                    <div
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]"
                      style={{ backgroundImage: card.cardGradient }}
                    />
                    {tex && card.kind !== "glyph" && card.kind !== "syncro" ? (
                      <div className="absolute inset-0 opacity-[0.22] mix-blend-soft-light">
                        <Image src={tex} alt="" fill className="object-cover object-center" sizes="(max-width:640px) 100vw, 33vw" />
                      </div>
                    ) : null}
                    <div
                      className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-90"
                      style={{ backgroundImage: card.overlayGradient }}
                    />
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                      <div className="absolute -inset-10 bg-[radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.16),transparent_55%)]" />
                    </div>
                    <ProductCardEffect kind={card.kind} />
                    {card.kind === "poju" ? <ProductCardPojuSpline /> : null}
                    {card.kind === "glyph" ? <ProductCardGlyphSpline /> : null}
                    {card.kind === "syncro" ? <ProductCardSyncroSpline /> : null}
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col text-left">
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <ProductCardIcon kind={card.kind} />
                          <p className="min-w-0 text-[17px] font-semibold leading-tight text-white sm:text-[18px]">{card.name}</p>
                        </div>
                        {card.kind === "glyph" && card.badgeFree != null && card.badgeStruck != null ? (
                          <span className="flex shrink-0 items-center gap-2 text-[16px] font-semibold sm:text-[17px]">
                            <span className="text-emerald-300">{card.badgeFree}</span>
                            <StruckPrice className="text-[15px] text-amber-300 tabular-nums sm:text-[16px]">
                              {card.badgeStruck}
                            </StruckPrice>
                          </span>
                        ) : (
                          <span
                            className={
                              index === 0
                                ? "shrink-0 text-[16px] font-semibold text-amber-300 sm:text-[17px]"
                                : "shrink-0 text-[16px] font-semibold text-sky-300 sm:text-[17px]"
                            }
                          >
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col justify-center py-2 sm:py-3">
                        <div className="space-y-2 text-left text-[16px] leading-relaxed text-white/90 sm:text-[17px] sm:leading-8">
                          <p>{card.line1}</p>
                          <p>{card.line2}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 justify-start pt-2 sm:pt-3">
                        <span className="whitespace-nowrap text-[16px] font-medium text-white/95 transition-all duration-300 group-hover:translate-x-1 sm:text-[17px]">
                          {card.cta}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <section className="mx-auto mt-20 w-full max-w-6xl pt-10 sm:pt-12 md:mt-28">
              <div className="px-0">
                <h3 className="text-center text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[30px] md:text-[32px]">
                  What we built. Why it works.
                </h3>
                <p className="mx-auto mt-5 max-w-3xl whitespace-pre-line text-center text-[16px] leading-8 text-white/88 sm:text-[17px]">
                  {"Two thousand years of human reflection on the questions \nthat matter. Confirmed by modern research. Translated \nby AI. All for one purpose: helping you see what you \ncouldn't see alone."}
                </p>
              </div>
              <div className="relative mt-10 aspect-[10/4] overflow-hidden rounded-2xl">
                <Image
                  src="/animations/P2V1.jpg"
                  alt=""
                  fill
                  className="object-cover object-center scale-100"
                  sizes="(max-width:1200px) 100vw, 1152px"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/78 via-black/46 to-black/12" aria-hidden />
                <div className="absolute inset-0 z-10 flex items-center justify-end p-7 sm:p-9 md:p-14">
                  <div className="max-w-[min(94%,42rem)] rounded-md bg-black/45 px-3 py-2.5 text-white/95 backdrop-blur-[1px] sm:px-3.5 sm:py-3">
                    <p className="text-[17px] font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[18px]">
                      Eastern Wisdom
                    </p>
                    <p className="mt-3 whitespace-pre-line text-[13.5px] leading-6 text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)] sm:text-[14px] sm:leading-7">
                      {"For two thousand years, Eastern philosophical\ntraditions have examined the questions humans\nkeep asking - about decision, direction, and\nthe patterns that shape a life.\n\nCareer. Love. Direction. Doubt.\n\nThese traditions weren't fortune-tellers.\nThey were frameworks for thinking - refined\nover 80 generations of human experience."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative mt-8 aspect-[10/4] overflow-hidden rounded-2xl">
                <Image
                  src="/animations/P3.jpg"
                  alt=""
                  fill
                  className="object-cover object-center scale-100"
                  sizes="(max-width:1200px) 100vw, 1152px"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/46 to-black/12" aria-hidden />
                <div className="absolute inset-0 z-10 flex items-center justify-start p-7 sm:p-9 md:p-14">
                  <div className="max-w-[min(94%,42rem)] rounded-md bg-black/45 px-3 py-2.5 text-white/95 backdrop-blur-[1px] sm:px-3.5 sm:py-3">
                    <p className="text-[17px] font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[18px]">
                      Modern Science
                    </p>
                    <p className="mt-3 whitespace-pre-line text-[13.5px] leading-6 text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)] sm:text-[14px] sm:leading-7">
                      {"What ancient observation noticed, modern research \nis beginning to measure.\n\nCognitive science on how we frame decisions. \nSpatial psychology on attention. Circadian \nbiology on natural rhythm. Behavioral economics \non cognitive bias.\n\nThe frameworks that worked for millennia, now \nvalidated by research."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative mt-8 aspect-[10/4] overflow-hidden rounded-2xl">
                <Image
                  src="/animations/P3-1.jpg"
                  alt=""
                  fill
                  className="object-cover object-center scale-100"
                  sizes="(max-width:1200px) 100vw, 1152px"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/78 via-black/46 to-black/12" aria-hidden />
                <div className="absolute inset-0 z-10 flex items-center justify-end p-7 sm:p-9 md:p-14">
                  <div className="max-w-[min(94%,42rem)] rounded-md bg-black/45 px-3 py-2.5 text-white/95 backdrop-blur-[1px] sm:px-3.5 sm:py-3">
                    <p className="text-[17px] font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[18px]">
                      AI Translation
                    </p>
                    <p className="mt-3 whitespace-pre-line text-[13.5px] leading-6 text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)] sm:text-[14px] sm:leading-7">
                      {"We took the frameworks these traditions developed. \nWe added what modern science has confirmed.\n\nFrameworks. Patterns. Timing. Moments.\n\nWe gave it to AI - to respond to your specific \nquestion, in your specific moment. Not to replace \nyour judgment, but to return the conversation to you."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-10 pb-10 md:pb-14">
                <h4 className="text-center text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[30px] md:text-[32px]">
                  This is what pojulife is for.
                </h4>
                <p className="mx-auto mt-5 max-w-4xl whitespace-pre-line text-center text-[16px] leading-8 text-white/88 sm:text-[17px]">
                  {"The questions that matter, met with the depth they \ndeserve - across two millennia of human reflection, \nthe rigor of modern research, and the immediacy of AI."}
                </p>
              </div>

              <div className="mt-16 md:mt-24">
                <h4 className="text-center text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[30px] md:text-[32px]">
                  {tHome("meetsMoment.heading")}
                </h4>
                <p className="mx-auto mt-5 max-w-3xl text-center text-[16px] leading-8 text-white/88 sm:text-[17px]">
                  {tHome("meetsMoment.subtitle")}
                </p>
                <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-4 lg:gap-6">
                  {meetsMomentCards.map(({ key, href, imageSrc }) => (
                    <Link
                      key={key}
                      href={href}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/16 hover:bg-white/[0.05]"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-black/45">
                        <Image
                          src={imageSrc}
                          alt=""
                          fill
                          className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
                          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                        />
                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                          aria-hidden
                        />
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                        <div className="min-h-0 flex-1 space-y-2 text-left text-[15px] leading-7 text-white/90 sm:text-[16px] sm:leading-8">
                          <p>{tHome(`meetsMoment.${key}.p1`)}</p>
                          <p>{tHome(`meetsMoment.${key}.p2`)}</p>
                          <p>{tHome(`meetsMoment.${key}.p3`)}</p>
                        </div>
                        <p className="mt-5 shrink-0 text-[15px] font-medium text-white/95 transition-transform duration-300 group-hover:translate-x-1 sm:text-[16px]">
                          → {tHome(`meetsMoment.${key}.cta`)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </section>

          <section className="relative mx-auto mt-16 w-full max-w-6xl overflow-hidden rounded-2xl px-4 py-12 md:mt-24 md:px-8 md:py-16">
            {promisesBg ? (
              <div className="pointer-events-none absolute inset-0">
                <Image src={promisesBg} alt="" fill className="object-cover object-center opacity-40" sizes="(max-width:1200px) 100vw, 1152px" />
              </div>
            ) : null}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg-deep via-bg-deep/95 to-bg-deep"
              aria-hidden
            />
            <div className="relative z-10">
              <h2 className="text-center text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] md:text-[36px]">
                What we promise. What we won&apos;t do.
              </h2>
              <div className="mx-auto mt-10 w-full max-w-6xl md:mt-12">
                <div className="grid gap-6 md:grid-cols-1">
                  <article className="rounded-xl bg-black/50 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <PromiseIconBadge tone="violet">
                        <Lock className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </PromiseIconBadge>
                      <div className="min-w-0">
                        <p className="text-[19px] font-semibold tracking-tight text-white">Never stored</p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">
                          Your conversations live encrypted on your device. Not on our servers. Not in our database.
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">
                          Even if we wanted to read them, we couldn&apos;t. Even if we were hacked, there&apos;d be nothing to leak.
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">Your words stay yours.</p>
                      </div>
                    </div>
                  </article>
                  <article className="rounded-xl bg-black/50 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <PromiseIconBadge tone="cyan">
                        <UserX className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </PromiseIconBadge>
                      <div className="min-w-0">
                        <p className="text-[19px] font-semibold tracking-tight text-white">Never required</p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">No account. No login. No password.</p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">
                          We ask for your email in two situations only: when you choose to purchase a session, or when you request a PDF of your reflection.
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">
                          In both cases, we send what you asked for — nothing more. No marketing. No newsletters. No drip campaigns. No sharing with third parties.
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">Your inbox stays yours.</p>
                      </div>
                    </div>
                  </article>
                  <article className="rounded-xl bg-black/50 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <PromiseIconBadge tone="amber">
                        <Scale className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </PromiseIconBadge>
                      <div className="min-w-0">
                        <p className="text-[19px] font-semibold tracking-tight text-white">Never manipulative</p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">
                          No subscriptions. No auto-renewals. No hidden fees. No upsells. No dark patterns.
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">
                          Each use is a single, transparent choice. Free tools are clearly free. Paid tools are clearly priced — once, when you decide to use them.
                        </p>
                        <p className="mt-3 text-[15px] leading-7 text-white/88">That&apos;s the entire business.</p>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
              <div className="mx-auto mt-12 max-w-3xl text-center">
                <p className="whitespace-pre-line text-[16px] leading-8 text-white/88 sm:text-[17px]">
                  {"We're not a company that sells data because we don't\ncollect data."}
                </p>
                <p className="mt-5">
                  <Link href="/privacy" className="text-sm font-medium text-text-accent underline-offset-4 hover:text-purple-vivid hover:underline sm:text-[15px]">
                    Read the full privacy architecture →
                  </Link>
                </p>
              </div>
            </div>
          </section>

          <section className="relative mx-auto mt-16 w-full max-w-6xl px-4 md:mt-24 md:px-6">
            <div className="flex flex-col items-center px-2 py-10 text-center sm:px-4 md:py-14">
              <h2 className="max-w-2xl text-[26px] font-semibold leading-snug text-white sm:text-[30px] md:text-[34px]">
                {tHome("finalCta.readyHeading")}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-[16px]">
                {tHome("finalCta.readySubheading")}
              </p>
              <div
                className="my-9 h-px w-full max-w-sm bg-gradient-to-r from-transparent via-white/25 to-transparent sm:my-10"
                aria-hidden
              />
              <div className="grid w-full max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4 md:gap-6 lg:gap-8">
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <ReadyCtaPillLink
                    href="/poju"
                    variant="poju"
                    title={tHome("finalCta.poju.title")}
                    ariaLabel={`${tHome("finalCta.poju.title")}. ${tHome("finalCta.poju.sub")}`}
                  />
                  <p className="max-w-[17rem] text-[13px] leading-snug text-white/72 sm:max-w-[13.5rem] sm:px-1 sm:text-[14px] md:max-w-none">
                    {tHome("finalCta.poju.sub")}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <ReadyCtaPillLink
                    href="/glyph"
                    variant="glyph"
                    title={tHome("finalCta.glyph.title")}
                    ariaLabel={`${tHome("finalCta.glyph.title")}. ${tHome("finalCta.glyph.sub")}`}
                  />
                  <p className="max-w-[17rem] text-[13px] leading-snug text-white/72 sm:max-w-[13.5rem] sm:px-1 sm:text-[14px] md:max-w-none">
                    {tHome("finalCta.glyph.sub")}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <ReadyCtaPillLink
                    href="/syncro"
                    variant="syncro"
                    title={tHome("finalCta.syncro.title")}
                    ariaLabel={`${tHome("finalCta.syncro.title")}. ${tHome("finalCta.syncro.sub")}`}
                  />
                  <p className="max-w-[17rem] text-[13px] leading-snug text-white/72 sm:max-w-[13.5rem] sm:px-1 sm:text-[14px] md:max-w-none">
                    {tHome("finalCta.syncro.sub")}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Suspense>
    </main>
  );
}
