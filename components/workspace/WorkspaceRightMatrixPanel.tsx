"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { WorkspaceRailBaseAnalysis } from "@/components/workspace/WorkspaceRailBaseAnalysis";
import { WorkspaceRailBaseReport } from "@/components/workspace/WorkspaceRailBaseReport";
import { WorkspaceRailDeliveryBook } from "@/components/workspace/WorkspaceRailDeliveryBook";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { deliveryBookHasContent } from "@/lib/poju/delivery-book-pages";

/**
 * Right-rail: collapsible energy matrix + base-analysis ritual wait / report underneath.
 * Unlock starts with matrix collapsed; expanding pushes the wait ritual down.
 * After Phase 4, the delivery book document icon appears below.
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
    reportExpanded,
    setReportExpanded,
    deliveryBookExpanded,
    setDeliveryBookExpanded,
    deliveryBookUnread,
    baseReportText,
    baseReportStatus,
    baseReportError,
    session,
  } = prepare;

  const deliveryText = session?.main_delivery?.full_text?.trim() ?? "";
  const showDeliveryBook = deliveryBookHasContent(deliveryText);

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
        <div className="workspace-right-matrix__report workspace-right-matrix__report--enter">
          <WorkspaceRailBaseReport
            displayText={baseReportText}
            locale={locale}
            expanded={reportExpanded}
            onExpandedChange={setReportExpanded}
          />
        </div>
      ) : null}

      {baseReportStatus === "error" && baseReportError ? (
        <p className="workspace-right-matrix__report-error" role="alert">
          {baseReportError}
        </p>
      ) : null}

      {showDeliveryBook ? (
        <div className="workspace-right-matrix__delivery workspace-right-matrix__report--enter">
          <WorkspaceRailDeliveryBook
            fullText={deliveryText}
            locale={locale}
            expanded={deliveryBookExpanded}
            onExpandedChange={setDeliveryBookExpanded}
            unread={deliveryBookUnread}
          />
        </div>
      ) : null}
    </section>
  );
}
