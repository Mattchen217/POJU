import { SyncroEnergyBall } from "@/components/syncro/syncro-energy-ball";
import { SyncroSmsLinkForm, type SyncroSmsLinkFormCopy } from "@/components/marketing/syncro-sms-link-form";
import {
  ProductHeroAccent,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroMeta,
  ProductHeroSplit,
  ProductHeroTitle,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";

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

export function SyncroProductHero({ copy }: { copy: SyncroProductHeroCopy }) {
  return (
    <ProductMarketingHero
      theme="syncro"
      layout="split"
      background={
        <SyncroEnergyBall
          variant="hero"
          initialZoom={1.05}
          className="absolute left-1/2 top-1/2 h-[600px] w-[132%] -translate-x-1/2 -translate-y-1/2 opacity-80 sm:h-[700px] md:h-[860px]"
        />
      }
    >
      <ProductHeroContent wide alignMd="left">
        <ProductHeroSplit>
          <div className="md:pt-6">
            <ProductHeroTitle>{copy.heading}</ProductHeroTitle>
            <ProductHeroAccent>{copy.subtitle}</ProductHeroAccent>
            <ProductHeroDescription>{copy.description}</ProductHeroDescription>
            <ProductHeroMeta bright className="!text-text-secondary">
              {copy.tagline}
            </ProductHeroMeta>
            <p className="product-hero__badge">{copy.footnote}</p>
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
        </ProductHeroSplit>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
