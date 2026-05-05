"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { isChatRoute } from "@/lib/i18n/pathname-without-locale";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isChatRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-deep text-text-body">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
