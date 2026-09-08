"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

/**
 * Right-rail: collapsible energy matrix.
 * Phase-4 delivery book lives on the center shelf — rail only shows the doc icon.
 * Phase-4 regenerate + Stop live on the doc vault (and collapsed icons).
 */
export function WorkspaceRightMatrixPanel() {
  const t = useTranslations("workspace.pojuRail");
  const locale = useLocale();
  const prepare = useWorkspacePojuPrepareOptional();

  if (!prepare?.matrixPayload) {
    return <div className="workspace-right-drawer-placeholder" aria-hidden />;
  }

  const { matrixPayload, matrixExpanded, setMatrixExpanded } = prepare;

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
    </section>
  );
}
