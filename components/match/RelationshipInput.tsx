"use client";

import { useTranslations } from "next-intl";

export const MATCH_RELATIONSHIP_MIN_LEN = 10;
export const MATCH_RELATIONSHIP_MAX_LEN = 200;

type RelationshipInputProps = {
  aLabel: string;
  bLabel: string;
  relationship: string;
  onRelationshipChange: (value: string) => void;
  onContinue: () => void;
  onBack?: () => void;
};

export function RelationshipInput({
  aLabel,
  bLabel,
  relationship,
  onRelationshipChange,
  onContinue,
  onBack,
}: RelationshipInputProps) {
  const t = useTranslations("match.relationship");

  const trimmedLen = relationship.trim().length;
  const canContinue = trimmedLen >= MATCH_RELATIONSHIP_MIN_LEN;

  return (
    <div className="match-relationship-content">
      <span className="match-step-indicator">{t("step_indicator", { step: 3, total: 3 })}</span>
      <h1>{t("title")}</h1>

      <div className="match-ab-display">
        <div className="match-person-mini">
          <span className="match-person-mini-label">A</span>
          <span className="match-person-mini-name">{aLabel}</span>
        </div>
        <span className="match-ab-vs" aria-hidden>
          ×
        </span>
        <div className="match-person-mini">
          <span className="match-person-mini-label">B</span>
          <span className="match-person-mini-name">{bLabel}</span>
        </div>
      </div>

      <p className="match-relationship-hint">{t("hint")}</p>

      <textarea
        value={relationship}
        onChange={(e) =>
          onRelationshipChange(e.target.value.slice(0, MATCH_RELATIONSHIP_MAX_LEN))
        }
        placeholder={t("placeholder")}
        rows={5}
        autoFocus
        className="match-relationship-textarea"
      />

      <div className="match-relationship-char-count">
        {relationship.length} / {MATCH_RELATIONSHIP_MAX_LEN}
        {trimmedLen < MATCH_RELATIONSHIP_MIN_LEN ? (
          <span className="match-relationship-min-hint">
            {" "}
            · {t("min_chars", { min: MATCH_RELATIONSHIP_MIN_LEN })}
          </span>
        ) : null}
      </div>

      <div className="match-relationship-examples">
        <h2>{t("examples_title")}</h2>
        <ul>
          <li>&ldquo;{t("example_1")}&rdquo;</li>
          <li>&ldquo;{t("example_2")}&rdquo;</li>
          <li>&ldquo;{t("example_3")}&rdquo;</li>
          <li>&ldquo;{t("example_4")}&rdquo;</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="match-primary-btn match-relationship-submit"
      >
        {t("analyze_button")}
      </button>

      <p className="match-language-hint">{t("language_hint")}</p>

      {onBack ? (
        <button type="button" onClick={onBack} className="match-relationship-back">
          {t("back")}
        </button>
      ) : null}
    </div>
  );
}
