"use client";

import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { GlossaryText } from "@/components/cross-product/GlossaryText";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { GlyphDeliveryChart } from "@/components/glyph/GlyphDeliveryChart";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import { normalizeSynergyType } from "@/lib/match/synergy-normalize";
import {
  SYNERGY_TYPES,
  type MatchSession,
  type SynergyType,
} from "@/lib/match/types";

import "@/styles/glyph-delivery.css";
import "@/styles/match.css";

type MatchReportProps = {
  session: MatchSession;
  locale: string;
};

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="glyph-delivery-section-heading">
      <h2 className="glyph-delivery-section-title">{title}</h2>
    </div>
  );
}

export function MatchReport({ session, locale }: MatchReportProps) {
  const t = useTranslations("match.report");
  const [baseReportA, setBaseReportA] = useState<string | null>(null);
  const [baseReportB, setBaseReportB] = useState<string | null>(null);

  const { report } = session;
  const isZh = locale.startsWith("zh");

  useEffect(() => {
    void (async () => {
      const [a, b] = await Promise.all([
        getCachedBaseAnalysis(session.a_profile_id),
        getCachedBaseAnalysis(session.b_profile_id),
      ]);
      setBaseReportA(a?.reportText ?? null);
      setBaseReportB(b?.reportText ?? null);
    })();
  }, [session.a_profile_id, session.b_profile_id]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const synergyType = normalizeSynergyType(report.conclusion.synergy_type);
  const synergyInfo = SYNERGY_TYPES[synergyType as SynergyType] ?? SYNERGY_TYPES.adaptive_balance;
  const synergyName = isZh ? synergyInfo.name_zh : synergyInfo.name_en;
  const questionResponse = report.conclusion.question_response?.trim();
  const windStyle = { "--wind": synergyInfo.color_hex } as CSSProperties;
  const heroCount = (baseReportA ? 1 : 0) + (baseReportB ? 1 : 0);

  return (
    <div className="glyph-delivery-panel" style={windStyle}>
      <div className="glyph-delivery-inner">
        {heroCount > 0 ? (
          <section
            className={`glyph-delivery-hero match-delivery-hero${heroCount === 1 ? " match-delivery-hero--single" : ""}`}
          >
            {baseReportA ? (
              <div className="match-delivery-hero__slot match-delivery-hero__slot--a">
                <span className="match-delivery-hero__badge">A</span>
                <GlyphDeliveryChart content={baseReportA} />
              </div>
            ) : null}
            {baseReportB ? (
              <div className="match-delivery-hero__slot match-delivery-hero__slot--b">
                <span className="match-delivery-hero__badge">B</span>
                <GlyphDeliveryChart content={baseReportB} />
              </div>
            ) : null}
          </section>
        ) : null}

        {heroCount > 0 ? <div className="glyph-delivery-divider" aria-hidden /> : null}

        <header className="glyph-delivery-header">
          <p className="glyph-delivery-eyebrow">{t("delivery_eyebrow")}</p>
          <h1 className="glyph-delivery-question">
            &ldquo;{session.relationship_description}&rdquo;
          </h1>
          <div className="glyph-delivery-meta">
            <span>
              {t("meta_synergy")}:{" "}
              <strong className="glyph-delivery-meta__wind">{synergyName}</strong>
            </span>
            <span className="glyph-delivery-meta__sep">|</span>
            <span>
              {t("meta_resonance")}:{" "}
              <span className="glyph-delivery-meta__strategy">
                {synergyInfo.signal_segments} / 5
              </span>
            </span>
          </div>
        </header>

        <section className="glyph-delivery-wind-card" style={windStyle}>
          <p className="glyph-delivery-wind-card__eyebrow">{t("synergy_pattern_eyebrow")}</p>
          <h2 className="glyph-delivery-wind-card__title">{synergyName}</h2>
          <div className="match-synergy-segments" role="img" aria-label={`${synergyInfo.signal_segments} / 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`match-synergy-segment${i <= synergyInfo.signal_segments ? " match-synergy-segment--active" : ""}`}
              />
            ))}
          </div>
          {report.conclusion.summary?.trim() ? (
            <RichReadingText text={report.conclusion.summary} locale={locale} />
          ) : null}
        </section>

        <section className="glyph-delivery-section">
          <SectionHeading title={report.analysis_a.title} />
          <RichReadingText text={report.analysis_a.detail} locale={locale} />
          {report.analysis_a.key_traits.length > 0 ? (
            <ul className="reading-list match-traits-list match-traits-list--a">
              {report.analysis_a.key_traits.map((trait, i) => (
                <li key={i}>
                  <GlossaryText text={trait} locale={locale} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="glyph-delivery-section">
          <SectionHeading title={report.analysis_b.title} />
          <RichReadingText text={report.analysis_b.detail} locale={locale} />
          {report.analysis_b.key_traits.length > 0 ? (
            <ul className="reading-list match-traits-list match-traits-list--b">
              {report.analysis_b.key_traits.map((trait, i) => (
                <li key={i}>
                  <GlossaryText text={trait} locale={locale} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="glyph-delivery-section glyph-dual-section">
          <SectionHeading title={report.combined.title} />
          <RichReadingText text={report.combined.detail} locale={locale} />
          <div className="glyph-dual-block">
            <span className="glyph-dual-pill">{t("five_elements")}</span>
            <RichReadingText text={report.combined.five_elements_interaction} locale={locale} />
          </div>
          <div className="glyph-dual-block">
            <span className="glyph-dual-pill">{t("timing_dynamic")}</span>
            <RichReadingText text={report.combined.timing_dynamic} locale={locale} />
          </div>
        </section>

        <section className="glyph-delivery-section">
          <SectionHeading title={report.conclusion.title} />
          {questionResponse ? (
            <div className="reading-pullquote" style={windStyle}>
              <p className="reading-lead">{t("question_lead")}</p>
              <RichReadingText text={questionResponse} locale={locale} />
            </div>
          ) : null}
          {report.conclusion.detail?.trim() ? (
            <RichReadingText text={report.conclusion.detail} locale={locale} />
          ) : null}
          <div className="glyph-hidden-grid">
            <div className="glyph-synthesis-card">
              <h4 className="glyph-synthesis-card__title match-synthesis-title--favorable">
                {t("strengths")}
              </h4>
              <ul className="reading-list match-traits-list match-traits-list--favorable">
                {report.conclusion.strengths.map((s, i) => (
                  <li key={i}>
                    <GlossaryText text={s} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="glyph-synthesis-card">
              <h4 className="glyph-synthesis-card__title match-synthesis-title--caution">
                {t("challenges")}
              </h4>
              <ul className="reading-list match-traits-list match-traits-list--caution">
                {report.conclusion.challenges.map((c, i) => (
                  <li key={i}>
                    <GlossaryText text={c} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="glyph-delivery-section">
          <SectionHeading title={report.recommendations.title} />
          {report.recommendations.actions.map((action, i) => (
            <div key={i} className="glyph-dual-alignment">
              <div className="match-rec-head">
                <h3 className="glyph-dual-alignment__title match-rec-head__title">
                  {i + 1} · {action.title}
                </h3>
                {action.timing ? (
                  <span className="match-rec-head__timing">{action.timing}</span>
                ) : null}
              </div>
              <RichReadingText text={action.detail} locale={locale} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
