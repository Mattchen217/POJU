"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { PWAProductBeginCTA } from "@/components/pwa/PWAProductBeginCTA";
import { SyncroPwaContinuePrimary } from "@/components/syncro/SyncroPwaContinuePrimary";
import { SyncroRecentSessionsList } from "@/components/syncro/SyncroRecentSessionsList";
import { PWAOnly } from "@/components/pwa/PWAConditional";

import "@/styles/syncro-pwa-home.css";

/**
 * PWA Syncro home: resume in-progress readings (IndexedDB, 24h) then Begin for a new one.
 */
export function SyncroPwaHomeFooter() {
  const router = useRouter();
  const t = useTranslations("syncro.recent_sessions");

  return (
    <PWAOnly>
      <section id="syncro-start" className="syncro-pwa-home mx-auto w-full max-w-lg px-4 pb-24">
        <SyncroPwaContinuePrimary />
        <SyncroRecentSessionsList showEmptyHint />
        <p className="mt-6 text-center text-xs leading-6 text-text-dim">{t("pwa_storage_hint")}</p>
        <PWAProductBeginCTA productId="syncro" price="$4.99" />
        <p className="mt-3 text-center">
          <button
            type="button"
            className="text-xs text-cyan-200/80 underline decoration-cyan-200/30 underline-offset-2"
            onClick={() => router.push("/syncro/prepare?new=1")}
          >
            {t("start_new_link")}
          </button>
        </p>
      </section>
    </PWAOnly>
  );
}
