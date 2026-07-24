"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { MATCH_RELATIONSHIP_MAX_LEN, MATCH_RELATIONSHIP_MIN_LEN } from "@/components/match/RelationshipInput";
import { MatchPairIcon } from "@/components/workspace/workspace-engine-icons";

const EXAMPLE_KEYS = ["business", "relationship", "specific_task"] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitBusy?: boolean;
};

function MultilineCopy({ text, className }: { text: string; className: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <p className={className}>
      {lines.map((line, index) => (
        <span key={index} className="workspace-match-inquiry__line">
          {line}
        </span>
      ))}
    </p>
  );
}

/** Stage 2 inquiry — single-page form (not chat). */
export function WorkspaceMatchInquiryForm({
  value,
  onChange,
  onSubmit,
  submitBusy = false,
}: Props) {
  const t = useTranslations("match.workspace.inquiry");
  const tWs = useTranslations("match.workspace");
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const fieldId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim().length;
  const canSubmit = trimmed >= MATCH_RELATIONSHIP_MIN_LEN && !submitBusy;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(140, Math.max(72, el.scrollHeight))}px`;
  }, [value]);

  return (
    <div className="workspace-match-inquiry">
      <div className="workspace-match-inquiry__brand" aria-hidden>
        <span className="workspace-match-inquiry__brand-icon">
          <MatchPairIcon className="workspace-match-inquiry__brand-svg" />
        </span>
        <span className="workspace-match-inquiry__brand-word">MATCH</span>
      </div>

      <h1 className="workspace-match-inquiry__title">{t("welcome_title")}</h1>
      <MultilineCopy text={t("welcome_text")} className="workspace-match-inquiry__lead" />

      <div className="workspace-match-inquiry__spacer" aria-hidden />

      <MultilineCopy text={t("guidance_text")} className="workspace-match-inquiry__guidance" />

      <div className="workspace-match-inquiry__composer">
        <label className="sr-only" htmlFor={fieldId}>
          {t("input_placeholder")}
        </label>
        <textarea
          id={fieldId}
          ref={textareaRef}
          className="workspace-match-inquiry__textarea"
          rows={4}
          value={value}
          maxLength={MATCH_RELATIONSHIP_MAX_LEN}
          placeholder={t("input_placeholder")}
          onChange={(e) => {
            setActiveExample(null);
            onChange(e.target.value.slice(0, MATCH_RELATIONSHIP_MAX_LEN));
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="workspace-match-inquiry__composer-meta">
          <span className="workspace-match-inquiry__count">
            {value.length} / {MATCH_RELATIONSHIP_MAX_LEN}
            {trimmed < MATCH_RELATIONSHIP_MIN_LEN ? (
              <span className="workspace-match-inquiry__min">
                {" "}
                · {MATCH_RELATIONSHIP_MIN_LEN - trimmed}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="workspace-match-inquiry__submit"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {tWs("submit")}
          </button>
        </div>
      </div>

      <p className="workspace-match-inquiry__examples-label">{t("placeholder_header")}</p>
      <div className="workspace-match-inquiry__examples" role="group" aria-label={t("placeholder_header")}>
        {EXAMPLE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`workspace-match-inquiry__example${
              activeExample === key ? " is-active" : ""
            }`}
            aria-pressed={activeExample === key}
            onClick={() => {
              setActiveExample(key);
              onChange(t(`examples.${key}`).slice(0, MATCH_RELATIONSHIP_MAX_LEN));
              textareaRef.current?.focus();
            }}
          >
            {t(`examples.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
