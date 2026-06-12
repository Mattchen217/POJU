"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { Link } from "@/i18n/navigation";
import { getActiveNavFromPathname, type SiteNavActive } from "@/lib/i18n/pathname-without-locale";
import { cn } from "@/lib/utils/classnames";

const NAV_ITEMS: { href: string; key: SiteNavActive }[] = [
  { href: "/poju", key: "poju" },
  { href: "/glyph", key: "glyph" },
  { href: "/match", key: "match" },
  { href: "/syncro", key: "syncro" },
  { href: "/archive", key: "archive" },
];

export function MainNav({ homeHero = false }: { homeHero?: boolean }) {
  const pathname = usePathname();
  const active = getActiveNavFromPathname(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const tNav = useTranslations("nav");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  const tCommon = useTranslations("common");
  const brandLabel = tCommon("brand").replace(/^p/, "P");

  return (
    <nav
      className={cn("marketing-header main-nav-wrapper", homeHero && "main-nav-wrapper--home-hero")}
      aria-label={tNav("mobileSheetTitle")}
    >
      <div className="glass-nav pj-nav main-nav">
        <Link
          href="/"
          className="nav-logo"
          aria-label={`${brandLabel} — ${tCommon("domain")}`}
        >
          <BrandLockup label={brandLabel} size="footer" />
        </Link>

        <div className="nav-items hidden md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`glass-nav-item pj-nav-item ${isActive ? "active" : ""}`}
              >
                {tNav(item.key)}
              </Link>
            );
          })}
        </div>

        <div className="main-nav-actions">
          <button
            type="button"
            className="main-nav-menu-btn md:hidden"
            aria-label={tNav("mobileSheetTitle")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
              menu
            </span>
          </button>
          <div className="hidden md:block">
            <MarketingLanguageSwitcher />
          </div>
        </div>
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </nav>
  );
}
