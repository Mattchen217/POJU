"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getActiveNavFromPathname, type SiteNavActive } from "@/lib/i18n/pathname-without-locale";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";

export function SiteHeader() {
  const pathname = usePathname();
  const active = getActiveNavFromPathname(pathname);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const cls = (key: SiteNavActive) =>
    active === key ? "text-white" : "transition-colors hover:text-white";

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-neutral-950/65 backdrop-blur-xl supports-[backdrop-filter]:bg-neutral-950/45">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6">
        <Link
          href="/"
          className="inline-flex min-w-0 items-center md:justify-self-start"
          aria-label={`${tCommon("brand")} — ${tCommon("domain")}`}
        >
          <BrandLockup label={tCommon("brand")} size="header" />
        </Link>
        <nav className="hidden items-center justify-center gap-9 text-[13px] font-medium tracking-wide text-zinc-300 md:flex md:justify-self-center md:gap-10 md:text-[14px]">
          <Link href="/poju" className={cls("poju")}>
            {tNav("poju")}
          </Link>
          <Link href="/glyph" className={cls("glyph")}>
            {tNav("glyph")}
          </Link>
          <Link href="/syncro" className={cls("syncro")}>
            {tNav("syncro")}
          </Link>
          <Link href="/archive" className={cls("archive")}>
            {tNav("archive")}
          </Link>
        </nav>
        <div className="flex shrink-0 justify-end md:justify-self-end">
          <MarketingLanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
