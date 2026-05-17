"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import pojuLogo from "@/assets/images/POJUlogo.png";
import type { POJUAction, POJUMessage } from "@/lib/poju/types";
import { MainDeliveryView } from "@/components/poju/MainDeliveryView";
import { parseDeliveryContent, type DeliverySection } from "@/lib/poju/parse-delivery";
import { ThinkingProcessDetails } from "@/components/poju/ThinkingProcessDetails";

export interface MessageBubbleProps {
  message: POJUMessage;
  hideWelcomePanel?: boolean;
  actions?: POJUAction[];
  onActionUpdate?: (actionId: string, status: POJUAction["status"], feedback?: string) => void;
}

export function MessageBubble({ message, hideWelcomePanel = false, actions, onActionUpdate }: MessageBubbleProps) {
  const tChat = useTranslations("poju.chat");
  const isUser = message.role === "user";
  const isWelcomePanel = isAssistantWelcomeMessage(message);
  if (isWelcomePanel && hideWelcomePanel) return null;
  if (isWelcomePanel) {
    const paragraphs = splitWelcomeParagraphs(message.content);
    return (
      <div className="mb-8 flex justify-center">
        <div className="w-full rounded-[22px] border border-white/10 bg-gradient-to-br from-[#221f33] to-[#1d1b27] px-6 py-8 text-center shadow-[0_10px_34px_rgba(0,0,0,0.25)]">
          <div className="mx-auto mb-5 flex justify-center text-primary">
            <span className="material-symbols-outlined text-[72px] leading-none">self_improvement</span>
          </div>
          <p className="text-3xl font-semibold text-on-surface sm:text-[48px]">Welcome to POJU</p>
          <div className="mx-auto mt-4 max-w-[680px] space-y-5 text-base leading-9 text-on-surface-variant">
            {paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <p className="mt-6 text-sm text-on-surface-variant/80">Type below to begin, or tap the microphone to speak.</p>
        </div>
      </div>
    );
  }

  if (message.role === "assistant" && message.meta?.contains_delivery) {
    return (
      <div className="mb-4 flex justify-start gap-3">
        <div className="mt-4 flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-outline-variant">
          <Image src={pojuLogo} alt="" width={32} height={32} className="object-cover" />
        </div>
        <div className="min-w-0 max-w-[min(100%,42rem)] flex-1 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.07] to-zinc-950/90 p-4 shadow-lg sm:p-5">
          <MainDeliveryView
            fullText={message.content}
            actions={actions ?? []}
            onActionUpdate={onActionUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-6 flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <div className="mt-6 flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-outline-variant">
          <Image src={pojuLogo} alt="" width={32} height={32} className="object-cover" />
        </div>
      ) : null}
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "w-full items-start"}`}>
        {isUser ? (
          <p className="px-1 text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">You</p>
        ) : null}
        {!isUser && !isWelcomePanel ? (
          <ThinkingProcessDetails thinkingProcess={message.meta?.thinking_process} />
        ) : null}
        <div
          className={`rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-white/5 ${
            isUser
              ? "inline-block max-w-[42rem] rounded-tr-sm bg-surface-container-high text-on-surface"
              : "w-full rounded-tl-sm border-t-2 border-primary bg-surface-container-low text-on-surface"
          }`}
        >
          {renderPlainContent(message.content)}
        </div>
        {!isUser ? (
          <div className="ml-2 mt-1 flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">volume_up</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isAssistantWelcomeMessage(message: POJUMessage): boolean {
  if (message.role !== "assistant") return false;
  const text = message.content.toLowerCase();
  return text.includes("this is a focused space for one question") || text.includes("这里只围绕你今天带来的那一个核心问题");
}

function splitWelcomeParagraphs(content: string): string[] {
  const blocks = content
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^welcome to poju\.?$/i.test(s));
  if (blocks.length >= 3) return blocks.slice(0, 3);
  return blocks;
}

function renderPlainContent(content: string) {
  const lines = content.split("\n");
  return lines.map((line, idx) => (
    <p key={idx} className={idx === 0 ? "m-0" : "mt-2 mb-0"}>
      {line || "\u00a0"}
    </p>
  ));
}

function DeliveryHeader() {
  const t = useTranslations("poju.delivery");
  return (
    <header className="border-b border-amber-400/15 pb-4">
      <span className="inline-block rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
        {t("badge")}
      </span>
      <p className="mt-2 text-sm italic text-white/70">{t("intro")}</p>
    </header>
  );
}

function DeliveryContent({ content }: { content: string }) {
  const sections = parseDeliveryContent(content);
  return (
    <div className="mt-4 space-y-6">
      {sections.map((section, idx) => (
        <DeliverySectionBlock key={`${section.type}-${idx}`} section={section} />
      ))}
    </div>
  );
}

function DeliverySectionBlock({ section }: { section: DeliverySection }) {
  if (section.type === "opening" && section.paragraphs.length === 0) return null;
  const tone =
    section.type === "analysis"
      ? "text-amber-100"
      : section.type === "conclusion"
        ? "text-amber-50/95"
        : section.type === "actions"
          ? "text-amber-100"
          : section.type === "invitation"
            ? "text-sky-100/90"
            : "text-white/85";

  return (
    <section className="space-y-2">
      {section.title ? (
        <h3 className={`text-base font-semibold uppercase tracking-wide ${tone}`}>{section.title}</h3>
      ) : null}
      <div className="space-y-3 text-sm leading-relaxed text-white/85">
        {section.paragraphs.map((p, i) => (
          <p key={i} className="m-0 whitespace-pre-wrap">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

function ActionsBlock({
  actions,
  onActionUpdate,
}: {
  actions: POJUAction[];
  onActionUpdate?: (id: string, status: POJUAction["status"], feedback?: string) => void;
}) {
  const t = useTranslations("poju.actions");
  return (
    <div className="mt-8 border-t border-amber-400/15 pt-6">
      <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-amber-100">{t("title")}</h3>
      <div className="flex flex-col gap-4">
        {actions.map((action, idx) => (
          <ActionCard key={action.action_id} action={action} index={idx + 1} onUpdate={onActionUpdate} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  action,
  index,
  onUpdate,
}: {
  action: POJUAction;
  index: number;
  onUpdate?: (id: string, status: POJUAction["status"], feedback?: string) => void;
}) {
  const t = useTranslations("poju.action_card");
  const categoryLabels: Record<POJUAction["category"], string> = {
    traditional: t("category_traditional"),
    modern_decisive: t("category_decisive"),
    modern_reflective: t("category_reflective"),
  };
  const timingLabels: Record<POJUAction["timing"], string> = {
    immediate: t("timing_immediate"),
    this_week: t("timing_this_week"),
    this_month: t("timing_this_month"),
    ongoing: t("timing_ongoing"),
  };

  const border =
    action.category === "traditional"
      ? "border-l-amber-400"
      : action.category === "modern_decisive"
        ? "border-l-violet-400"
        : "border-l-sky-400";

  return (
    <div
      className={`rounded-lg border border-white/10 bg-white/[0.03] p-4 ${border} border-l-[3px] ${
        action.status === "completed" ? "opacity-75" : ""
      } ${action.status === "skipped" ? "opacity-60" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/25 text-xs font-semibold text-amber-100">
          {index}
        </span>
        <span className="rounded bg-white/10 px-2 py-0.5">{categoryLabels[action.category]}</span>
        <span className="ml-auto text-white/55">{timingLabels[action.timing]}</span>
      </div>
      <p className="m-0 text-sm leading-relaxed text-white/90">{action.text}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-white/55">{t("why_this_action")}</summary>
        <p className="mt-2 border-l-2 border-amber-400/25 pl-3 text-xs leading-relaxed text-white/60">{action.rationale}</p>
      </details>
      {action.status === "pending" && onUpdate ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUpdate(action.action_id, "completed")}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-amber-400/40 hover:text-amber-100"
          >
            {t("mark_completed")}
          </button>
          <button
            type="button"
            onClick={() => onUpdate(action.action_id, "modified")}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-amber-400/40 hover:text-amber-100"
          >
            {t("mark_modified")}
          </button>
          <button
            type="button"
            onClick={() => onUpdate(action.action_id, "skipped")}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-amber-400/40 hover:text-amber-100"
          >
            {t("mark_skipped")}
          </button>
        </div>
      ) : null}
      {action.status !== "pending" ? (
        <div className="mt-3 text-xs">
          {action.status === "completed" ? (
            <span className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-200">✓ {t("status_completed")}</span>
          ) : null}
          {action.status === "modified" ? (
            <span className="rounded bg-amber-500/15 px-2 py-1 text-amber-200">~ {t("status_modified")}</span>
          ) : null}
          {action.status === "skipped" ? (
            <span className="rounded bg-white/10 px-2 py-1 text-white/55">○ {t("status_skipped")}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DeliveryFooter() {
  const t = useTranslations("poju.delivery");
  return (
    <footer className="mt-6 border-t border-amber-400/15 pt-4 text-center text-xs italic text-white/55">
      {t("reminder")}
    </footer>
  );
}
