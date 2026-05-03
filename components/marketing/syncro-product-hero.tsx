import { HeroSpline } from "@/components/marketing/hero-spline";
import { SyncroSmsLinkForm } from "@/components/marketing/syncro-sms-link-form";

/** Hero + QR 同一首屏；移动端隐藏二维码，强调打开链接。 */
export function SyncroProductHero() {
  return (
    <section className="relative">
      <div className="relative overflow-hidden pb-6 pt-8 sm:pb-8 sm:pt-10 md:pb-12 md:pt-12">
        <HeroSpline
          scene="/animations/FWscene.splinecode"
          initialZoom={1.2}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[132%] -translate-x-1/2 -translate-y-1/2 opacity-75 sm:h-[700px] md:h-[860px]"
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="grid items-start gap-10 md:grid-cols-[1fr_360px] md:gap-12">
            <div className="pt-2 text-center md:pt-6 md:text-left">
              <h1 className="text-[36px] font-semibold leading-[1.08] text-text-primary sm:text-[40px] md:text-[48px] lg:text-[52px]">
                Syncro
              </h1>
              <p className="mt-3 text-[18px] font-medium text-cyan-100/95 sm:text-[20px]">See your natural rhythms.</p>
              <p className="mx-auto mt-6 max-w-xl text-[14px] leading-7 text-[#e6e8f3] sm:text-[15px] sm:leading-8 md:mx-0 md:mt-7 md:text-[16px] md:leading-9">
                Based on your birth context, Syncro reflects how the day&apos;s patterns align with you. Where to lean
                in. Where to slow down.
              </p>
              <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-text-secondary sm:text-[15px] md:mx-0">
                A weather forecast for your inner life, updated every two hours.
              </p>
              <p className="mx-auto mt-5 inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-100 md:mx-0">
                Free · Opens on mobile only
              </p>
              <div className="mt-6 flex justify-center md:justify-start">
                <a
                  href="https://pojulife.com/syncro"
                  className="inline-flex w-full max-w-sm justify-center rounded-full border border-cyan-300/50 bg-cyan-400/25 px-8 py-3.5 text-[15px] font-semibold text-cyan-50 shadow-[0_10px_26px_rgba(34,211,238,0.28)] hover:bg-cyan-300/30 md:w-auto"
                >
                  Open Syncro
                </a>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="rounded-2xl border border-white/12 bg-black/35 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:p-6">
                <div className="mx-auto flex w-full max-w-[280px] justify-center">
                  <div className="rounded-lg border border-white/12 bg-white p-3">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=https%3A%2F%2Fpojulife.com%2Fsyncro"
                      alt="QR code to open Syncro on mobile"
                      className="h-auto w-full"
                      loading="lazy"
                    />
                  </div>
                </div>
                <p className="mt-4 text-center text-[11px] uppercase tracking-[0.14em] text-text-dim">pojulife.com/syncro</p>
                <SyncroSmsLinkForm />
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-8 md:hidden">
            <p className="text-center text-xs text-text-dim">Text yourself the link</p>
            <div className="mx-auto mt-3 max-w-md">
              <SyncroSmsLinkForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
