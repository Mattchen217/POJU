"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { getActiveNavFromPathname, type SiteNavActive } from "@/lib/i18n/pathname-without-locale";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { ArchiveNavLabel } from "@/components/archive/ArchiveUnreadDot";
import { useArchiveUnread } from "@/components/archive/use-archive-unread";

/** 与下方占位条一致：安全区 + 顶栏内容区 3rem（h-12） */
export const MOBILE_HEADER_OFFSET_CLASS =
  "h-[calc(3rem+env(safe-area-inset-top,0px))]";

export function SiteHeader() {
  const pathname = usePathname();
  const active = getActiveNavFromPathname(pathname);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const brandLabel = tCommon("brand");
  const { hasUnread: hasUnreadArchive } = useArchiveUnread();

  const cls = (key: SiteNavActive) =>
    active === key ? "text-white" : "transition-colors hover:text-white";

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[1000] isolate border-b border-white/[0.08] bg-[#0a0a0c] shadow-[0_1px_0_rgba(255,255,255,0.06)] md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="relative mx-auto grid h-12 w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 pr-24 sm:px-4 sm:pr-28">
          <Link
            href="/"
            className="inline-flex h-12 min-w-0 shrink touch-manipulation items-center leading-none [-webkit-tap-highlight-color:transparent]"
            aria-label={`${brandLabel} — ${tCommon("domain")}`}
          >
            <BrandLockup label={brandLabel} size="header" />
          </Link>

          <nav className="relative z-0 mx-auto flex min-w-0 max-w-full items-center justify-center gap-3 text-[13px] font-medium tracking-wide text-zinc-300">
            <Link href="/poju" className={`${cls("poju")} pointer-events-auto inline-flex h-12 items-center leading-none`}>
              {tNav("poju")}
            </Link>
            <Link href="/glyph" className={`${cls("glyph")} pointer-events-auto inline-flex h-12 items-center leading-none`}>
              {tNav("glyph")}
            </Link>
            <Link href="/syncro" className={`${cls("syncro")} pointer-events-auto inline-flex h-12 items-center leading-none`}>
              {tNav("syncro")}
            </Link>
            <Link href="/match" className={`${cls("match")} pointer-events-auto inline-flex h-12 items-center leading-none`}>
              {tNav("match")}
            </Link>
          </nav>

          <div className="absolute right-3 top-1/2 z-[2000] flex h-12 -translate-y-1/2 items-center justify-end sm:right-4">
            <MarketingLanguageSwitcher compact />
          </div>
        </div>
      </header>

      <div className={`${MOBILE_HEADER_OFFSET_CLASS} shrink-0 md:hidden`} aria-hidden />

      {/* Desktop */}
      <header className="sticky top-0 z-[130] hidden border-b border-white/[0.07] bg-neutral-950/65 backdrop-blur-xl supports-[backdrop-filter]:bg-neutral-950/45 md:block">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-6 py-3">
          <Link href="/" className="inline-flex min-w-0 items-center justify-self-start" aria-label={`${brandLabel} — ${tCommon("domain")}`}>
            <BrandLockup label={brandLabel} size="header" />
          </Link>

          <nav className="flex items-center justify-center gap-10 text-[14px] font-medium tracking-wide text-zinc-300">
            <Link href="/poju" className={cls("poju")}>
              {tNav("poju")}
            </Link>
            <Link href="/glyph" className={cls("glyph")}>
              {tNav("glyph")}
            </Link>
            <Link href="/syncro" className={cls("syncro")}>
              {tNav("syncro")}
            </Link>
            <Link href="/match" className={cls("match")}>
              {tNav("match")}
            </Link>
            <Link href="/archive" className={cls("archive")}>
              <ArchiveNavLabel label={tNav("archive")} showDot={hasUnreadArchive} />
            </Link>
          </nav>

          <div className="flex justify-self-end">
            <MarketingLanguageSwitcher />
          </div>
        </div>
      </header>
    </>
  );
}
