"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { LEVEL_META, type SignData } from "@/types/oracle";

type Props = {
  reading: GlyphReadingContent;
  glyph: SignData;
  question: string;
  archiveId?: string;
};

const TIMEFRAME_KEYS: Record<
  GlyphReadingContent["exploration"]["timeframe"],
  "explore_time_today" | "explore_time_tonight" | "explore_time_24h" | "explore_time_week"
> = {
  today: "explore_time_today",
  tonight: "explore_time_tonight",
  within_24h: "explore_time_24h",
  this_week: "explore_time_week",
};

export function GlyphReport({ reading, glyph, question, archiveId }: Props) {
  const t = useTranslations("glyph");
  const windLabel = LEVEL_META[glyph.level]?.display_name ?? glyph.level;
  const timeframeKey = TIMEFRAME_KEYS[reading.exploration.timeframe] ?? "explore_time_today";

  if (reading.invalid_input) {
    return (
      <div className="glyph-report">
        <div className="report-section meaning">
          <p>{t("reading_invalid_input")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glyph-report">
      <div className="report-section question-recap">
        <div className="section-label">{t("your_question_label")}</div>
        <p className="question-recap-text">{question}</p>
      </div>

      <div className="report-section wind-category">
        <h3>{windLabel}</h3>
        <p>{reading.wind_category_blurb}</p>
      </div>

      <div className="report-section classical">
        <div className="section-label">{t("section_classical")}</div>
        <p className="classical-text">{reading.classical_voice}</p>
      </div>

      <div className="report-section dual-view">
        <div className="section-label">{t("section_dual_view")}</div>

        <div className="dual-view-card view-bazi">
          <h4>{t("view_bazi_title")}</h4>
          <p>{reading.命理双视角.命理看此事}</p>
        </div>

        <div className="dual-view-card view-glyph">
          <h4>{t("view_glyph_title")}</h4>
          <p>{reading.命理双视角.签文看此事}</p>
        </div>

        <div className="dual-view-resonance">
          <p>{reading.命理双视角.两者印证或冲突}</p>
        </div>
      </div>

      <div className="report-section meaning">
        <div className="section-label">{t("section_meaning")}</div>
        <p>{reading.meaning_for_question}</p>
      </div>

      <div className="report-section tension">
        <div className="section-label">{t("section_hidden")}</div>
        <p>{reading.hidden_tension}</p>
      </div>

      <div className="report-section moment">
        <div className="section-label">{t("section_moment")}</div>
        <p>{reading.your_moment}</p>
      </div>

      <div className="report-section exploration">
        <div className="section-label">{t("section_exploration")}</div>
        <div className="exploration-card">
          <p className="explore-text">{reading.exploration.text}</p>
          <div className="explore-meta">
            <span>{t(timeframeKey)}</span>
            <span>·</span>
            <span>{reading.exploration.duration_estimate}</span>
            {reading.exploration.is_solo ? (
              <>
                <span>·</span>
                <span>{t("explore_solo")}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="report-section reflection">
        <div className="section-label">{t("section_reflection")}</div>
        <p className="reflection-question">{reading.reflection_question}</p>
      </div>

      {archiveId ? (
        <div className="archive-saved-hint">
          <p>{t("saved_to_archive")}</p>
          <Link href={`/archive/${archiveId}`} className="glyph-primary-btn glyph-report-archive-btn">
            {t("view_in_archive")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
