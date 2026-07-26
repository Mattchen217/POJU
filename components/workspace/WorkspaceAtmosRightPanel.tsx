"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { useWorkspaceAtmosPrepareOptional } from "@/components/workspace/WorkspaceAtmosPrepareContext";

/** Atmos right rail — personal energy chart (same matrix as POJU). */
export function WorkspaceAtmosRightPanel() {
  const t = useTranslations("workspace.atmosRail");
  const locale = useLocale();
  const prepare = useWorkspaceAtmosPrepareOptional();

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
