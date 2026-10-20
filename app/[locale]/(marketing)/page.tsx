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
 * Classic marketing home remains at `/classic` until retired.
 */
export default function LandingPage() {
  return (
    <>
      {/* Document preload — metadata.other is not always emitted as <link>; keep explicit. */}
      <link rel="preload" href="/v2-landing" as="document" />
      <link
        rel="preload"
        href="/v2/EASTERN-OS-LOGO1.webp"
        as="image"
        type="image/webp"
        fetchPriority="high"
      />
      <link
        rel="preload"
        href="/v2/EASTERN-OS-LOGO2.webp"
        as="image"
        type="image/webp"
        fetchPriority="high"
      />
      <Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
        <HomeClientChrome />
        <V2WorkspaceLandingPage />
      </Suspense>
    </>
  );
}
