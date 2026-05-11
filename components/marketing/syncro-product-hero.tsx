import { SyncroEnergyBall } from "@/components/syncro/syncro-energy-ball";
import { SyncroSmsLinkForm, type SyncroSmsLinkFormCopy } from "@/components/marketing/syncro-sms-link-form";

export type SyncroProductHeroCopy = {
  heading: string;
  subtitle: string;
  description: string;
  tagline: string;
  footnote: string;
  qrLabel: string;
  qrAlt: string;
  smsForm: SyncroSmsLinkFormCopy;
};

/** Hero + QR 同一首屏；移动端隐藏二维码；短信表单仅渲染一次 */
export function SyncroProductHero({ copy }: { copy: SyncroProductHeroCopy }) {
  return (
    <section className="relative">
      <div className="relative overflow-hidden pb-6 pt-8 sm:pb-8 sm:pt-10 md:pb-12 md:pt-12">
        <SyncroEnergyBall
          initialZoom={1.05}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[132%] -translate-x-1/2 -translate-y-1/2 opacity-80 sm:h-[700px] md:h-[860px]"
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="grid items-start gap-10 md:grid-cols-[1fr_360px] md:gap-12">
            <div className="pt-2 text-center md:pt-6 md:text-left">
              <h1 className="text-[36px] font-semibold leading-[1.08] text-text-primary sm:text-[40px] md:text-[48px] lg:text-[52px]">
                {copy.heading}
              </h1>
              <p className="mt-3 text-[18px] font-medium text-cyan-100/95 sm:text-[20px]">{copy.subtitle}</p>
              <p className="mx-auto mt-6 max-w-xl text-[14px] leading-7 text-[#e6e8f3] sm:text-[15px] sm:leading-8 md:mx-0 md:mt-7 md:text-[16px] md:leading-9">
                {copy.description}
              </p>
              <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-text-secondary sm:text-[15px] md:mx-0">
                {copy.tagline}
              </p>
              <p className="mx-auto mt-5 inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-100 md:mx-0">
                {copy.footnote}
              </p>
            </div>

            <div className="flex flex-col gap-4 md:pt-2">
              <div className="hidden rounded-2xl border border-white/12 bg-black/35 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:p-6 md:block">
                <div className="mx-auto flex w-full max-w-[280px] justify-center">
                  <div className="rounded-lg border border-white/12 bg-white p-3">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=https%3A%2F%2Fpojulife.com%2Fsyncro"
                      alt={copy.qrAlt}
                      className="h-auto w-full"
                      loading="lazy"
                    />
                  </div>
                </div>
                <p className="mt-4 text-center text-[11px] uppercase tracking-[0.14em] text-text-dim">{copy.qrLabel}</p>
              </div>
              <SyncroSmsLinkForm {...copy.smsForm} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
