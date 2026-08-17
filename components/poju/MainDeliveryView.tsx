"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import {
  DeliveryReportV2,
  DeliveryReportV2Debug,
} from "@/components/poju/DeliveryReportV2";
import { AssistantMessageActions } from "@/components/poju/AssistantMessageActions";
import { ArchiveSavedHint } from "@/components/archive/archive-saved-hint";
import { TermMarkFirstVisitHint } from "@/components/cross-product/TermMarkFirstVisitHint";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import type { Locale } from "@/lib/glossary/term-glossary";
import { deliveryEvidenceLabelPlain } from "@/lib/llm/pro/delivery/delivery-locale";
import type { POJUAction } from "@/lib/poju/types";
import { parseDeliveryContent, type DeliverySection } from "@/lib/poju/parse-delivery";
import { cn } from "@/lib/utils/classnames";

import "@/styles/glyph-delivery.css";
import "@/styles/delivery-phase4-ritual.css";

/**
 * Default: v2 (label-split). Overrides:
 * `?delivery=legacy` | `?delivery=debug` | `?delivery=v2`
 * or `NEXT_PUBLIC_DELIVERY_RENDER`.
 */
function resolveDeliveryRenderMode(
  searchParams: ReturnType<typeof useSearchParams> | null,
): "legacy" | "v2" | "debug" {
  const q = searchParams?.get("delivery")?.trim().toLowerCase();
  if (q === "debug" || q === "v2" || q === "legacy") return q;
  const env = process.env.NEXT_PUBLIC_DELIVERY_RENDER?.trim().toLowerCase();
  if (env === "debug" || env === "v2" || env === "legacy") return env;
  return "v2";
}

type Props = {
  fullText: string;
  actions: POJUAction[];
  archiveId?: string | null;
  onActionUpdate?: (actionId: string, status: POJUAction["status"], feedback?: string) => void;
  /** Progressive stream: show spinner while later sections are still generating. */
  waitingNextPart?: boolean;
  /** Hide “open book” while stream is in progress (rail icon appears after complete). */
  hideOpenBook?: boolean;
};

function buildDeliveryExportText(fullText: string, actions: POJUAction[]): string {
  if (!actions.length) return fullText;
  const actionLines = actions
    .map((a) => [a.title?.trim(), a.text?.trim()].filter(Boolean).join("\n"))
    .filter(Boolean);
  return actionLines.length ? `${fullText}\n\n${actionLines.join("\n\n")}` : fullText;
}

function DeliverySectionHeading({ title }: { title: string }) {
  return (
    <div className="glyph-delivery-section-heading">
      <h2 className="glyph-delivery-section-title">{title}</h2>
    </div>
  );
}

export function MainDeliveryView({
  fullText,
  actions,
  archiveId,
  onActionUpdate,
  waitingNextPart = false,
  hideOpenBook = false,
}: Props) {
  const tDelivery = useTranslations("poju.delivery");
  const tBook = useTranslations("workspace.deliveryBook");
  const tActions = useTranslations("poju.actions");
  const tCard = useTranslations("poju.action_card");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const renderMode = resolveDeliveryRenderMode(searchParams);
  const sections = parseDeliveryContent(fullText);
  const prepare = useWorkspacePojuPrepareOptional();

  return (
    <div className="pchat__delivery poju-delivery-inner">
      <header className="pchat__delivery-header glyph-delivery-header">
        <p className="glyph-delivery-eyebrow">{tDelivery("badge")}</p>
        <p className="pchat__delivery-intro poju-delivery-intro">{tDelivery("intro")}</p>
        {prepare && !hideOpenBook ? (
          <button
            type="button"
            className="poju-delivery-open-book"
            onClick={() => {
              prepare.openRight();
              prepare.setDeliveryBookExpanded(true);
            }}
          >
            {tBook("icon_label")} →
          </button>
        ) : null}
      </header>

      <TermMarkFirstVisitHint />

      {renderMode === "debug" ? (
        <DeliveryReportV2Debug fullText={fullText} />
      ) : renderMode === "v2" ? (
        <DeliveryReportV2 fullText={fullText} locale={locale} />
      ) : (
        sections.map((section) => (
          <DeliverySectionView key={section.type} section={section} locale={locale} />
        ))
      )}

      {waitingNextPart ? (
        <div
          className="poju-delivery-waiting-next"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="poju-delivery-waiting-next__spin" aria-hidden />
          <span>
            {tBook("writing_next_section")}
          </span>
        </div>
      ) : null}

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
  const title = section.title?.trim() || section.type;
  const isMeta = section.type === "cover" || section.type === "toc" || section.type === "appendix";
  return (
    <section className={cn("glyph-delivery-section", `poju-delivery-section--${section.type}`)}>
      <DeliverySectionHeading title={title} />
      <div className="glyph-delivery-section__body">
        <RichReadingText
          text={section.body}
          locale={locale}
          dualLayer={!isMeta}
          density="delivery"
        />
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
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);

  return (
    <div className={cn("poju-delivery-action", border)}>
      <p className="poju-delivery-action__label">
        {index}. {action.title?.trim() || categoryLabels[action.category]}
      </p>
      <RichReadingText text={action.text} locale={locale} density="delivery" />
      {rationale ? (
        <EvidenceBlock label={evidenceLabel} locale={locale}>
          <RichReadingText text={rationale} locale={locale} density="delivery" />
        </EvidenceBlock>
      ) : null}
      {onUpdate && action.status === "pending" ? (
        <div className="pchat__delivery-action-btns">
          <button type="button" onClick={() => onUpdate(action.action_id, "completed")}>
            {tCard("mark_completed")}
          </button>
          <button
            type="button"
            className="is-secondary"
            onClick={() => onUpdate(action.action_id, "skipped")}
          >
            {tCard("mark_skipped")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
