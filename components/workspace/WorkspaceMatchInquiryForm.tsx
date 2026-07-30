"use client";

import { useTranslations } from "next-intl";

import { MatchPairIcon } from "@/components/workspace/workspace-engine-icons";
import { WorkspaceMatchInquiryChat } from "@/components/workspace/WorkspaceMatchInquiryChat";

const EXAMPLE_KEYS = ["business", "relationship", "specific_task"] as const;

type Props = {
  /** Distilled relationship_description after understanding confirm. */
  onClarified: (relationshipDescription: string) => void;
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

/**
 * Match inquiry shell — brand + welcome copy unchanged;
 * page scrolls hero + chat context; composer docks like Pivot.
 */
export function WorkspaceMatchInquiryForm({ onClarified, submitBusy = false }: Props) {
  const t = useTranslations("match.workspace.inquiry");

  const examplePrompts = EXAMPLE_KEYS.map((key) => ({
    key,
    text: t(`examples.${key}`),
  }));

  const header = (
    <>
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
    </>
  );

  return (
    <div className="workspace-match-inquiry">
      <WorkspaceMatchInquiryChat
        header={header}
        onClarified={onClarified}
        submitBusy={submitBusy}
        examplePrompts={examplePrompts}
        examplesLabel={t("placeholder_header")}
      />
    </div>
  );
}
