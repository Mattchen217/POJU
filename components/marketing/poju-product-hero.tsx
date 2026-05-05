import { Link } from "@/i18n/navigation";
import { HeroSpline } from "@/components/marketing/hero-spline";

export type PojuProductHeroCopy = {
  kicker: string;
  heading: string;
  description: string;
  tagline: string;
  ctaPrimary: string;
  ctaSecondary: string;
};

/** Spline 画布 class 与落地页星云完全一致；人物用 initialZoom + 延迟 setZoom 适配新素材。 */
export function PojuProductHero({ copy }: { copy: PojuProductHeroCopy }) {
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
            <p className="mb-3 font-primary text-[13px] font-semibold uppercase tracking-[0.18em] text-purple-vivid sm:mb-4 sm:text-sm md:text-[15px]">
              {copy.kicker}
            </p>
            <h1 className="mx-auto max-w-[720px] text-[36px] font-semibold leading-[1.06] text-text-primary sm:text-[44px] md:text-[52px] md:leading-[1.04] lg:text-[56px]">
              {copy.heading}
            </h1>
            <p className="mx-auto mt-6 max-w-xl px-2 text-[14px] leading-7 text-[#e6e8f3] sm:mt-7 sm:text-[15px] sm:leading-8 md:mt-8 md:px-0 md:text-[16px] md:leading-9">
              {copy.description}
            </p>
            <p className="mx-auto mt-4 max-w-xl px-2 text-[14px] font-medium leading-7 text-text-primary sm:text-[15px] md:px-0 md:text-[16px]">
              {copy.tagline}
            </p>
            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:mt-12 sm:flex-row sm:flex-wrap md:mt-14">
              <Link
                href="/chat?token=ui-preview"
                className="inline-flex w-full min-w-0 justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto sm:min-w-[220px] md:px-10 md:py-4 md:text-base"
              >
                {copy.ctaPrimary}
              </Link>
              <Link
                href="/poju#how-poju-works"
                className="poju-button-secondary inline-flex w-full min-w-0 justify-center !px-6 !py-3 text-[15px] sm:w-auto sm:min-w-[200px] md:!py-3.5 md:text-base"
              >
                {copy.ctaSecondary}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
