import Link from "next/link";

import { HeroSpline } from "@/components/marketing/hero-spline";

/**
 * Oracle Hero 保持与其他产品页一致的尺寸与定位：
 * - 主标题 + 副标题叙事 + 背景动效（其余内容在 Hero 外）
 * - 后续可直接替换 scene 为 Oracle 专属动画
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
          <div className="min-w-0 w-full max-w-[920px] text-center">
            <h1 className="mx-auto text-balance text-[36px] font-semibold leading-[1.08] text-text-primary sm:text-[40px] md:text-[48px] lg:text-[52px]">
              <span>Oracle Ancient Guidance · </span>
              <span className="bg-gradient-to-r from-[#7EEBFF] to-[#55E6FF] bg-clip-text text-transparent">
                Ask sincerely. Receive a sign.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl px-2 text-[14px] leading-7 text-[#e6e8f3] sm:mt-7 sm:text-[15px] sm:leading-8 md:mt-8 md:px-0 md:text-[16px] md:leading-9">
              Two thousand years ago, people in the East brought a single question to an ancient listening presence. The
              answer was never a voice. It was a sign — a card from a pattern library refined over a hundred generations.
            </p>
            <div className="mx-auto mt-8 flex flex-col items-center justify-center gap-4 sm:mt-9 sm:flex-row md:mt-10">
              <Link
                href="#oracle-enter"
                className="inline-flex min-w-[200px] justify-center rounded-full border border-amber-300/55 bg-amber-400/18 px-8 py-3.5 text-[15px] font-semibold text-amber-50 shadow-[0_10px_28px_rgba(251,191,36,0.35)] transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.04] hover:border-amber-200/90 hover:bg-gradient-to-r hover:from-amber-300/95 hover:to-amber-400/90 hover:text-neutral-950 hover:shadow-[0_14px_36px_rgba(251,191,36,0.55)] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] active:translate-y-0 md:px-10 md:py-4 md:text-base"
              >
                Start Oracle · Free
              </Link>
              <Link
                href="/modal-pwa-install"
                className="poju-button-secondary inline-flex min-w-[200px] justify-center !px-6 !py-3 text-[15px] md:!py-3.5 md:text-base"
              >
                Add to Home Screen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
