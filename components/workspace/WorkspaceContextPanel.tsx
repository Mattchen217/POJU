"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import type { ArchiveSummary } from "@/lib/archive/archive-service";
import type { WorkspaceProductId } from "@/components/workspace/use-workspace-product-history";

type Props = {
  productId: WorkspaceProductId;
  recent: ArchiveSummary[];
  onOpenArchive: (archiveId: string) => void;
  className?: string;
};

export function WorkspaceContextPanel({
  productId,
  recent,
  onOpenArchive,
  className,
}: Props) {
  const t = useTranslations("workspace.density");
  const tMethod = useTranslations(`workspace.density.methodology.${productId}`);
  const top = recent.slice(0, 3);

  return (
    <aside
      className={["workspace-context", className].filter(Boolean).join(" ")}
      aria-label={t("contextLabel")}
    >
      <div className="workspace-glass-panel workspace-context__card">
        <p className="workspace-context__eyebrow">{t("statusEyebrow")}</p>
        <h3 className="workspace-context__title">{t("statusTitle")}</h3>
        <ul className="workspace-context__meta">
          <li>
            <span>{t("activeProfile")}</span>
            <strong>{t("slotAShort")}</strong>
          </li>
          <li>
            <span>{t("solarTerm")}</span>
            <strong>{t("solarTermValue")}</strong>
          </li>
          <li>
            <span>{t("matrix")}</span>
            <strong>{t("matrixValue")}</strong>
          </li>
        </ul>
      </div>

      <div className="workspace-glass-panel workspace-context__card">
        <p className="workspace-context__eyebrow">{t("methodEyebrow")}</p>
        <h3 className="workspace-context__title">{tMethod("title")}</h3>
        <p className="workspace-context__body">{tMethod("body")}</p>
      </div>

      <div className="workspace-glass-panel workspace-context__card">
        <p className="workspace-context__eyebrow">{t("historyEyebrow")}</p>
        <h3 className="workspace-context__title">{t("historyTitle")}</h3>
        {top.length === 0 ? (
          <p className="workspace-context__empty">{t("historyEmpty")}</p>
        ) : (
          <ul className="workspace-context__history">
            {top.map((row) => (
              <li key={row.archive_id}>
                <button
                  type="button"
                  className="workspace-context__history-item"
                  onClick={() => onOpenArchive(row.archive_id)}
                >
                  <span className="workspace-context__history-title">{row.title || t("untitled")}</span>
                  <span className="workspace-context__history-cta">{t("viewReport")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link href="/archive" className="workspace-context__vault-link">
          {t("openFullVault")}
        </Link>
      </div>

      <div className="workspace-privacy-badge" role="status">
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          lock
        </span>
        {t("privacyBadge")}
      </div>
    </aside>
  );
}
