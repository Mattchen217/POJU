"use client";

/* ============================================================
   PojuChat.tsx  —  POJU 聊天页组件(Claude 规格,PC + PWA)
   ------------------------------------------------------------
   UI / 布局 / 尺寸全部由本组件 + poju-chat.css 控制,
   数据通过 props 接入(Cursor 把现有 store / api 接到这些 props)。
   图标用 emoji 占位,可替换成 lucide-react 等现有图标库。
   ============================================================ */

import { useState, useRef, useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import Image from "next/image";
import pojuLogo from "@/assets/images/POJUlogo.png";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { AssistantMessageActions } from "@/components/poju/AssistantMessageActions";
import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";
import { PojuActivityIndicator } from "@/components/poju/PojuActivityIndicator";
import { EditMessageDialog } from "@/components/poju/EditMessageDialog";
import {
  SessionSidebarDialog,
  type SessionSidebarDialogState,
} from "@/components/poju/SessionSidebarDialog";
import { QuestionBriefingDialog } from "@/components/poju/QuestionBriefingDialog";
import "./poju-chat.css";
import "@/styles/reading-typography.css";

export type PojuAttachKind = "image" | "document" | "pdf";

/* ---------- 数据类型(若项目已有同义类型,用现有的)---------- */
export interface PojuMessage {
  id: string;
  role: "user" | "assistant";
  content: string; // assistant 内容可能含 "### 标题" 和 "═══ 分隔 ═══"
  editable?: boolean;
}
export interface PojuSession {
  id: string;
  title: string;
  updatedAt?: string;
  /** Secondary line under title in sidebar (e.g. ACTIVE NOW / 2h ago) */
  meta?: string;
}

/* ---------- Props:数据接入点 ----------
   Cursor 需要做的全部事情:把现有的会话/消息数据与发送/流式
   逻辑接到下面这些 props 上。UI 不用动。 */
export interface PojuChatProps {
  sessions: PojuSession[];
  currentSessionId: string | null;
  messages: PojuMessage[];
  isStreaming?: boolean;
  /** Rotating status lines while call-1 is in flight (Spline + caption). */
  pendingActivityLines?: string[] | null;
  /** Fade out pending activity instead of hard unmount. */
  pendingActivityFading?: boolean;
  /** Live model reasoning under activity caption (RTL ticker). */
  thinkingLiveLine?: string | null;
  thinkingLocale?: string;
  onSend: (text: string) => void;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void | Promise<void>;
  onDeleteSession?: (sessionId: string) => void | Promise<void>;
  renameLabel?: string;
  deleteLabel?: string;
  sessionMenuLabel?: string;
  sessionDialogLabels?: {
    renameTitle: string;
    renameMessage: string;
    deleteTitle: string;
    deleteMessage: string;
    cancel: string;
    ok: string;
  };
  inputPlaceholder?: string;
  onAttachPick?: (kind: PojuAttachKind) => void;
  attachMenuLabels?: {
    document: string;
    image: string;
    pdf: string;
  };
  attachMenuLabel?: string;
  onVoice?: () => void;
  voiceActive?: boolean;
  voiceStartLabel?: string;
  voiceStopLabel?: string;
  onStop?: () => void;
  onEditMessage?: (messageId: string, currentContent: string) => void;
  editDisabled?: boolean;
  editLabel?: string;
  onClose?: () => void;
  inlineNotice?: ReactNode;
  editDialog?: {
    title: string;
    description: string;
    defaultValue: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  } | null;
  newSessionDisabled?: boolean;
  composerText?: string;
  onComposerTextChange?: (value: string) => void;
  composerHasAttachment?: boolean;
  composerDisabled?: boolean;
  brandName?: string;
  brandTooltip?: string;
  sessionsLabel?: string;
  newSessionLabel?: string;
  /** Rich assistant slots keyed by message id (energy matrix, paywall, report). */
  messageSlots?: Record<string, ReactNode>;
  /** Slot ids rendered without avatar shell (full-width embeds). */
  bareMessageSlotIds?: ReadonlySet<string>;
  /** Extra AI reply blocks immediately after a parent message id. */
  messageFollowUps?: Record<string, ReactNode>;
  /** Plain text for copy/actions on follow-up blocks. */
  messageFollowUpActionsText?: Record<string, string>;
  /** Paywall / unlock sheet rendered above the composer (not in message list). */
  paywallOverlay?: ReactNode;
  /** First session open: "top" (matrix header); return visits: "bottom". */
  initialScrollPosition?: "top" | "bottom";
  /** Fired once the pending-reply UI (slots + text) has painted — parent may dismiss activity. */
  onActivityRenderReady?: () => void;
  /** Preview phase: first composer focus shows question briefing before typing. */
  questionBriefingEnabled?: boolean;
  questionBriefingDismissed?: boolean;
  onQuestionBriefingDismiss?: () => void;
}

/* ---------- AI 文本：定稿后走 RichReadingText（金字 + 轻排版） ---------- */
function renderAiContent(text: string, locale: string, reveal?: boolean): ReactNode {
  return (
    <RichReadingText
      text={text}
      locale={locale}
      className={`pchat__reading-body${reveal ? " pchat__reading-reveal" : ""}`}
    />
  );
}

function AiReplyShell({ children }: { children: ReactNode }) {
  return (
    <div className="pchat__ai-row">
      <PojuAiAvatar />
      <div className="pchat__ai">{children}</div>
    </div>
  );
}

export default function PojuChat(props: PojuChatProps) {
  const {
    sessions, currentSessionId, messages,
    isStreaming, pendingActivityLines, pendingActivityFading, thinkingLiveLine, thinkingLocale,
    onSend,
    onNewSession,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    renameLabel,
    deleteLabel,
    sessionMenuLabel,
    sessionDialogLabels,
    inputPlaceholder,
    onAttachPick,
    attachMenuLabels,
    attachMenuLabel,
    onVoice,
    voiceActive,
    voiceStartLabel,
    voiceStopLabel,
    onStop,
    onEditMessage,
    editDisabled,
    editLabel,
    onClose,
    inlineNotice,
    editDialog,
    newSessionDisabled,
    composerText,
    onComposerTextChange,
    composerHasAttachment,
    composerDisabled,
    brandName = "POJU",
    brandTooltip,
    sessionsLabel = "Recent Sessions",
    newSessionLabel = "+ New POJU",
    messageSlots,
    bareMessageSlotIds,
    messageFollowUps,
    messageFollowUpActionsText,
    paywallOverlay,
    initialScrollPosition = "bottom",
    onActivityRenderReady,
    questionBriefingEnabled = false,
    questionBriefingDismissed = false,
    onQuestionBriefingDismiss,
  } = props;

  const [input, setInput] = useState("");
  const [questionBriefingOpen, setQuestionBriefingOpen] = useState(false);
  const textareaValue = composerText ?? input;
  const setTextareaValue = onComposerTextChange ?? setInput;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [sessionDialog, setSessionDialog] = useState<SessionSidebarDialogState | null>(null);
  const activityRenderReadyRef = useRef<string | null>(null);
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingInitialScrollRef = useRef<"top" | "bottom" | null>(initialScrollPosition);
  const suppressTailScrollRef = useRef(initialScrollPosition === "top");

  useEffect(() => {
    pendingInitialScrollRef.current = initialScrollPosition;
    suppressTailScrollRef.current = initialScrollPosition === "top";
  }, [currentSessionId, initialScrollPosition]);

  useEffect(() => {
    setQuestionBriefingOpen(false);
  }, [currentSessionId]);

  /* Lock document scroll — only .pchat__scroll may scroll (iOS Safari rubber-band). */
  useEffect(() => {
    document.documentElement.classList.add("pchat-page-lock");
    document.body.classList.add("pchat-page-lock");
    return () => {
      document.documentElement.classList.remove("pchat-page-lock");
      document.body.classList.remove("pchat-page-lock");
    };
  }, []);

  /* 输入框自适应高度 */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [textareaValue]);

  function shouldGateQuestionBriefing(): boolean {
    return (
      questionBriefingEnabled && !questionBriefingDismissed && !composerDisabled
    );
  }

  function handleComposerPointerDown(e: React.PointerEvent<HTMLTextAreaElement>) {
    if (!shouldGateQuestionBriefing()) return;
    e.preventDefault();
    setQuestionBriefingOpen(true);
  }

  function handleComposerFocus(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (!shouldGateQuestionBriefing()) return;
    if (questionBriefingOpen) return;
    e.target.blur();
    setQuestionBriefingOpen(true);
  }

  function handleQuestionBriefingConfirm() {
    onQuestionBriefingDismiss?.();
    setQuestionBriefingOpen(false);
    requestAnimationFrame(() => {
      taRef.current?.focus();
    });
  }

  /* 新消息 / 流式时自动滚到底；首次进入会话按 initialScrollPosition 定位 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingInitialScrollRef.current !== null) {
      const pos = pendingInitialScrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTo({ top: pos === "top" ? 0 : el.scrollHeight, behavior: "auto" });
        pendingInitialScrollRef.current = null;
      });
      return;
    }

    if (!suppressTailScrollRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    }
  }, [
    messages,
    pendingActivityLines,
    inlineNotice,
    messageFollowUps,
    currentSessionId,
  ]);

  const pendingReplyId = useMemo(() => {
    if (!pendingActivityLines?.length && !pendingActivityFading) return null;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return null;
    return last.id;
  }, [pendingActivityLines, pendingActivityFading, messages]);

  const activityOverlayVisible = Boolean(
    pendingReplyId && pendingActivityLines?.length && !pendingActivityFading,
  );
  const revealPendingContent = Boolean(
    pendingReplyId && (pendingActivityFading || !pendingActivityLines?.length),
  );
  const pendingOnlyLegacy = Boolean(pendingActivityLines?.length) && !pendingReplyId;
  const activitySlotVisible = Boolean(
    !pendingReplyId && (pendingActivityLines?.length || pendingActivityFading),
  );

  useLayoutEffect(() => {
    if (!pendingReplyId || !pendingActivityLines?.length || pendingActivityFading) return;
    if (activityRenderReadyRef.current === pendingReplyId) return;

    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || activityRenderReadyRef.current === pendingReplyId) return;
        activityRenderReadyRef.current = pendingReplyId;
        onActivityRenderReady?.();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    pendingReplyId,
    pendingActivityLines,
    pendingActivityFading,
    messages,
    messageSlots,
    messageFollowUps,
    onActivityRenderReady,
  ]);

  useEffect(() => {
    activityRenderReadyRef.current = null;
  }, [pendingActivityLines]);

  function renderAssistantBody(m: PojuMessage, reveal?: boolean) {
    if (bareMessageSlotIds?.has(m.id) && messageSlots?.[m.id]) {
      return messageSlots[m.id];
    }
    return (
      <>
        {messageSlots?.[m.id]
          ? messageSlots[m.id]
          : renderAiContent(m.content, thinkingLocale ?? "en", reveal)}
        {!messageSlots?.[m.id] ? (
          <AssistantMessageActions content={m.content} locale={thinkingLocale ?? "en"} />
        ) : null}
      </>
    );
  }

  useEffect(() => {
    if (!openMenuSessionId) return;
    const close = () => setOpenMenuSessionId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuSessionId]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const close = () => setAttachMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [attachMenuOpen]);

  const send = () => {
    const t = textareaValue.trim();
    if (!t || isStreaming || composerDisabled) return;
    suppressTailScrollRef.current = false;
    onSend(t);
    setTextareaValue("");
  };

  const activeTitle =
    sessions.find((s) => s.id === currentSessionId)?.title || "POJU";

  function openSessionDialog(kind: "rename" | "delete", session: PojuSession) {
    const btn = menuBtnRefs.current.get(session.id);
    const anchor = btn?.getBoundingClientRect();
    if (!anchor) return;
    setOpenMenuSessionId(null);
    if (kind === "rename") {
      setSessionDialog({
        kind: "rename",
        sessionId: session.id,
        defaultValue: session.title,
        anchor,
      });
      return;
    }
    setSessionDialog({ kind: "delete", sessionId: session.id, anchor });
  }

  return (
    <div className={`pchat${sidebarCollapsed ? " pchat--sidebar-collapsed" : ""}`}>
      {/* 移动端抽屉遮罩 */}
      <div
        className={`pchat__overlay ${sidebarOpen ? "is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* 侧栏 */}
      <aside className={`pchat__sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="pchat__brand">
          <span className="pchat__brand-mark" aria-hidden>
            <Image
              src={pojuLogo}
              alt=""
              width={256}
              height={256}
              className="pchat__brand-mark-img"
            />
          </span>
          <span className="pchat__brand-text">
            <span
              className={`pchat__brand-name${brandTooltip ? " pchat__brand-name--has-tip" : ""}`}
              title={brandTooltip}
            >
              {brandName}
            </span>
          </span>
        </div>
        <button
          className="poju-new-session-btn poju-new-session-btn--sidebar"
          onClick={onNewSession}
          disabled={newSessionDisabled}
        >
          <span>{newSessionLabel}</span>
        </button>
        <div className="pchat__sessions-label">{sessionsLabel}</div>
        <div className="pchat__sessions">
          {sessions.map((s) => (
            <div key={s.id} className="pchat__session-wrap">
              <div
                className={`pchat__session ${
                  s.id === currentSessionId ? "is-active" : ""
                }`}
                onClick={() => {
                  onSelectSession(s.id);
                  setSidebarOpen(false);
                  setOpenMenuSessionId(null);
                }}
              >
                <div className="pchat__session-main">
                  <span className="pchat__session-title">{s.title}</span>
                  {s.meta ? <span className="pchat__session-meta">{s.meta}</span> : null}
                </div>
                {(onRenameSession || onDeleteSession) && (
                  <button
                    type="button"
                    className="pchat__session-menu-btn"
                    aria-label={sessionMenuLabel ?? "Session menu"}
                    aria-expanded={openMenuSessionId === s.id}
                    ref={(el) => {
                      if (el) menuBtnRefs.current.set(s.id, el);
                      else menuBtnRefs.current.delete(s.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuSessionId((prev) => (prev === s.id ? null : s.id));
                    }}
                  >
                    <span className="material-symbols-outlined">more_horiz</span>
                  </button>
                )}
              </div>
              {openMenuSessionId === s.id && (onRenameSession || onDeleteSession) ? (
                <div
                  className="pchat__session-menu"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onRenameSession ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openSessionDialog("rename", s);
                      }}
                    >
                      <span className="material-symbols-outlined">edit</span>
                      {renameLabel ?? "Rename"}
                    </button>
                  ) : null}
                  {onDeleteSession ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="is-danger"
                      onClick={() => {
                        openSessionDialog("delete", s);
                      }}
                    >
                      <span className="material-symbols-outlined">delete</span>
                      {deleteLabel ?? "Delete"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      {sessionDialog && sessionDialogLabels ? (
        <SessionSidebarDialog
          dialog={sessionDialog}
          renameTitle={sessionDialogLabels.renameTitle}
          renameMessage={sessionDialogLabels.renameMessage}
          deleteTitle={sessionDialogLabels.deleteTitle}
          deleteMessage={sessionDialogLabels.deleteMessage}
          cancelLabel={sessionDialogLabels.cancel}
          okLabel={sessionDialogLabels.ok}
          onCancel={() => setSessionDialog(null)}
          onConfirmRename={(value) => {
            if (!value) return;
            void Promise.resolve(onRenameSession?.(sessionDialog.sessionId, value)).finally(() =>
              setSessionDialog(null),
            );
          }}
          onConfirmDelete={() => {
            void Promise.resolve(onDeleteSession?.(sessionDialog.sessionId)).finally(() =>
              setSessionDialog(null),
            );
          }}
        />
      ) : null}

      {/* 主区 */}
      <main className="pchat__main">
        <header className="pchat__header">
          <button
            className="pchat__hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <button
            type="button"
            className="pchat__sidebar-toggle icon-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
          >
            <span className="material-symbols-outlined">
              {sidebarCollapsed ? "dock_to_right" : "dock_to_left"}
            </span>
          </button>
          <span className="pchat__header-title">{activeTitle}</span>
          {onClose ? (
            <button type="button" className="pchat__close-btn icon-btn" onClick={onClose} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : (
            <span className="pchat__header-spacer" aria-hidden />
          )}
        </header>

        <div className="pchat__scroll" ref={scrollRef}>
          <div className="pchat__messages">
            {messages.map((m) => {
              const isPendingReply = m.id === pendingReplyId;
              const showPendingBundle =
                isPendingReply &&
                m.role === "assistant" &&
                (activityOverlayVisible || revealPendingContent);
              return (
              <div key={m.id}>
                <div
                  className={`pchat__msg pchat__msg--${
                    m.role === "user" ? "user" : "ai"
                  }`}
                >
                  {m.role === "user" ? (
                    <>
                      <div className="pchat__bubble">{m.content}</div>
                      {m.editable && onEditMessage ? (
                        <button
                          type="button"
                          className="pchat__msg-edit icon-btn"
                          disabled={editDisabled}
                          onClick={() => onEditMessage(m.id, m.content)}
                          aria-label={editLabel ?? "Edit"}
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                      ) : null}
                    </>
                  ) : showPendingBundle ? (
                    <AiReplyShell>
                      <div
                        className={`pchat__pending-bundle${
                          revealPendingContent ? " is-revealed" : ""
                        }${pendingActivityFading ? " is-fading" : ""}`}
                      >
                        <div
                          className="pchat__pending-bundle__content"
                          aria-hidden={!revealPendingContent}
                        >
                          {renderAssistantBody(m, revealPendingContent)}
                        </div>
                        {activityOverlayVisible && pendingActivityLines?.length ? (
                          <div className="pchat__pending-bundle__activity">
                            <PojuActivityIndicator
                              lines={pendingActivityLines}
                              thinkingLine={thinkingLiveLine}
                            />
                          </div>
                        ) : null}
                      </div>
                    </AiReplyShell>
                  ) : bareMessageSlotIds?.has(m.id) && messageSlots?.[m.id] ? (
                    messageSlots[m.id]
                  ) : (
                    <AiReplyShell>
                      {renderAssistantBody(m)}
                    </AiReplyShell>
                  )}
                </div>
                {messageFollowUps?.[m.id] ? (
                  <div className="pchat__msg pchat__msg--ai">
                    <AiReplyShell>
                      {messageFollowUps[m.id]}
                      {messageFollowUpActionsText?.[m.id] ? (
                        <AssistantMessageActions
                          content={messageFollowUpActionsText[m.id]!}
                          locale={thinkingLocale ?? "en"}
                        />
                      ) : null}
                    </AiReplyShell>
                  </div>
                ) : null}
              </div>
            );
            })}

            {inlineNotice ? <div className="pchat__inline-notice">{inlineNotice}</div> : null}

            <div
              className={`pchat__activity-slot${
                activitySlotVisible ? " is-visible" : ""
              }${pendingActivityFading ? " is-fading" : ""}`}
              aria-hidden={!activitySlotVisible}
            >
              {pendingOnlyLegacy || (pendingActivityFading && !pendingReplyId && pendingActivityLines?.length) ? (
                <div className="pchat__msg pchat__msg--ai pchat__pending-reply">
                  <AiReplyShell>
                    <PojuActivityIndicator lines={pendingActivityLines!} thinkingLine={thinkingLiveLine} />
                  </AiReplyShell>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {paywallOverlay ? (
          <div
            className="pchat__paywall-dock"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pchat-paywall-title"
          >
            <div className="pchat__paywall-dock__panel">{paywallOverlay}</div>
          </div>
        ) : null}

        {/* 输入框 */}
        <div className="pchat__inputbar">
          <div className="pchat__inputwrap">
            {onAttachPick ? (
              <div className="pchat__attach-wrap">
                <button
                  type="button"
                  className="icon-btn pchat__composer-btn"
                  aria-label={attachMenuLabel ?? "Attach"}
                  aria-expanded={attachMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachMenuOpen((v) => !v);
                  }}
                >
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                {attachMenuOpen ? (
                  <div
                    className="pchat__attach-menu"
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        onAttachPick("document");
                      }}
                    >
                      <span className="material-symbols-outlined">description</span>
                      {attachMenuLabels?.document ?? "Document"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        onAttachPick("image");
                      }}
                    >
                      <span className="material-symbols-outlined">image</span>
                      {attachMenuLabels?.image ?? "Image"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        onAttachPick("pdf");
                      }}
                    >
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                      {attachMenuLabels?.pdf ?? "PDF"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <textarea
              ref={taRef}
              className="pchat__textarea"
              rows={1}
              placeholder={inputPlaceholder ?? "Type your message..."}
              value={textareaValue}
              disabled={isStreaming || composerDisabled}
              onPointerDown={handleComposerPointerDown}
              onFocus={handleComposerFocus}
              onChange={(e) => setTextareaValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              className={`icon-btn pchat__composer-btn${voiceActive ? " pchat__composer-btn--voice-active" : ""}`}
              aria-label={voiceActive ? (voiceStopLabel ?? "Stop voice input") : (voiceStartLabel ?? "Start voice input")}
              aria-pressed={voiceActive}
              onClick={onVoice}
            >
              <span className="material-symbols-outlined">{voiceActive ? "mic_off" : "mic"}</span>
            </button>
            <button
              type="button"
              className={`icon-btn pchat__composer-btn pchat__send-btn${isStreaming ? " pchat__send-btn--stop" : ""}`}
              onClick={() => {
                if (isStreaming && onStop) {
                  onStop();
                  return;
                }
                send();
              }}
              disabled={(!isStreaming && !textareaValue.trim() && !composerHasAttachment) || composerDisabled}
              aria-label={isStreaming ? "Stop" : "Send"}
            >
              <span className="material-symbols-outlined">{isStreaming ? "stop" : "arrow_upward"}</span>
            </button>
          </div>
        </div>

        {editDialog ? <EditMessageDialog open {...editDialog} /> : null}
        <QuestionBriefingDialog
          open={questionBriefingOpen}
          onConfirm={handleQuestionBriefingConfirm}
        />
      </main>
    </div>
  );
}
