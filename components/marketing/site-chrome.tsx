"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { MainNav } from "@/components/layout/MainNav";
import { MarketingScrollReset } from "@/components/marketing/marketing-scroll-reset";
import { SiteFooter } from "@/components/marketing/site-footer";
import { UiShellSwitcher } from "@/components/workspace/UiShellSwitcher";
import { useUiShell } from "@/components/workspace/use-ui-shell";
import { isChatRoute, isHomeRoute, isWorkspaceAppRoute } from "@/lib/i18n/pathname-without-locale";
import { cn } from "@/lib/utils/classnames";

function SiteChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { shell, ready } = useUiShell();

  if (isChatRoute(pathname) || isWorkspaceAppRoute(pathname)) {
    return <>{children}</>;
  }

  const home = isHomeRoute(pathname);
  /** V2 workspace landing brings its own nav/footer — skip marketing chrome. */
  const workspaceHome = home && ready && shell === "workspace";

  if (workspaceHome) {
    return (
      <>
        <MarketingScrollReset />
        {children}
        <UiShellSwitcher />
      </>
    );
  }

  return (
    <div className={cn("site-chrome flex min-h-screen flex-col text-text-body", home && "site-chrome--home")}>
      <MarketingScrollReset />
      <MainNav homeHero={home} />
      <div className="site-chrome-main flex-1">{children}</div>
      <SiteFooter />
      <UiShellSwitcher />
    </div>
  );
}

function SiteChromeFallback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isChatRoute(pathname) || isWorkspaceAppRoute(pathname)) {
    return <>{children}</>;
  }
  const home = isHomeRoute(pathname);
  return (
    <div className={cn("site-chrome flex min-h-screen flex-col text-text-body", home && "site-chrome--home")}>
      <MarketingScrollReset />
      <MainNav homeHero={home} />
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
