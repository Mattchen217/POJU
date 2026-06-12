"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/** Reset window scroll on client navigations — runs before paint to avoid landing mid-page. */
export function MarketingScrollReset() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
