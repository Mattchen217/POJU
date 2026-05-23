"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { MainNav } from "@/components/layout/MainNav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { isChatRoute } from "@/lib/i18n/pathname-without-locale";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isChatRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="site-chrome flex min-h-screen flex-col text-text-body">
      <MainNav />
      <div className="site-chrome-main flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
