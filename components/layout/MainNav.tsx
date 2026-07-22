"use client";

import { useEffect, useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { ArchiveNavLabel } from "@/components/archive/ArchiveUnreadDot";
import { useArchiveUnread } from "@/components/archive/use-archive-unread";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { useUiShell } from "@/components/workspace/use-ui-shell";
import { Link } from "@/i18n/navigation";
import { getActiveNavFromPathname, type SiteNavActive } from "@/lib/i18n/pathname-without-locale";
import { mapProductHrefForShell } from "@/lib/ui-shell/resolve-ui-shell";
import { cn } from "@/lib/utils/classnames";

const NAV_ITEMS: { href: string; key: SiteNavActive }[] = [
  { href: "/poju", key: "poju" },
  { href: "/glyph", key: "glyph" },
  { href: "/match", key: "match" },
  { href: "/syncro", key: "syncro" },
  { href: "/archive", key: "archive" },
];

function MainNavInner({ homeHero = false }: { homeHero?: boolean }) {
  const pathname = usePathname();
  const active = getActiveNavFromPathname(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const tNav = useTranslations("nav");
  const { shell } = useUiShell();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  const tCommon = useTranslations("common");
  const brandLabel = tCommon("brand").replace(/^p/, "P");
  const { hasUnread: hasUnreadArchive } = useArchiveUnread();

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
            const href = mapProductHrefForShell(item.href, shell);
            return (
              <Link
                key={item.href}
                href={href}
                className={`glass-nav-item pj-nav-item ${isActive ? "active" : ""}`}
              >
                {item.key === "archive" ? (
                  <ArchiveNavLabel label={tNav(item.key)} showDot={hasUnreadArchive} />
                ) : (
                  tNav(item.key)
                )}
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

export function MainNav({ homeHero = false }: { homeHero?: boolean }) {
  return (
    <Suspense fallback={null}>
      <MainNavInner homeHero={homeHero} />
    </Suspense>
  );
}
