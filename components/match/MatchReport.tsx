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
import { useTranslations } from "next-intl";

import { MatchReportCard } from "@/components/match/MatchReportCard";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
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
}: {
  action: MatchReportData["recommendations"]["actions"][number];
  index: number;
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

  const synergyType = normalizeSynergyType(report.conclusion.synergy_type);
  const synergyInfo = SYNERGY_TYPES[synergyType as SynergyType] ?? SYNERGY_TYPES.adaptive_balance;

  const matchSummary = extractMatchSummary(session);

  return (
    <main className="match-report browser-flow-page">
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
            <p>{report.analysis_a.detail}</p>
            <h4>{t("key_traits")}</h4>
            <ul className="traits-list">
              {report.analysis_a.key_traits.map((trait, i) => (
                <li key={i}>{trait}</li>
              ))}
            </ul>
          </div>
        </MatchReportCard>

        <MatchReportCard icon="B" title={report.analysis_b.title} summary={report.analysis_b.summary} color="#b08cff">
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

        <MatchReportCard icon="infinity" title={report.combined.title} summary={report.combined.summary} color="#e879f9">
          <div className="card-content">
            <p>{report.combined.detail}</p>
            <h4>{t("five_elements")}</h4>
            <p>{report.combined.five_elements_interaction}</p>
            <h4>{t("timing_dynamic")}</h4>
            <p>{report.combined.timing_dynamic}</p>
          </div>
        </MatchReportCard>

        <MatchReportCard
          icon="award"
          title={report.conclusion.title}
          summary={report.conclusion.summary}
          color={synergyInfo.color_hex}
        >
          <div className="card-content">
            <p>{report.conclusion.detail}</p>
            <h4>{t("strengths")}</h4>
            <ul className="strengths-list">
              {report.conclusion.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h4>{t("challenges")}</h4>
            <ul className="challenges-list">
              {report.conclusion.challenges.map((c, i) => (
                <li key={i}>{c}</li>
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
