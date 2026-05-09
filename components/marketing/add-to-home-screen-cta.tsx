"use client";

import { AdaptivePwaInstallButton } from "@/components/pwa/adaptive-pwa-install-button";

export function AddToHomeScreenCta({ className = "" }: { className?: string }) {
  return (
    <AdaptivePwaInstallButton className={className}>Add to Home Screen</AdaptivePwaInstallButton>
  );
}
