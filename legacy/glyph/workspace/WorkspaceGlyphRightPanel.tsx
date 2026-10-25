"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { useWorkspaceGlyphPrepareOptional } from "@/components/workspace/WorkspaceGlyphPrepareContext";

/** Right-rail personal energy matrix for Glyph workspace flow. */
export function WorkspaceGlyphRightPanel() {
  const t = useTranslations("workspace.pojuRail");
  const locale = useLocale();
  const prepare = useWorkspaceGlyphPrepareOptional();

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
