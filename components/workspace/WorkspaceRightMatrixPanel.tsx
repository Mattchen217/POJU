"use client";

import { useLocale, useTranslations } from "next-intl";

import { BaseAnalysisDeliveryView } from "@/components/base-analysis/BaseAnalysisDeliveryView";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { WorkspaceRailBaseAnalysis } from "@/components/workspace/WorkspaceRailBaseAnalysis";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

/**
 * Right-rail: energy matrix (collapsible) + base-analysis wait/report underneath.
 */
export function WorkspaceRightMatrixPanel() {
  const t = useTranslations("workspace.pojuRail");
  const locale = useLocale();
  const prepare = useWorkspacePojuPrepareOptional();

  if (!prepare?.matrixPayload) {
    return <div className="workspace-right-drawer-placeholder" aria-hidden />;
  }

  const {
    matrixPayload,
    matrixExpanded,
    setMatrixExpanded,
    baseReportText,
    baseReportStatus,
    baseReportError,
  } = prepare;

  return (
    <section className="workspace-right-matrix" aria-label={t("matrixTitle")}>
      <div className="workspace-right-matrix__body">
        <PojuEnergyMatrix
          payload={matrixPayload}
          locale={locale}
          compact
          suppressNarrative
          hideChrome
          expanded={matrixExpanded}
          onExpandedChange={setMatrixExpanded}
        />
      </div>

      {baseReportStatus === "generating" ? <WorkspaceRailBaseAnalysis /> : null}

      {baseReportStatus === "ready" && baseReportText ? (
        <div className="workspace-right-matrix__report">
          <BaseAnalysisDeliveryView
            displayText={baseReportText}
            structured={matrixPayload.structured}
            userProfile={matrixPayload.user_profile}
            locale={locale}
            profileId={matrixPayload.profile_id}
            variant="modal"
            showPageHeader={false}
          />
        </div>
      ) : null}

      {baseReportStatus === "error" && baseReportError ? (
        <p className="workspace-right-matrix__report-error" role="alert">
          {baseReportError}
        </p>
      ) : null}
    </section>
  );
}
