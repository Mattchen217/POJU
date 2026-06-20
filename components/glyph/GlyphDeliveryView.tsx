"use client";

import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { GlyphDeliveryBanners } from "@/components/glyph/GlyphDeliveryBanners";
import { GlyphReport } from "@/components/glyph/GlyphReport";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { glyphWindAccentStyle } from "@/lib/glyph/glyph-wind-accents";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { extractGlyphSummary } from "@/lib/poju/tool-result-summary";
import type { SignData } from "@/types/oracle";

import "@/styles/glyph-delivery.css";
import "@/styles/glyph-home.css";

type Props = {
  reading: GlyphReadingContent;
  glyph: SignData;
  question: string;
  readingId: string;
  baseReportText?: string;
  /** Archive: hide live-session POJU return chrome; keep delivery report + CTA. */
  variant?: "live" | "archive";
  header?: ReactNode;
  footer?: ReactNode;
};

export function GlyphDeliveryView({
  reading,
  glyph,
  question,
  readingId,
  baseReportText,
  variant = "live",
  header,
  footer,
}: Props) {
  const t = useTranslations("glyph");
  const glyphSummary = extractGlyphSummary({
    reading_id: readingId,
    question,
    glyph,
    reading,
  });
  const isArchive = variant === "archive";

  return (
    <div
      className="glyph-reading-page browser-flow-page"
      style={glyphWindAccentStyle(glyph.level) as CSSProperties}
    >
      {header}

      {!isArchive ? (
        <ReturnToPojuCTA
          tool="glyph"
          resultId={readingId}
          resultData={glyphSummary}
          variant="banner"
        />
      ) : null}

      <GlyphDeliveryBanners variant="others" />

      <GlyphReport
        reading={reading}
        glyph={glyph}
        question={question}
        baseReportText={baseReportText}
      />

      <PojuDeepDiveCTA productId="glyph" result_id={readingId} result_data={glyphSummary} />

      {!isArchive ? (
        <>
          <ReturnToPojuCTA
            tool="glyph"
            resultId={readingId}
            resultData={glyphSummary}
            variant="footer"
          />
          <div className="glyph-reading-footer">
            <Link href="/glyph" className="glyph-link-muted">
              {t("back_to_glyph")}
            </Link>
          </div>
        </>
      ) : null}

      {footer}
    </div>
  );
}
