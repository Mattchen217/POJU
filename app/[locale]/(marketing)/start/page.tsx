"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * /start — thin redirect to `?next=` (default "/").
 *
 * Previously this gate forced mobile-browser visitors to /modal-pwa-install
 * before they could continue. We no longer block on PWA install: a mobile
 * browser gets the same experience as the PWA, so just forward to the target.
 */
export default function StartGatePage() {
  const router = useRouter();

  useEffect(() => {
    const rawNext =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") ?? "/"
        : "/";
    const nextPath = rawNext.startsWith("/") ? rawNext : "/";

    router.replace(nextPath);
  }, [router]);

  return <main className="min-h-screen bg-bg-deep" />;
}
