import type { ReactNode } from "react";

import { WipedToastListener } from "@/components/archive/wiped-toast-listener";
import { MarketingLocaleProvider } from "@/components/marketing/marketing-locale";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingLocaleProvider>
      {children}
      <WipedToastListener />
    </MarketingLocaleProvider>
  );
}
