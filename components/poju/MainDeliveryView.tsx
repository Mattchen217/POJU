"use client";

/**
 * Step 16 ??structured main delivery (????sections + action cards).
 * Used by `MessageBubble` for `contains_delivery` messages.
 */

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { GlossaryText } from "@/components/cross-product/GlossaryText";
import { ArchiveSavedHint } from "@/components/archive/archive-saved-hint";
import type { Locale } from "@/lib/glossary/term-glossary";
import type { POJUAction } from "@/lib/poju/types";
import { parseDeliveryContent, type DeliverySection } from "@/lib/poju/parse-delivery";

type Props = {
  fullText: string;
  actions: POJUAction[];
  archiveId?: string | null;
  onActionUpdate?: (actionId: string, status: POJUAction["status"], feedback?: string) => void;
};

export function MainDeliveryView({ fullText, actions, archiveId, onActionUpdate }: Props) {
  const tDelivery = useTranslations("poju.delivery");
  const tActions = useTranslations("poju.actions");
  const tCard = useTranslations("poju.action_card");
  const locale = useLocale() as Locale;
  const seen = useRef(new Set<string>()).current;
  const sections = parseDeliveryContent(fullText);

  return (
    <div className="pchat__delivery">
      <header className="pchat__delivery-header">
        <span className="pchat__delivery-badge">{tDelivery("badge")}</span>
        <p className="pchat__delivery-intro">{tDelivery("intro")}</p>
      </header>

      {sections.map((section, idx) => (
        <DeliverySectionView
          key={`${section.type}-${idx}`}
          section={section}
          locale={locale}
          seen={seen}
        />
      ))}

      {actions.length > 0 ? (
        <div className="pchat__delivery-actions">
          <h3 className="pchat__delivery-section-title">{tActions("title")}</h3>
          <div className="flex flex-col gap-4">
            {actions.map((action, idx) => (
              <ActionRow
                key={action.action_id}
                action={action}
                index={idx + 1}
                tCard={tCard}
                onUpdate={onActionUpdate}
                locale={locale}
                seen={seen}
              />
            ))}
          </div>
        </div>
      ) : null}

      <p className="pchat__delivery-intro">{tDelivery("reminder")}</p>

      {archiveId ? <ArchiveSavedHint archiveId={archiveId} /> : null}
    </div>
  );
}

function DeliverySectionView({
  section,
  locale,
  seen,
}: {
  section: DeliverySection;
  locale: Locale;
  seen: Set<string>;
}) {
  if (section.type === "opening" && section.paragraphs.length === 0) return null;

  return (
    <section>
      {section.title ? <h3 className="pchat__delivery-section-title">{section.title}</h3> : null}
      <div>
        {section.paragraphs.map((p, i) => (
          <p key={i}>
            <GlossaryText text={p} locale={locale} seen={seen} />
          </p>
        ))}
      </div>
    </section>
  );
}

function ActionRow({
  action,
  index,
  tCard,
  onUpdate,
  locale,
  seen,
}: {
  action: POJUAction;
  index: number;
  tCard: (key: string) => string;
  onUpdate?: (id: string, status: POJUAction["status"], feedback?: string) => void;
  locale: Locale;
  seen: Set<string>;
}) {
  const categoryLabels: Record<POJUAction["category"], string> = {
    traditional: tCard("category_traditional"),
    modern_decisive: tCard("category_decisive"),
    modern_reflective: tCard("category_reflective"),
  };
  const border =
    action.category === "traditional"
      ? "border-l-amber-400"
      : action.category === "modern_decisive"
        ? "border-l-violet-400"
        : "border-l-sky-400";

  return (
    <div className="pchat__delivery-action">
      <p className="pchat__delivery-action-label">
        {index}. {action.title?.trim() || categoryLabels[action.category]}
      </p>
      <p>
        <GlossaryText text={action.text} locale={locale} seen={seen} />
      </p>
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
