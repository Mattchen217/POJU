"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { MatchDeliveryView } from "@/components/match/MatchDeliveryView";
import { acknowledgeDeliveryViewed } from "@/lib/archive/archive-delivery-pending";
import { useRouter } from "@/i18n/navigation";
import { loadMatchSession } from "@/lib/match/match-session";
import type { MatchSession } from "@/lib/match/types";

import "@/styles/match.css";

export function MatchResultPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("match.result");

  const matchId = typeof params.id === "string" ? params.id : "";
  const [session, setSession] = useState<MatchSession | null | undefined>(undefined);

  useEffect(() => {
    if (!matchId) return;
    acknowledgeDeliveryViewed(matchId);
  }, [matchId]);

  useEffect(() => {
    if (!matchId) {
      setSession(null);
      return;
    }
    void loadMatchSession(matchId).then((s) => {
      setSession(s);
    });
  }, [matchId]);

  if (session === undefined) {
    return (
      <main className="match-result-loading">
        <p>{t("loading")}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="match-error">
        <p>{t("not_found")}</p>
        <button type="button" onClick={() => router.push("/match")} className="match-primary-btn">
          {t("back_to_match")}
        </button>
      </main>
    );
  }

  return <MatchDeliveryView session={session} locale={session.locale || locale} />;
}
