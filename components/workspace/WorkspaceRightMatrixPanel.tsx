"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

/**
 * Right-rail: collapsible energy matrix.
 * Phase-4 delivery book lives on the center shelf — rail only shows the doc icon.
 * QA regenerate lives here (and on collapsed icons) so Phase-4 can be re-run from the rail.
 */
export function WorkspaceRightMatrixPanel() {
  const t = useTranslations("workspace.pojuRail");
  const tChat = useTranslations("poju.chat");
  const locale = useLocale();
  const prepare = useWorkspacePojuPrepareOptional();

  const qa = prepare?.qaDeliveryRegenerate ?? null;

  if (!prepare?.matrixPayload) {
    if (!qa) {
      return <div className="workspace-right-drawer-placeholder" aria-hidden />;
    }
    return (
      <section className="workspace-right-matrix" aria-label={t("matrixTitle")}>
        <button
          type="button"
          className="workspace-right-matrix__qa-regen"
          disabled={qa.busy}
          onClick={() => qa.run()}
        >
          {qa.busy ? tChat("delivery_regenerating") : tChat("delivery_regenerate")}
        </button>
      </section>
    );
  }

  const {
    matrixPayload,
    matrixExpanded,
    setMatrixExpanded,
  } = prepare;

  return (
    <section className="workspace-right-matrix" aria-label={t("matrixTitle")}>
      {qa ? (
        <button
          type="button"
          className="workspace-right-matrix__qa-regen"
          disabled={qa.busy}
          onClick={() => qa.run()}
        >
          {qa.busy ? tChat("delivery_regenerating") : tChat("delivery_regenerate")}
        </button>
      ) : null}

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
