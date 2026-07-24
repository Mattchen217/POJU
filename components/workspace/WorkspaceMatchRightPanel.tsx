"use client";

import { useLocale, useTranslations } from "next-intl";

import { MatchDeliveryView } from "@/components/match/MatchDeliveryView";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { MatchPairIcon } from "@/components/workspace/workspace-engine-icons";
import { WorkspaceMatchRailBaseWait } from "@/components/workspace/WorkspaceMatchRailBaseWait";
import { WorkspaceRailBaseReport } from "@/components/workspace/WorkspaceRailBaseReport";
import { useWorkspaceMatchPrepare } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";

/**
 * Right rail after Match warmup: dual energy portraits (Match A / Match B),
 * base-analysis wait anims during generating, then A/B report papers + Match card.
 */
export function WorkspaceMatchRightPanel() {
  const t = useTranslations("match.workspace");
  const tRail = useTranslations("workspace.pojuRail");
  const tBase = useTranslations("base_analysis_view");
  const locale = useLocale();
  const match = useWorkspaceMatchPrepare();

  const showRail =
    match.phase === "inquiry" ||
    match.phase === "paywall" ||
    match.phase === "generating" ||
    match.phase === "delivery";

  if (!showRail) {
    return <div className="workspace-right-drawer-placeholder" aria-hidden />;
  }

  const titleA = t("portrait_a", { title: tRail("matrixIconLabel") });
  const titleB = t("portrait_b", { title: tRail("matrixIconLabel") });
  const reportTitleA = t("portrait_a", { title: tBase("title") });
  const reportTitleB = t("portrait_b", { title: tBase("title") });

  const aGenerating = match.reportAStatus === "generating";
  const bGenerating = match.reportBStatus === "generating";
  const aReady = match.reportAStatus === "ready" && Boolean(match.reportAText);
  const bReady = match.reportBStatus === "ready" && Boolean(match.reportBText);
  const matchReady = match.matchReportStatus === "ready" && Boolean(match.matchSession);

  if (match.reportAExpanded && aReady && match.reportAText) {
    return (
      <section className="workspace-right-matrix" aria-label={reportTitleA}>
        <WorkspaceRailBaseReport
          displayText={match.reportAText}
          locale={locale}
          coverTitle={reportTitleA}
          expanded
          unread={match.reportUnreadA}
          onExpandedChange={(open) => match.setReportAExpanded(open)}
        />
      </section>
    );
  }

  if (match.reportBExpanded && bReady && match.reportBText) {
    return (
      <section className="workspace-right-matrix" aria-label={reportTitleB}>
        <WorkspaceRailBaseReport
          displayText={match.reportBText}
          locale={locale}
          coverTitle={reportTitleB}
          expanded
          unread={match.reportUnreadB}
          onExpandedChange={(open) => match.setReportBExpanded(open)}
        />
      </section>
    );
  }

  if (match.matchReportExpanded && matchReady && match.matchSession) {
    return (
      <WorkspaceScrollArea className="workspace-right-matrix" fixedThumbPx={52}>
        <button
          type="button"
          className="workspace-match-rail__back"
          onClick={() => match.setMatchReportExpanded(false)}
        >
          ← Match
        </button>
        <MatchDeliveryView session={match.matchSession} locale={locale} variant="archive" />
      </WorkspaceScrollArea>
    );
  }

  return (
    <section className="workspace-right-matrix workspace-match-right-matrix" aria-label="Match">
      {match.matrixPayloadA ? (
        <div className="workspace-right-matrix__body">
          <PojuEnergyMatrix
            payload={match.matrixPayloadA}
            locale={locale}
            compact
            suppressNarrative
            hideChrome
            coverTitle={titleA}
            unread={match.matrixUnreadA}
            expanded={match.matrixExpandedA}
            onExpandedChange={match.setMatrixExpandedA}
          />
        </div>
      ) : null}

      {match.matrixPayloadB ? (
        <div className="workspace-right-matrix__body">
          <PojuEnergyMatrix
            payload={match.matrixPayloadB}
            locale={locale}
            compact
            suppressNarrative
            hideChrome
            coverTitle={titleB}
            unread={match.matrixUnreadB}
            expanded={match.matrixExpandedB}
            onExpandedChange={match.setMatrixExpandedB}
          />
        </div>
      ) : null}

      {aGenerating ? (
        <WorkspaceMatchRailBaseWait label={reportTitleA} enabled />
      ) : aReady && match.reportAText ? (
        <div className="workspace-right-matrix__report">
          <WorkspaceRailBaseReport
            displayText={match.reportAText}
            locale={locale}
            coverTitle={reportTitleA}
            expanded={false}
            unread={match.reportUnreadA}
            onExpandedChange={(open) => match.setReportAExpanded(open)}
          />
        </div>
      ) : null}

      {bGenerating ? (
        <WorkspaceMatchRailBaseWait label={reportTitleB} enabled />
      ) : bReady && match.reportBText ? (
        <div className="workspace-right-matrix__report">
          <WorkspaceRailBaseReport
            displayText={match.reportBText}
            locale={locale}
            coverTitle={reportTitleB}
            expanded={false}
            unread={match.reportUnreadB}
            onExpandedChange={(open) => match.setReportBExpanded(open)}
          />
        </div>
      ) : null}

      {matchReady ? (
        <button
          type="button"
          className="workspace-match-rail__btn is-ready"
          aria-label="Match"
          onClick={() => match.setMatchReportExpanded(true)}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <MatchPairIcon className="workspace-match-rail__glyph" />
          </span>
          <span className="workspace-match-rail__label">Match</span>
        </button>
      ) : null}
    </section>
  );
}
