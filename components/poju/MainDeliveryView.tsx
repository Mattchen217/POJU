"use client";

/**
 * Step 16 ??structured main delivery (????sections + action cards).
 * Used by `MessageBubble` for `contains_delivery` messages.
 */

import { useTranslations } from "next-intl";
import { ArchiveSavedHint } from "@/components/archive/archive-saved-hint";
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
  const sections = parseDeliveryContent(fullText);

  return (
    <div className="space-y-6">
      <header className="border-b border-amber-400/15 pb-4">
        <span className="inline-block rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
          {tDelivery("badge")}
        </span>
        <p className="mt-2 poju-chat-delivery-prose italic text-white/70">{tDelivery("intro")}</p>
      </header>

      {sections.map((section, idx) => (
        <DeliverySectionView key={`${section.type}-${idx}`} section={section} />
      ))}

      {actions.length > 0 ? (
        <div className="border-t border-amber-400/15 pt-6">
          <h3 className="poju-chat-delivery-heading mb-3 text-base font-semibold uppercase tracking-wide text-amber-100 md:text-lg">{tActions("title")}</h3>
          <div className="flex flex-col gap-4">
            {actions.map((action, idx) => (
              <ActionRow key={action.action_id} action={action} index={idx + 1} tCard={tCard} onUpdate={onActionUpdate} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="poju-chat-delivery-prose italic text-white/60">{tDelivery("reminder")}</p>

      {archiveId ? <ArchiveSavedHint archiveId={archiveId} /> : null}
    </div>
  );
}

function DeliverySectionView({ section }: { section: DeliverySection }) {
  if (section.type === "opening" && section.paragraphs.length === 0) return null;
  const tone =
    section.type === "analysis"
      ? "text-amber-100"
      : section.type === "conclusion"
        ? "text-amber-50/95"
        : "text-white/85";

  return (
    <section className="space-y-2">
      {section.title ?           <h3 className={`poju-chat-delivery-heading text-base font-semibold uppercase tracking-wide md:text-lg ${tone}`}>{section.title}</h3> : null}
      <div className="space-y-4 poju-chat-delivery-prose text-white/85">
        {section.paragraphs.map((p, i) => (
          <p key={i} className="m-0 whitespace-pre-wrap">
            {p}
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
}: {
  action: POJUAction;
  index: number;
  tCard: (key: string) => string;
  onUpdate?: (id: string, status: POJUAction["status"], feedback?: string) => void;
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
    <div className={`rounded-xl border border-white/10 bg-black/25 p-4 border-l-4 ${border}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
        {index}. {categoryLabels[action.category]}
      </p>
      <p className="mt-2 poju-chat-delivery-prose text-on-surface">{action.text}</p>
      {onUpdate && action.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-primary/80 px-3 py-1 text-xs"
            onClick={() => onUpdate(action.action_id, "completed")}
          >
            {tCard("mark_completed")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/20 px-3 py-1 text-xs"
            onClick={() => onUpdate(action.action_id, "skipped")}
          >
            {tCard("mark_skipped")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
