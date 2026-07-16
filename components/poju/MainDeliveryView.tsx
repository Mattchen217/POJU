"use client";

import { useLocale, useTranslations } from "next-intl";

import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { AssistantMessageActions } from "@/components/poju/AssistantMessageActions";
import { ArchiveSavedHint } from "@/components/archive/archive-saved-hint";
import { TermMarkFirstVisitHint } from "@/components/cross-product/TermMarkFirstVisitHint";
import type { Locale } from "@/lib/glossary/term-glossary";
import type { POJUAction } from "@/lib/poju/types";
import { parseDeliveryContent, type DeliverySection } from "@/lib/poju/parse-delivery";
import { cn } from "@/lib/utils/classnames";

import "@/styles/glyph-delivery.css";

type Props = {
  fullText: string;
  actions: POJUAction[];
  archiveId?: string | null;
  onActionUpdate?: (actionId: string, status: POJUAction["status"], feedback?: string) => void;
};

function buildDeliveryExportText(fullText: string, actions: POJUAction[]): string {
  if (!actions.length) return fullText;
  const actionLines = actions
    .map((a) => [a.title?.trim(), a.text?.trim()].filter(Boolean).join("\n"))
    .filter(Boolean);
  return actionLines.length ? `${fullText}\n\n${actionLines.join("\n\n")}` : fullText;
}

function DeliverySectionHeading({
  title,
  variant = "default",
}: {
  title: string;
  variant?: "default" | "moment";
}) {
  return (
    <div
      className={cn(
        "glyph-delivery-section-heading",
        variant === "moment" && "glyph-delivery-section-heading--moment",
      )}
    >
      <h2 className="glyph-delivery-section-title">{title}</h2>
    </div>
  );
}

export function MainDeliveryView({ fullText, actions, archiveId, onActionUpdate }: Props) {
  const tDelivery = useTranslations("poju.delivery");
  const tActions = useTranslations("poju.actions");
  const tCard = useTranslations("poju.action_card");
  const locale = useLocale() as Locale;
  const sections = parseDeliveryContent(fullText);

  return (
    <div className="pchat__delivery poju-delivery-inner">
      <header className="pchat__delivery-header glyph-delivery-header">
        <p className="glyph-delivery-eyebrow">{tDelivery("badge")}</p>
        <p className="pchat__delivery-intro poju-delivery-intro">{tDelivery("intro")}</p>
      </header>

      <TermMarkFirstVisitHint />

      {sections.map((section, idx) => (
        <DeliverySectionView key={`${section.type}-${idx}`} section={section} locale={locale} />
      ))}

      {actions.length > 0 ? (
        <section className="glyph-delivery-section poju-delivery-actions">
          <DeliverySectionHeading title={tActions("title")} />
          <div className="glyph-delivery-section__body poju-delivery-actions__list">
            {actions.map((action, idx) => (
              <ActionRow
                key={action.action_id}
                action={action}
                index={idx + 1}
                tCard={tCard}
                onUpdate={onActionUpdate}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="pchat__delivery-intro poju-delivery-reminder">{tDelivery("reminder")}</p>

      <AssistantMessageActions
        content={buildDeliveryExportText(fullText, actions)}
        locale={locale}
      />

      {archiveId ? <ArchiveSavedHint archiveId={archiveId} /> : null}
    </div>
  );
}

function DeliverySectionView({
  section,
  locale,
}: {
  section: DeliverySection;
  locale: Locale;
}) {
  if (section.type === "opening" && section.paragraphs.length === 0) return null;

  const body = (
    <RichReadingText
      text={section.paragraphs.join("\n\n")}
      locale={locale}
      density="delivery"
    />
  );

  if (section.type === "opening") {
    return <section className="glyph-delivery-intro poju-delivery-opening">{body}</section>;
  }

  if (section.type === "conclusion" && section.title) {
    return (
      <section className="glyph-delivery-section poju-delivery-section--conclusion">
        <div className="poju-delivery-highlight">
          <DeliverySectionHeading title={section.title} />
          <div className="glyph-delivery-section__body">{body}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "glyph-delivery-section",
        section.type === "invitation" && "poju-delivery-section--invitation",
        section.type === "actions" && "poju-delivery-section--actions",
      )}
    >
      {section.title ? (
        <DeliverySectionHeading
          title={section.title}
          variant={section.type === "invitation" ? "moment" : "default"}
        />
      ) : null}
      <div className="glyph-delivery-section__body">{body}</div>
    </section>
  );
}

function ActionRow({
  action,
  index,
  tCard,
  onUpdate,
  locale,
}: {
  action: POJUAction;
  index: number;
  tCard: (key: string) => string;
  onUpdate?: (id: string, status: POJUAction["status"], feedback?: string) => void;
  locale: Locale;
}) {
  const categoryLabels: Record<POJUAction["category"], string> = {
    traditional: tCard("category_traditional"),
    modern_decisive: tCard("category_decisive"),
    modern_reflective: tCard("category_reflective"),
  };
  const border =
    action.category === "traditional"
      ? "poju-delivery-action--traditional"
      : action.category === "modern_decisive"
        ? "poju-delivery-action--decisive"
        : "poju-delivery-action--reflective";

  const rationale = action.rationale?.trim() ?? "";
  const evidenceLabel = locale.startsWith("zh") ? "依据与推理" : "Evidence & reasoning";

  return (
    <div className={cn("poju-delivery-action", border)}>
      <p className="poju-delivery-action__label">
        {index}. {action.title?.trim() || categoryLabels[action.category]}
      </p>
      <RichReadingText text={action.text} locale={locale} density="delivery" />
      {rationale ? (
        <EvidenceBlock label={evidenceLabel}>
          <RichReadingText text={rationale} locale={locale} density="delivery" />
        </EvidenceBlock>
      ) : null}
      {onUpdate && action.status === "pending" ? (
        <div className="pchat__delivery-action-btns">
          <button type="button" onClick={() => onUpdate(action.action_id, "completed")}>
            {tCard("mark_completed")}
          </button>
          <button type="button" className="is-secondary" onClick={() => onUpdate(action.action_id, "skipped")}>
            {tCard("mark_skipped")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
