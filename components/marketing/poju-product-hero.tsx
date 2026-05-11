import { HeroSpline } from "@/components/marketing/hero-spline";
import { PojuSessionStarter } from "@/components/poju/poju-session-starter";

export type PojuProductHeroCopy = {
  heading: string;
  description: string;
  tagline: string;
  ctaPrimary: string;
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
          <div className="min-w-0 w-full max-w-[680px] text-center">
            <h1 className="mx-auto text-balance text-[40px] font-semibold leading-[1.1] text-text-primary sm:text-[44px] md:text-[48px] lg:text-[52px]">
              {`POJU · ${copy.heading}`}
            </h1>
            <p className="mx-auto mt-5 max-w-xl px-2 text-[14px] leading-7 text-[#e6e8f3] sm:mt-6 sm:text-[15px] sm:leading-8 md:mt-7 md:px-0 md:text-[16px] md:leading-9">
              {copy.description}
            </p>
            <p className="mx-auto mt-4 max-w-lg px-2 text-[15px] font-semibold leading-8 text-text-primary sm:text-[16px] md:px-0">
              {copy.tagline}
            </p>
            <div className="mx-auto mt-9 flex max-w-xl flex-col items-center justify-center gap-4 sm:mt-10 sm:flex-row sm:flex-wrap md:mt-12">
              <PojuSessionStarter className="marketing-pill-outline-cta marketing-pill-outline-cta--violet inline-flex w-full min-w-0 px-8 py-3.5 text-[15px] hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:w-auto sm:min-w-[220px] md:px-10 md:py-4 md:text-base">
                {copy.ctaPrimary}
              </PojuSessionStarter>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
