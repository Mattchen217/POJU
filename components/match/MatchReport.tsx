"use client";

import {
  ArrowLeft,
  Circle,
  Clock,
  Leaf,
  MessageCircle,
  Shield,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { GlossaryText } from "@/components/cross-product/GlossaryText";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { TermMarkFirstVisitHint } from "@/components/cross-product/TermMarkFirstVisitHint";

import { MatchReportCard } from "@/components/match/MatchReportCard";
import { ReadingDecoderBanner } from "@/components/reading-ritual/ReadingDecoderBanner";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { StreamingAnalysisView } from "@/components/poju/StreamingAnalysisView";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import { extractMatchSummary } from "@/lib/poju/tool-result-summary";
import { useRouter } from "@/i18n/navigation";
import { normalizeSynergyType } from "@/lib/match/synergy-normalize";
import {
  SYNERGY_TYPES,
  type MatchReport as MatchReportData,
  type MatchSession,
  type SynergyType,
} from "@/lib/match/types";

import "@/styles/match.css";

type MatchReportProps = {
  session: MatchSession;
  locale: string;
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  communication: MessageCircle,
  timing: Clock,
  boundary: Shield,
  growth: Sprout,
  environment: Leaf,
  fengshui: Leaf,
};

function ActionItem({
  action,
  index,
  locale,
}: {
  action: MatchReportData["recommendations"]["actions"][number];
  index: number;
  locale: string;
}) {
  const t = useTranslations("match.report");
  const CategoryIcon = CATEGORY_ICONS[action.category] ?? Circle;

  return (
    <div className="action-item">
      <div className="action-number">{index}</div>
      <div className="action-body">
        <div className="action-header">
          <span className="action-icon">
            <CategoryIcon size={15} strokeWidth={2} />
          </span>
          <h4>{action.title}</h4>
        </div>
        <div className="action-detail">
          <RichReadingText text={action.detail} locale={locale} />
        </div>
        {action.timing ? (
          <p className="action-timing">
            <span className="timing-label">{t("timing")}:</span> {action.timing}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MatchReport({ session, locale }: MatchReportProps) {
  const t = useTranslations("match.report");
  const router = useRouter();
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
  const questionResponse = report.conclusion.question_response?.trim();

  const matchSummary = extractMatchSummary(session);

  return (
    <main className="match-report browser-flow-page reading-ritual-fade-in">
      <ReturnToPojuCTA
        tool="match"
        resultId={session.match_id}
        resultData={matchSummary}
        variant="banner"
      />
      {baseReportA ? (
        <section className="match-base-report">
          <span className="match-base-report__label">A</span>
          <StreamingAnalysisView
            content={baseReportA}
            status="completed"
            bytes_received={baseReportA.length}
            layout="panel"
          />
        </section>
      ) : null}
      {baseReportB ? (
        <section className="match-base-report">
          <span className="match-base-report__label">B</span>
          <StreamingAnalysisView
            content={baseReportB}
            status="completed"
            bytes_received={baseReportB.length}
            layout="panel"
          />
        </section>
      ) : null}
      <header className="report-header">
        <h1>{t("title")}</h1>
        <p className="relationship-line">&ldquo;{session.relationship_description}&rdquo;</p>
      </header>

      <ReadingDecoderBanner variant="others" />
      <TermMarkFirstVisitHint />

      <div className="synergy-signal-panel-wrapper">
        <div className="synergy-signal-panel" style={{ color: synergyInfo.color_hex }}>
          <span className="signal-label">{t("resonance_label")}</span>
          <span className="signal-state-label">
            {isZh ? synergyInfo.name_zh : synergyInfo.name_en}
          </span>
          <div className="synergy-signal-track">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`signal-segment ${i <= synergyInfo.signal_segments ? "active" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="match-cards">
        <MatchReportCard icon="A" title={report.analysis_a.title} summary={report.analysis_a.summary} color="#ff7eb0">
          <div className="card-content">
            <RichReadingText text={report.analysis_a.detail} locale={locale} />
            <h4>{t("key_traits")}</h4>
            <ul className="traits-list">
              {report.analysis_a.key_traits.map((trait, i) => (
                <li key={i}>
                  <GlossaryText text={trait} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard icon="B" title={report.analysis_b.title} summary={report.analysis_b.summary} color="#b08cff">
          <div className="card-content">
            <RichReadingText text={report.analysis_b.detail} locale={locale} />
            <h4>{t("key_traits")}</h4>
            <ul className="traits-list">
              {report.analysis_b.key_traits.map((trait, i) => (
                <li key={i}>
                  <GlossaryText text={trait} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard icon="infinity" title={report.combined.title} summary={report.combined.summary} color="#e879f9">
          <div className="card-content">
            <RichReadingText text={report.combined.detail} locale={locale} />
            <h4>{t("five_elements")}</h4>
            <RichReadingText text={report.combined.five_elements_interaction} locale={locale} />
            <h4>{t("timing_dynamic")}</h4>
            <RichReadingText text={report.combined.timing_dynamic} locale={locale} />
          </div>
        </MatchReportCard>

        <MatchReportCard
          icon="award"
          title={report.conclusion.title}
          summary={report.conclusion.summary}
          color={synergyInfo.color_hex}
        >
          <div className="card-content">
            {questionResponse ? (
              <>
                <h4>{t("question_response_title")}</h4>
                <RichReadingText text={questionResponse} locale={locale} />
              </>
            ) : null}
            <RichReadingText text={report.conclusion.detail} locale={locale} />
            <h4>{t("strengths")}</h4>
            <ul className="strengths-list">
              {report.conclusion.strengths.map((s, i) => (
                <li key={i}>
                  <GlossaryText text={s} locale={locale} />
                </li>
              ))}
            </ul>
            <h4>{t("challenges")}</h4>
            <ul className="challenges-list">
              {report.conclusion.challenges.map((c, i) => (
                <li key={i}>
                  <GlossaryText text={c} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard
          icon="compass"
          title={report.recommendations.title}
          summary={report.recommendations.summary}
          color="#8b9cff"
        >
          <div className="card-content">
            <div className="actions-list">
              {report.recommendations.actions.map((action, i) => (
                <ActionItem
                  key={i}
                  action={action}
                  index={i + 1}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </MatchReportCard>
      </div>

      <PojuDeepDiveCTA productId="match" result_id={session.match_id} result_data={matchSummary} />

      <footer className="report-footer">
        <ReturnToPojuCTA
          tool="match"
          resultId={session.match_id}
          resultData={matchSummary}
          variant="footer"
        />
        <p>{t("saved_to_archive")}</p>
        <div className="report-footer-actions report-footer-actions--single">
          <button type="button" onClick={() => router.push("/match")} className="match-primary-btn">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            {t("back_to_match")}
          </button>
        </div>
      </footer>
    </main>
  );
}
