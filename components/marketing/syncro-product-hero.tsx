import { HeroSpline } from "@/components/marketing/hero-spline";
import { SyncroSmsLinkForm } from "@/components/marketing/syncro-sms-link-form";

/** 与落地页 Hero 同结构：背景 Spline + 居中主标题与按钮；说明与二维码在 Hero 动效层之外。 */
export function SyncroProductHero() {
  return (
    <section className="relative">
      <div className="relative overflow-hidden pb-8 pt-8 sm:pb-10 sm:pt-10 md:pb-14 md:pt-14">
        <HeroSpline
          scene="/animations/FWscene.splinecode"
          initialZoom={1.2}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[132%] -translate-x-1/2 -translate-y-1/2 opacity-75 sm:h-[700px] md:h-[860px]"
        />
        <div className="relative z-10 mx-auto flex min-h-[360px] w-full max-w-6xl items-center justify-center px-2 sm:min-h-[420px] sm:px-4 md:min-h-[520px] md:px-6">
          <div className="min-w-0 w-full max-w-[760px] text-center">
            <h1 className="mx-auto max-w-[760px] text-[36px] font-semibold leading-[1.08] text-text-primary sm:text-[40px] md:text-[48px] lg:text-[52px]">
              See your natural rhythms.
            </h1>
            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:mt-12 sm:flex-row sm:flex-wrap md:mt-14">
              <a
                href="https://pojulife.com/syncro"
                className="inline-flex w-full min-w-0 justify-center rounded-full border border-cyan-300/50 bg-cyan-400/25 px-8 py-3.5 text-[15px] font-semibold text-cyan-50 shadow-[0_10px_26px_rgba(34,211,238,0.28)] hover:bg-cyan-300/30 sm:w-auto sm:min-w-[220px] md:px-10 md:py-4 md:text-base"
              >
                Open Syncro on your phone
              </a>
              <a
                href="#syncro-use-cases"
                className="poju-button-secondary inline-flex w-full min-w-0 justify-center !px-6 !py-3 text-[15px] sm:w-auto sm:min-w-[200px] md:!py-3.5 md:text-base"
              >
                Explore use cases ↓
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 text-center sm:pb-12 md:px-6">
        <p className="mx-auto max-w-xl text-[14px] leading-7 text-[#e6e8f3] sm:text-[15px] sm:leading-8 md:text-[16px] md:leading-9">
          Based on your birth context, Syncro reflects how the day&apos;s energy aligns with your personal
          patterns. Think of it as a weather forecast for your inner life.
        </p>
        <p className="mx-auto mt-5 inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-100">
          Opens on mobile only
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 text-text-secondary sm:text-sm">
          Syncro needs your phone&apos;s compass, GPS, and camera. Scan the QR code or text yourself the link.
        </p>

        <div className="mx-auto mt-8 w-full max-w-[560px] rounded-2xl border border-white/12 bg-black/35 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:mt-10 sm:p-6 md:text-center">
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start md:justify-center md:text-left">
            <div className="mx-auto flex w-full max-w-[220px] justify-center md:mx-0">
              <div className="rounded-lg border border-white/12 bg-white p-3">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=https%3A%2F%2Fpojulife.com%2Fsyncro"
                  alt="QR code to open Syncro on mobile"
                  className="h-auto w-full"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="min-w-0 md:pt-1">
              <p className="text-center text-[11px] uppercase tracking-[0.14em] text-text-dim md:text-left">
                pojulife.com/syncro
              </p>
              <SyncroSmsLinkForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
