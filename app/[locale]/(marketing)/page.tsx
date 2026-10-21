import type { Metadata } from "next";
import { Suspense } from "react";

import { V2WorkspaceLandingPage } from "@/components/ds/v2/V2WorkspaceLandingPage";
import { HomeClientChrome } from "@/components/marketing/home-client-chrome";

export const metadata: Metadata = {
  title: "Eastern OS",
  description:
    "Where AI meets a thousand years of wisdom. Decision support for the questions that won't let you go.",
};

/**
 * Public home = V2 workspace landing (iframe → /v2-landing).
 * Do not preload iframe assets here — the parent document never "uses" them,
 * which triggers unused-preload warnings and confuses Lighthouse.
 * Logo preloads live inside public/v2-landing.html where the <img> tags are.
 */
export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
      <HomeClientChrome />
      <V2WorkspaceLandingPage />
    </Suspense>
  );
}
