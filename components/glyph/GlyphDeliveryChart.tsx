"use client";

import { useTranslations } from "next-intl";

import { StreamingAnalysisView } from "@/components/poju/StreamingAnalysisView";

type Props = {
  content: string;
};

/** Drop duplicate portrait H1 — panel title is shown separately. */
function stripPortraitHeading(text: string): string {
  return text.replace(/^#\s*[^\n]+\n+/, "").trimStart();
}

export function GlyphDeliveryChart({ content }: Props) {
  const t = useTranslations("glyph");
  const body = stripPortraitHeading(content);

  return (
    <div className="glyph-delivery-chart">
      <p className="glyph-delivery-chart__label">{t("delivery_chart_title")}</p>
      <div className="glyph-delivery-chart__scroll">
        <StreamingAnalysisView
          content={body}
          status="completed"
          bytes_received={body.length}
          layout="panel"
        />
      </div>
    </div>
  );
}
