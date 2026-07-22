"use client";

import { useLocale, useTranslations } from "next-intl";

type Props = {
  /** Returning users with saved profiles — swap the first-paragraph copy. */
  hasProfiles?: boolean;
};

/** Left-rail guide copy beside the workspace birth form / profile list. */
export function WorkspacePojuBirthSideCopy({ hasProfiles = false }: Props) {
  const t = useTranslations("birth_picker");
  const locale = useLocale();
  const localeKey = locale.split("-")[0] || "en";

  return (
    <aside
      className="workspace-poju-copy"
      data-locale={localeKey}
      aria-label={t("side_title")}
    >
      <div className="workspace-poju-copy__inner">
        <section className="workspace-poju-copy__block">
          <h2 className="workspace-poju-copy__title">{t("side_title")}</h2>
          <p className="workspace-poju-copy__body">
            {hasProfiles ? t("side_body_returning") : t("side_body")}
          </p>
        </section>

        <section className="workspace-poju-copy__block workspace-poju-copy__block--privacy">
          <h3 className="workspace-poju-copy__title workspace-poju-copy__title--privacy">
            <span className="workspace-poju-copy__lock" aria-hidden="true">
              🔒
            </span>
            {t("side_privacy_title")}
          </h3>
          <p className="workspace-poju-copy__body">{t("side_privacy_intro")}</p>
          <ul className="workspace-poju-copy__points">
            <li>
              <strong>{t("side_local_title")}</strong>
              <span>{t("side_local_body")}</span>
            </li>
            <li>
              <strong>{t("side_wipe_title")}</strong>
              <span>{t("side_wipe_body")}</span>
            </li>
            <li>
              <strong>{t("side_isolation_title")}</strong>
              <span>{t("side_isolation_body")}</span>
            </li>
          </ul>
        </section>
      </div>
    </aside>
  );
}
