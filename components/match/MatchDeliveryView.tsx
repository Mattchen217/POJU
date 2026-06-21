"use client";

import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { GlyphDeliveryBanners } from "@/components/glyph/GlyphDeliveryBanners";
import { MatchReport } from "@/components/match/MatchReport";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { normalizeSynergyType } from "@/lib/match/synergy-normalize";
import { SYNERGY_TYPES, type MatchSession, type SynergyType } from "@/lib/match/types";
import { extractMatchSummary } from "@/lib/poju/tool-result-summary";

import "@/styles/glyph-delivery.css";
import "@/styles/glyph-home.css";
import "@/styles/match.css";

type Props = {
  session: MatchSession;
  locale: string;
  variant?: "live" | "archive";
  header?: ReactNode;
  footer?: ReactNode;
};

export function MatchDeliveryView({
  session,
  locale,
  variant = "live",
  header,
  footer,
}: Props) {
  const t = useTranslations("match.report");
  const matchSummary = extractMatchSummary(session);
  const isArchive = variant === "archive";
  const synergyType = normalizeSynergyType(session.report.conclusion.synergy_type);
  const synergyInfo = SYNERGY_TYPES[synergyType as SynergyType] ?? SYNERGY_TYPES.adaptive_balance;

  return (
    <div
      className="glyph-reading-page match-reading-page browser-flow-page reading-ritual-fade-in"
      style={{ "--wind": synergyInfo.color_hex } as CSSProperties}
    >
      {header}

      {!isArchive ? (
        <ReturnToPojuCTA
          tool="match"
          resultId={session.match_id}
          resultData={matchSummary}
          variant="banner"
        />
      ) : null}

      <GlyphDeliveryBanners variant="others" />

      <MatchReport session={session} locale={locale} />

      <PojuDeepDiveCTA productId="match" result_id={session.match_id} result_data={matchSummary} />

      {!isArchive ? (
        <>
          <ReturnToPojuCTA
            tool="match"
            resultId={session.match_id}
            resultData={matchSummary}
            variant="footer"
          />
          <div className="glyph-reading-footer match-reading-footer">
            <p className="match-reading-footer__saved">{t("saved_to_archive")}</p>
            <Link href="/match" className="glyph-link-muted">
              {t("back_to_match")}
            </Link>
          </div>
        </>
      ) : null}

      {footer}
    </div>
  );
}
