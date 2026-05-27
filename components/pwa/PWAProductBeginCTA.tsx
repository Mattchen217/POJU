"use client";

import { BeginButton, type BeginProductId } from "@/components/pwa/BeginButton";
import { PWAOnly } from "@/components/pwa/PWAConditional";

export type PWAProductBeginCTAProps = {
  productId: BeginProductId;
  price: string;
  freeFirstTime?: boolean;
};

export function PWAProductBeginCTA({ productId, price, freeFirstTime }: PWAProductBeginCTAProps) {
  return (
    <PWAOnly>
      <div className="pwa-product-begin">
        <BeginButton productId={productId} price={price} freeFirstTime={freeFirstTime} />
      </div>
    </PWAOnly>
  );
}
