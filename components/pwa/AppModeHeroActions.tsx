"use client";

import { BeginButton, type BeginButtonProps } from "@/components/pwa/BeginButton";
import { AddToHomeCta } from "@/components/pwa/AddToHomeCta";
import { PWAOnly } from "@/components/pwa/PWAConditional";

import "@/styles/app-mode-product.css";

/** Hero CTAs in app mode: Begin (+ optional add-to-home in mobile browser). */
export function AppModeHeroActions(props: BeginButtonProps) {
  return (
    <PWAOnly>
      <div className="app-mode-hero-actions">
        <BeginButton {...props} useMarketingLabels />
        <AddToHomeCta />
      </div>
    </PWAOnly>
  );
}
