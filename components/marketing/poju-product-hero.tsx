import Link from "next/link";
import { HeroSpline } from "@/components/marketing/hero-spline";

/** Spline 画布 class 与落地页星云完全一致；人物用 initialZoom + 延迟 setZoom 适配新素材。 */
export function PojuProductHero() {
  return (
    <section className="relative">
      <div className="relative overflow-hidden pb-8 pt-8 sm:pb-10 sm:pt-10 md:pb-14 md:pt-14">
        <HeroSpline
          scene="/animations/POJURENscene.splinecode"
          initialZoom={0.62}
          className="pointer-events-none absolute -top-16 left-0 right-0 h-[430px] opacity-75 sm:-top-20 sm:h-[520px] md:-top-28 md:h-[660px]"
        />
        <div className="relative z-10 mx-auto flex min-h-[360px] w-full max-w-6xl items-center justify-center px-2 sm:min-h-[420px] sm:px-4 md:min-h-[520px] md:px-6">
          <div className="min-w-0 w-full max-w-[720px] text-center">
            <h1 className="mx-auto max-w-[720px] text-[36px] font-semibold leading-[1.06] text-text-primary sm:text-[44px] md:text-[52px] md:leading-[1.04] lg:text-[56px]">
              Breakthrough sessions for the question that won&apos;t let you go.
            </h1>
            <p className="mx-auto mt-6 max-w-xl px-2 text-[14px] leading-7 text-[#e6e8f3] sm:mt-7 sm:text-[15px] sm:leading-8 md:mt-8 md:px-0 md:text-[16px] md:leading-9">
              When you&apos;ve read the books, talked to friends, and still can&apos;t see clearly, POJU sits
              with you through it. An AI agent grounded in millennia of human reflection.
            </p>
            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:mt-12 sm:flex-row sm:flex-wrap md:mt-14">
              <Link
                href="/chat?token=ui-preview"
                className="inline-flex w-full min-w-0 justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto sm:min-w-[220px] md:px-10 md:py-4 md:text-base"
              >
                Ask your question — $9.99
              </Link>
              <Link
                href="/modal-pwa-install"
                className="poju-button-secondary inline-flex w-full min-w-0 justify-center !px-6 !py-3 text-[15px] sm:w-auto sm:min-w-[200px] md:!py-3.5 md:text-base"
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
