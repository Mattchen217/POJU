import Link from "next/link";

import { HeroSpline } from "@/components/marketing/hero-spline";

/**
 * Glyph Hero 保持与其他产品页一致的尺寸与定位：
 * - 主标题 + 副标题叙事 + 背景动效（其余内容在 Hero 外）
 * - 后续可直接替换 scene 为 Glyph 专属动画
 */
export function OracleProductHero() {
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
              Glyph
            </h1>
            <p className="mx-auto mt-4 text-[18px] font-medium text-fuchsia-200/95 sm:text-[20px]">A 60-second mirror.</p>
            <p className="mx-auto mt-4 max-w-xl px-2 text-[14px] leading-7 text-[#e6e8f3] sm:mt-5 sm:text-[15px] sm:leading-8 md:px-0 md:text-[16px] md:leading-9">
              Hold a question. Draw a pattern. Read a reflection.
            </p>
            <p className="mx-auto mt-3 text-sm text-text-dim sm:text-[15px]">Free. No signup. Read with a wink.</p>
            <div className="mx-auto mt-8 flex flex-col items-center justify-center sm:mt-9 md:mt-10">
              <Link
                href="/glyph/reading"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[200px] justify-center rounded-full border border-amber-300/55 bg-amber-400/18 px-8 py-3.5 text-[15px] font-semibold text-amber-50 shadow-[0_10px_28px_rgba(251,191,36,0.35)] transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.04] hover:border-amber-200/90 hover:bg-gradient-to-r hover:from-amber-300/95 hover:to-amber-400/90 hover:text-neutral-950 hover:shadow-[0_14px_36px_rgba(251,191,36,0.55)] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] active:translate-y-0 md:px-10 md:py-4 md:text-base"
              >
                Try Glyph — Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
