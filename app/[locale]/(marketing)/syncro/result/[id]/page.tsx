"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroMainView } from "@/components/syncro/SyncroMainView";
import { SyncroOrientationProvider } from "@/components/syncro/SyncroOrientationProvider";
import { Link } from "@/i18n/navigation";
import { isSyncroSessionExpired, loadSyncroSession } from "@/lib/syncro/syncro-session";
import type { SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro.css";

type Stage = "loading" | "ready" | "expired" | "error";

function SyncroResultPageContent() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("syncro.expired");
  const tError = useTranslations("syncro.main");

  const sessionId = params.id as string;

  const [session, setSession] = useState<SyncroSession | null>(null);
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  async function loadSession() {
    try {
      const expired = await isSyncroSessionExpired(sessionId);
      if (expired) {
        setStage("expired");
        return;
      }

      const s = await loadSyncroSession(sessionId);
      if (!s) {
        setStage("error");
        return;
      }

      setSession(s);
      setStage("ready");
    } catch {
      setStage("error");
    }
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-deep text-text-dim">
        …
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="syncro-expired">
        <h2>{t("title")}</h2>
        <p>{t("message")}</p>
        <Link href="/syncro" className="primary">
          {t("cta")}
        </Link>
      </div>
    );
  }

  if (stage === "error" || !session) {
    return (
      <div className="syncro-error flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center">
        <p className="text-text-secondary">{tError("session_not_found")}</p>
        <Link href="/syncro" className="mt-6 text-cyan-200 underline">
          {t("cta")}
        </Link>
      </div>
    );
  }

  return (
    <SyncroOrientationProvider>
      <SyncroMainView session={session} locale={locale} />
    </SyncroOrientationProvider>
  );
}

export default function SyncroResultPage() {
  return (
    <SyncroGuardedRoute>
      <SyncroResultPageContent />
    </SyncroGuardedRoute>
  );
}
