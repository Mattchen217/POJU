import type { ReactNode } from "react";
import { HeroSpline } from "@/components/marketing/hero-spline";
import { PwaInlineOpenLink } from "@/components/marketing/pwa-inline-open-link";

export type OracleProductHeroCopy = {
  heading: string;
  subtitle: string;
  description: string;
  footnote: string;
  cta: string;
  ctaSubline: string;
};

/**
 * Glyph Hero 保持与其他产品页一致的尺寸与定位：
 * - 主标题 + 副标题叙事 + 背景动效（其余内容在 Hero 外）
 * - 后续可直接替换 scene 为 Glyph 专属动画
 */
export function OracleProductHero({
  copy,
  cta,
}: {
  copy: OracleProductHeroCopy;
  /** v5: `/glyph/prepare`; legacy pages may omit and use PWA reading link */
  cta?: ReactNode;
}) {
  return (
    <section className="relative">
      <div className="relative overflow-hidden pb-8 pt-8 sm:pb-10 sm:pt-10 md:pb-14 md:pt-14">
        <HeroSpline
          scene="/animations/BAOZHAscene.splinecode"
          initialZoom={0.92}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[108%] -translate-x-1/2 -translate-y-1/2 opacity-75 sm:h-[560px] md:h-[660px]"
        />
        <div className="relative z-10 mx-auto flex min-h-[360px] w-full max-w-6xl items-center justify-center px-2 sm:min-h-[420px] sm:px-4 md:min-h-[520px] md:px-6">
          <div className="min-w-0 w-full max-w-[680px] text-center">
            <h1 className="mx-auto text-balance text-[40px] font-semibold leading-[1.1] text-text-primary sm:text-[44px] md:text-[48px] lg:text-[52px]">
              {copy.heading}
            </h1>
            <p className="mx-auto mt-4 text-[18px] font-medium text-fuchsia-200/95 sm:text-[20px]">{copy.subtitle}</p>
            <p className="mx-auto mt-4 max-w-xl px-2 text-[14px] leading-7 text-white sm:mt-5 sm:text-[15px] sm:leading-8 md:px-0 md:text-[16px] md:leading-9">
              {copy.description}
            </p>
            <p className="mx-auto mt-3 text-sm text-text-dim sm:text-[15px]">{copy.footnote}</p>
            <div className="mx-auto mt-8 flex flex-col items-center justify-center sm:mt-9 md:mt-10">
              {cta ?? (
                <PwaInlineOpenLink
                  href="/start?next=%2Fglyph%2Freading"
                  frameTitle="Glyph"
                  closeLabel="关闭"
                  className="marketing-pill-outline-cta marketing-pill-outline-cta--amber inline-flex min-w-[200px] px-8 py-3.5 text-[15px] hover:-translate-y-0.5 hover:scale-[1.04] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] md:px-10 md:py-4 md:text-base"
                >
                  {copy.cta}
                </PwaInlineOpenLink>
              )}
              <p className="mt-2 max-w-md px-2 text-center text-[12px] leading-5 text-white sm:text-[13px] sm:leading-5 md:text-[14px] md:leading-6">
                {copy.ctaSubline}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
