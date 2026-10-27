"use client";

import { useLocale, useTranslations } from "next-intl";

import { HeroInlineBold } from "@/components/marketing/product-marketing-hero";

type Props = {
  /** Tip switches firstVisit vs returning when saved birth profiles exist. */
  hasBirthHistory?: boolean;
  /**
   * Sidebar entry: solo vs joint share this birth page but different titles
   * (other copy / motion to be swapped later).
   */
  entryMode?: "solo" | "joint";
  /** Optional tip override (e.g. joint open host uses joint_flow.birth_hint). */
  tipOverride?: string;
};

/** Left-rail: form chrome (title/tip/help) above Privacy & security.
 *  Birth list/picker stays on the right column (BirthHost) -- no chrome there.
 */
export function WorkspacePojuBirthSideCopy({
  hasBirthHistory = false,
  entryMode = "solo",
  tipOverride,
}: Props) {
  const t = useTranslations("birth_picker");
  const locale = useLocale();
  const localeKey = locale.split("-")[0] || "en";
  const sectionTitle =
    entryMode === "joint"
      ? t("form_section_title_joint")
      : t("form_section_title_solo");
  const tip =
    tipOverride?.trim() ||
    (hasBirthHistory ? t("form_prompt_returning") : t("form_prompt_firstVisit"));

  return (
    <aside
      className="workspace-poju-copy"
      data-locale={localeKey}
      data-entry-mode={entryMode}
      aria-label={t("side_privacy_title")}
    >
      <div className="workspace-poju-copy__inner">
        <div className="workspace-poju-birth-chrome">
          <h3 className="workspace-poju-birth-chrome__title">{sectionTitle}</h3>
          <p className="workspace-poju-birth-chrome__tip">{tip}</p>
          <p className="workspace-poju-birth-chrome__help">
            <HeroInlineBold text={t("form_help")} />
          </p>
        </div>

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
