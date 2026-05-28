"use client";

import { useTranslations } from "next-intl";

import { MatchReportCard } from "@/components/match/MatchReportCard";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { extractMatchSummary } from "@/lib/poju/tool-result-summary";
import { Link, useRouter } from "@/i18n/navigation";
import {
  COMPATIBILITY_LEVELS,
  type CompatibilityLevel,
  type MatchReport as MatchReportData,
  type MatchSession,
} from "@/lib/match/types";

import "@/styles/match.css";

type MatchReportProps = {
  session: MatchSession;
  locale: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  communication: "💬",
  timing: "⏰",
  boundary: "⊞",
  growth: "🌱",
  fengshui: "🏯",
};

function ActionItem({
  action,
  index,
}: {
  action: MatchReportData["recommendations"]["actions"][number];
  index: number;
}) {
  const t = useTranslations("match.report");

  return (
    <div className="action-item">
      <div className="action-number">{index}</div>
      <div className="action-body">
        <div className="action-header">
          <span className="action-icon">{CATEGORY_ICONS[action.category] ?? "•"}</span>
          <h4>{action.title}</h4>
        </div>
        <p className="action-detail">{action.detail}</p>
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

  const { report } = session;
  const isZh = locale.startsWith("zh");

  const levelKey = report.conclusion.compatibility_level;
  const compatibilityInfo =
    COMPATIBILITY_LEVELS[levelKey as CompatibilityLevel] ?? COMPATIBILITY_LEVELS.neutral;

  const matchSummary = extractMatchSummary(session);

  return (
    <main className="match-report">
      <ReturnToPojuCTA
        tool="match"
        resultId={session.match_id}
        resultData={matchSummary}
        variant="banner"
      />
      <header className="report-header">
        <h1>{t("title")}</h1>
        <p className="relationship-line">&ldquo;{session.relationship_description}&rdquo;</p>
      </header>

      <div className="compatibility-badge-wrapper">
        <div
          className="compatibility-badge"
          style={{
            borderColor: compatibilityInfo.color_hex,
            color: compatibilityInfo.color_hex,
          }}
        >
          <span className="badge-label">{t("compatibility_label")}</span>
          <span className="badge-level">
            {isZh ? compatibilityInfo.name_zh : compatibilityInfo.name_en}
          </span>
          <div className="badge-bars">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`bar ${i <= compatibilityInfo.score ? "filled" : ""}`}
                style={
                  i <= compatibilityInfo.score
                    ? { background: compatibilityInfo.color_hex }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="match-cards">
        <MatchReportCard icon="A" title={report.analysis_a.title} summary={report.analysis_a.summary} color="#D4AF37">
          <div className="card-content">
            <p>{report.analysis_a.detail}</p>
            <h4>{t("key_traits")}</h4>
            <ul className="traits-list">
              {report.analysis_a.key_traits.map((trait, i) => (
                <li key={i}>{trait}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard icon="B" title={report.analysis_b.title} summary={report.analysis_b.summary} color="#87CEEB">
          <div className="card-content">
            <p>{report.analysis_b.detail}</p>
            <h4>{t("key_traits")}</h4>
            <ul className="traits-list">
              {report.analysis_b.key_traits.map((trait, i) => (
                <li key={i}>{trait}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard icon="×" title={report.combined.title} summary={report.combined.summary} color="#E91E63">
          <div className="card-content">
            <p>{report.combined.detail}</p>
            <h4>{t("five_elements")}</h4>
            <p>{report.combined.five_elements_interaction}</p>
            <h4>{t("timing_dynamic")}</h4>
            <p>{report.combined.timing_dynamic}</p>
          </div>
        </MatchReportCard>

        <MatchReportCard
          icon="🎯"
          title={report.conclusion.title}
          summary={report.conclusion.summary}
          color={compatibilityInfo.color_hex}
        >
          <div className="card-content">
            <p>{report.conclusion.detail}</p>
            <h4>{t("strengths")}</h4>
            <ul className="strengths-list">
              {report.conclusion.strengths.map((s, i) => (
                <li key={i}>✓ {s}</li>
              ))}
            </ul>
            <h4>{t("challenges")}</h4>
            <ul className="challenges-list">
              {report.conclusion.challenges.map((c, i) => (
                <li key={i}>⚠ {c}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard
          icon="📋"
          title={report.recommendations.title}
          summary={report.recommendations.summary}
          color="#4CAF50"
        >
          <div className="card-content">
            <div className="actions-list">
              {report.recommendations.actions.map((action, i) => (
                <ActionItem key={i} action={action} index={i + 1} />
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
        {session.compatibility_score != null ? (
          <p className="match-engine-note">
            {t("engine_note", { score: session.compatibility_score.toFixed(1) })}
          </p>
        ) : null}
        <p>{t("saved_to_archive")}</p>
        <div className="report-footer-actions">
          <Link href="/archive" className="match-report-btn-secondary">
            {t("view_archive")}
          </Link>
          <button type="button" onClick={() => router.push("/match")} className="match-primary-btn">
            {t("new_match")}
          </button>
        </div>
      </footer>
    </main>
  );
}
