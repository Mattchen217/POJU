"use client";

import { memo } from "react";
import { useLocale } from "next-intl";
import type { POJUAction, POJUMessage, ToolName } from "@/lib/poju/types";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { RefundOfferAction } from "@/components/poju/RefundOfferAction";
import { AssistantMessageActions } from "@/components/poju/AssistantMessageActions";
import { MainDeliveryView } from "@/components/poju/MainDeliveryView";
import { MatrixNarrativeReply, matrixNarrativeActionsText } from "@/components/poju/MatrixNarrativeReply";
import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { ToolSuggestionCard } from "@/components/poju/ToolSuggestionCard";
import "@/styles/poju-energy-matrix.css";
import "@/styles/reading-typography.css";

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

export const MessageBubble = memo(function MessageBubble({
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
  const locale = useLocale();
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
          <RichReadingText
            text={message.meta.report_text ?? message.content}
            locale={locale}
          />
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
      <RichReadingText text={message.content} locale={locale} />
      {message.meta?.suggest_refund && sessionId ? (
        <RefundOfferAction sessionId={sessionId} variant="message" />
      ) : null}
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
}, messageBubblePropsEqual);

function messageBubblePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.message.timestamp === next.message.timestamp &&
    prev.message.role === next.message.role &&
    prev.message.content === next.message.content &&
    prev.message.is_rejected === next.message.is_rejected &&
    prev.hideWelcomePanel === next.hideWelcomePanel &&
    prev.editDisabled === next.editDisabled &&
    prev.editLabel === next.editLabel &&
    prev.sessionId === next.sessionId &&
    prev.cycleId === next.cycleId &&
    prev.toolSuggestionResponse === next.toolSuggestionResponse &&
    prev.actionPlanArchiveId === next.actionPlanArchiveId &&
    prev.actions === next.actions &&
    prev.message.meta?.contains_delivery === next.message.meta?.contains_delivery &&
    prev.message.meta?.suggest_refund === next.message.meta?.suggest_refund &&
    prev.message.meta?.kind === next.message.meta?.kind &&
    prev.message.meta?.tool_suggestion === next.message.meta?.tool_suggestion
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
