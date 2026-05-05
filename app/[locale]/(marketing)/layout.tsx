import type { ReactNode } from "react";

import { WipedToastListener } from "@/components/archive/wiped-toast-listener";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WipedToastListener />
    </>
  );
}
