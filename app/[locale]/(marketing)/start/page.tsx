"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function StartGatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawNext = searchParams.get("next") ?? "/";
    const nextPath = rawNext.startsWith("/") ? rawNext : "/";
    const shouldRequirePwaInstall = isMobileDevice() && !isStandaloneMode();

    if (shouldRequirePwaInstall) {
      router.replace(`/modal-pwa-install?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    window.location.assign(nextPath);
  }, [router, searchParams]);

  return <main className="min-h-screen bg-bg-deep" />;
}
