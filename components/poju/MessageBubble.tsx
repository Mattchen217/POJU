"use client";

import { useTranslations } from "next-intl";
import type { POJUAction, POJUMessage, ToolName } from "@/lib/poju/types";
import { AssistantMessageActions } from "@/components/poju/AssistantMessageActions";
import { MainDeliveryView } from "@/components/poju/MainDeliveryView";
import { MatrixNarrativeReply, matrixNarrativeActionsText } from "@/components/poju/MatrixNarrativeReply";
import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { ToolSuggestionCard } from "@/components/poju/ToolSuggestionCard";
import "@/styles/poju-energy-matrix.css";
import { parseDeliveryContent, type DeliverySection } from "@/lib/poju/parse-delivery";

export interface MessageBubbleProps {
  message: POJUMessage;
  hideWelcomePanel?: boolean;
  actions?: POJUAction[];
  actionPlanArchiveId?: string | null;
  onActionUpdate?: (actionId: string, status: POJUAction["status"], feedback?: string) => void;
  onEdit?: () => void;
  editDisabled?: boolean;
  editLabel?: string;
  sessionId?: string;
  cycleId?: string;
  toolSuggestionResponse?: "accepted" | "declined" | null;
  onToolResponse?: (tool: ToolName, action: "accepted" | "declined") => void;
}

export function MessageBubble({
  message,
  hideWelcomePanel = false,
  actions,
  actionPlanArchiveId,
  onActionUpdate,
  onEdit,
  editDisabled = false,
  editLabel,
  sessionId,
  cycleId,
  toolSuggestionResponse = null,
  onToolResponse,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isWelcomePanel = isAssistantWelcomeMessage(message);
  if (isWelcomePanel && hideWelcomePanel) return null;
  if (message.role === "assistant" && message.meta?.kind === "energy_matrix" && message.meta.matrix_payload) {
    const narrativeText = matrixNarrativeActionsText(message.meta.matrix_payload, "en");
    return (
      <>
        <div className="pchat__msg pchat__msg--ai">
          <PojuEnergyMatrix payload={message.meta.matrix_payload} locale="en" compact />
        </div>
        <div className="pchat__msg pchat__msg--ai">
          <div className="pchat__ai-row">
            <PojuAiAvatar />
            <div className="pchat__ai">
              <MatrixNarrativeReply payload={message.meta.matrix_payload} locale="en" />
              {narrativeText ? <AssistantMessageActions content={narrativeText} /> : null}
            </div>
          </div>
        </div>
      </>
    );
  }
  if (message.role === "assistant" && message.meta?.kind === "paywall") {
    return null;
  }
  if (message.role === "assistant" && message.meta?.kind === "report") {
    return (
      <div className="pchat__msg pchat__msg--ai">
        <div className="pchat__report">
          <div className="pchat__report-k">Base Analysis Report</div>
          {message.meta.report_text ?? message.content}
        </div>
      </div>
    );
  }
  if (isWelcomePanel) {
    const paragraphs = splitWelcomeParagraphs(message.content);
    return (
      <div className="pchat__msg pchat__msg--ai">
        <div className="pchat__panel">
          <p className="pchat__welcome-title">Welcome to POJU</p>
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p>Type below to begin, or tap the microphone to speak.</p>
        </div>
      </div>
    );
  }

  if (message.role === "assistant" && message.meta?.contains_delivery) {
    return (
      <div className="pchat__msg pchat__msg--ai">
        <MainDeliveryView
          fullText={message.content}
          actions={actions ?? []}
          archiveId={actionPlanArchiveId}
          onActionUpdate={onActionUpdate}
        />
        <AssistantMessageActions content={message.content} />
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="pchat__msg pchat__msg--user">
        <div className="pchat__bubble">{renderPlainContent(message.content)}</div>
        {onEdit && !message.is_rejected ? (
          <button type="button" onClick={onEdit} disabled={editDisabled} className="pchat__msg-edit">
            {editLabel ?? "Edit"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pchat__msg pchat__msg--ai">
      {renderPlainContent(message.content)}
      {message.meta?.tool_suggestion && sessionId && cycleId && onToolResponse ? (
        <ToolSuggestionCard
          suggestion={message.meta.tool_suggestion}
          sessionId={sessionId}
          cycleId={cycleId}
          suggestionMessageId={message.meta.tool_suggestion_message_id ?? message.timestamp}
          initialResponse={toolSuggestionResponse}
          onResponse={(action) => onToolResponse(message.meta!.tool_suggestion!.tool, action)}
        />
      ) : null}
      <AssistantMessageActions content={message.content} />
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
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  return lines.map((line, idx) => <p key={idx}>{line || "\u00a0"}</p>);
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
