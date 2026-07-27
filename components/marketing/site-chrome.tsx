"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { MainNav } from "@/components/layout/MainNav";
import { MarketingScrollReset } from "@/components/marketing/marketing-scroll-reset";
import { SiteFooter } from "@/components/marketing/site-footer";
import { UiShellSwitcher } from "@/components/workspace/UiShellSwitcher";
import {
  isAuthRoute,
  isChatRoute,
  isClassicLandingRoute,
  isHomeRoute,
  isWorkspaceAppRoute,
} from "@/lib/i18n/pathname-without-locale";
import { cn } from "@/lib/utils/classnames";

function SiteChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isChatRoute(pathname) || isWorkspaceAppRoute(pathname) || isAuthRoute(pathname)) {
    return <>{children}</>;
  }

  const home = isHomeRoute(pathname);
  const classicLanding = isClassicLandingRoute(pathname);

  /** V2 workspace landing brings its own nav/footer — skip marketing chrome. */
  if (home) {
    return (
      <>
        <MarketingScrollReset />
        {children}
        <UiShellSwitcher />
      </>
    );
  }

  return (
    <div
      className={cn(
        "site-chrome flex min-h-screen flex-col text-text-body",
        classicLanding && "site-chrome--home",
      )}
    >
      <MarketingScrollReset />
      <MainNav homeHero={classicLanding} />
      <div className="site-chrome-main flex-1">{children}</div>
      <SiteFooter />
      <UiShellSwitcher />
    </div>
  );
}

function SiteChromeFallback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isChatRoute(pathname) || isWorkspaceAppRoute(pathname) || isAuthRoute(pathname)) {
    return <>{children}</>;
  }
  if (isHomeRoute(pathname)) {
    return (
      <>
        <MarketingScrollReset />
        {children}
      </>
    );
  }
  const classicLanding = isClassicLandingRoute(pathname);
  return (
    <div
      className={cn(
        "site-chrome flex min-h-screen flex-col text-text-body",
        classicLanding && "site-chrome--home",
      )}
    >
      <MarketingScrollReset />
      <MainNav homeHero={classicLanding} />
      <div className="site-chrome-main flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<SiteChromeFallback>{children}</SiteChromeFallback>}>
      <SiteChromeInner>{children}</SiteChromeInner>
    </Suspense>
  );
}
