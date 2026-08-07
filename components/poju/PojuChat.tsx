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
import { TypewriterPlainText } from "@/components/poju/TypewriterPlainText";
import { PojuReplyOptions } from "@/components/poju/PojuReplyOptions";
import { EditMessageDialog } from "@/components/poju/EditMessageDialog";
import {
  SessionSidebarDialog,
  type SessionSidebarDialogState,
} from "@/components/poju/SessionSidebarDialog";
import { QuestionBriefingDialog } from "@/components/poju/QuestionBriefingDialog";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
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
  /**
   * Status lines while a turn is in flight (spinner ± copy).
   * `null` = inactive; `[]` = spinner only (stages 1 & 3).
   */
  pendingActivityLines?: string[] | null;
  /** Fade out pending activity instead of hard unmount. */
  pendingActivityFading?: boolean;
  /**
   * Thinking/spinner placement. Always trailing (below messages) — never inside
   * the assistant bubble. Kept for callers; overlay morph was removed.
   */
  pendingActivityPlacement?: "overlay" | "trailing";
  /** Live status / progress next to the activity spinner. */
  thinkingLiveLine?: string | null;
  thinkingLocale?: string;
  /** Assistant message id currently typewriting (stages 1–3). */
  typewritingMessageId?: string | null;
  onTypewriterDone?: () => void;
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
  /** Reply chips rendered above the textarea (same composer unit). */
  composerOptions?: string[];
  onComposerOptionPick?: (optionText: string) => void;
  /** Fill option into composer for edit (parent may mirror state; PojuChat also focuses). */
  onComposerOptionEdit?: (optionText: string) => void;
  composerOptionsLabel?: string;
  composerOptionEditLabel?: string;
  onAttachPick?: (kind: PojuAttachKind) => void;
  /** When false, attach button is greyed and drag/file-paste are blocked. */
  attachEnabled?: boolean;
  attachLockedHint?: string;
  onAttachFiles?: (files: File[]) => void;
  composerAttachmentPreview?: {
    name: string;
    kind: PojuAttachKind;
    previewUrl?: string;
  } | null;
  onClearAttachment?: () => void;
  attachMenuLabels?: {
    document: string;
    image: string;
    pdf: string;
  };
  attachMenuLabel?: string;
  contextMenuLabels?: {
    cut: string;
    copy: string;
    paste: string;
    selectAll: string;
  };
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
  /** Hide the bottom input bar entirely (e.g. Phase-4 delivery — no more chat). */
  hideComposer?: boolean;
  /**
   * When set, replaces the entire message list (empty center for Phase-4 shelf).
   * Suppresses chat bubbles + pending activity overlays.
   */
  centerSlot?: ReactNode;
  brandName?: string;
  brandTooltip?: string;
  sessionsLabel?: string;
  newSessionLabel?: string;
  /** Rich assistant slots keyed by message id (energy matrix, paywall, report). */
  messageSlots?: Record<string, ReactNode>;
  /** Slot ids rendered without avatar shell (full-width embeds). */
  bareMessageSlotIds?: ReadonlySet<string>;
  /** Inline blocks inside the main assistant bubble (e.g. LLM debug), before copy/speaker actions. */
  messageFooters?: Record<string, ReactNode>;
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
  /**
   * `composer-only` — input bar only (no sidebar / header / messages).
   * `workspace` — center-column chat: messages + composer, no sidebar / header / page chrome.
   */
  chrome?: "full" | "composer-only" | "workspace";
}

/* ---------- AI 文本：定稿后走 RichReadingText；1–3 阶段新回复打字机 ---------- */
function renderAiContent(text: string, locale: string, reveal?: boolean): ReactNode {
  return (
    <RichReadingText
      text={text}
      locale={locale}
      dualLayer
      className={`pchat__reading-body${reveal ? " pchat__reading-reveal" : ""}`}
    />
  );
}

function AiThinkingShell({ children }: { children: ReactNode }) {
  return (
    <div className="pchat__ai-row pchat__ai-row--thinking">
      <PojuAiAvatar />
      <div className="pchat__ai-col pchat__ai-col--thinking">{children}</div>
    </div>
  );
}

export default function PojuChat(props: PojuChatProps) {
  const {
    sessions, currentSessionId, messages,
    isStreaming, pendingActivityLines, pendingActivityFading, thinkingLiveLine, thinkingLocale,
    pendingActivityPlacement = "trailing",
    typewritingMessageId, onTypewriterDone,
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
    composerOptions,
    onComposerOptionPick,
    onComposerOptionEdit,
    composerOptionsLabel,
    composerOptionEditLabel,
    onAttachPick,
    attachEnabled = true,
    attachLockedHint,
    onAttachFiles,
    composerAttachmentPreview,
    onClearAttachment,
    attachMenuLabels,
    attachMenuLabel,
    contextMenuLabels,
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
    hideComposer = false,
    centerSlot,
    brandName = "Pivot",
    brandTooltip,
    sessionsLabel = "Recent Sessions",
    newSessionLabel = "+ New Pivot",
    messageSlots,
    bareMessageSlotIds,
    messageFooters,
    messageFollowUps,
    messageFollowUpActionsText,
    paywallOverlay,
    initialScrollPosition = "bottom",
    onActivityRenderReady,
    questionBriefingEnabled = false,
    questionBriefingDismissed = false,
    onQuestionBriefingDismiss,
  } = props;

  const composerOnly = props.chrome === "composer-only";
  const workspaceChrome = props.chrome === "workspace";
  const hideShellChrome = composerOnly || workspaceChrome;

  const [input, setInput] = useState("");
  const [questionBriefingOpen, setQuestionBriefingOpen] = useState(false);
  const textareaValue = composerText ?? input;
  const setTextareaValue = onComposerTextChange ?? setInput;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [sessionDialog, setSessionDialog] = useState<SessionSidebarDialogState | null>(null);
  const activityRenderReadyRef = useRef<string | null>(null);
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingInitialScrollRef = useRef<"top" | "bottom" | null>(initialScrollPosition);
  const suppressTailScrollRef = useRef(initialScrollPosition === "top");
  const stickToBottomRef = useRef(initialScrollPosition !== "top");
  /** True while the user is intentionally reading older messages (wheel/touch up). */
  const userScrollLockRef = useRef(false);
  /** Last message id we already role-anchored (don't re-pin while content streams). */
  const lastAnchoredMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    pendingInitialScrollRef.current = initialScrollPosition;
    suppressTailScrollRef.current = initialScrollPosition === "top";
    stickToBottomRef.current = initialScrollPosition !== "top";
    userScrollLockRef.current = false;
    lastAnchoredMsgIdRef.current = null;
  }, [currentSessionId, initialScrollPosition]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    /**
     * Hysteresis: only re-enter stick when essentially flush to the bottom.
     * Old `distance <= 80` kept stick=true while the user scrolled up through
     * that band → any message/activity re-render snapped them back (rubber-band).
     */
    const STICK_ENTER_PX = 4;
    const STICK_EXIT_PX = 32;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        stickToBottomRef.current = false;
        userScrollLockRef.current = true;
      }
    };

    let touchLastY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchLastY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchLastY != null && y != null && y > touchLastY + 2) {
        // Finger dragged down = content moves up = reading older messages.
        stickToBottomRef.current = false;
        userScrollLockRef.current = true;
      }
      touchLastY = y ?? null;
    };
    const onTouchEnd = () => {
      touchLastY = null;
    };

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom <= STICK_ENTER_PX) {
        stickToBottomRef.current = true;
        userScrollLockRef.current = false;
      } else if (distanceFromBottom > STICK_EXIT_PX) {
        stickToBottomRef.current = false;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("scroll", onScroll);
    };
  }, [currentSessionId]);

  useEffect(() => {
    setQuestionBriefingOpen(false);
  }, [currentSessionId]);

  /* Lock document scroll — only .pchat__scroll may scroll (iOS Safari rubber-band). */
  useEffect(() => {
    if (hideShellChrome) return;
    document.documentElement.classList.add("pchat-page-lock");
    document.body.classList.add("pchat-page-lock");
    return () => {
      document.documentElement.classList.remove("pchat-page-lock");
      document.body.classList.remove("pchat-page-lock");
    };
  }, [hideShellChrome]);

  /* 输入框自适应高度 */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 44), 160)}px`;
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

  const lastMessageAnchorKey = useMemo(() => {
    const last = messages[messages.length - 1];
    return last ? `${last.id}:${last.role}` : "";
  }, [messages]);

  const scrollViewportToEnd = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    const top = Math.max(0, el.scrollHeight - el.clientHeight);
    if (behavior === "auto") {
      el.scrollTop = top;
    } else {
      el.scrollTo({ top, behavior });
    }
  };

  /**
   * Role-based scroll anchors (not stick-to-bottom on every token):
   * - New user message → scroll to bottom (see the sent bubble + waiting row)
   * - New assistant message → pin viewport to the start of that bubble; freeze while it grows
   * First entry still uses initialScrollPosition.
   */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingInitialScrollRef.current !== null) {
      const pos = pendingInitialScrollRef.current;
      if (pos === "top") {
        el.scrollTop = 0;
      } else {
        scrollViewportToEnd("auto");
      }
      pendingInitialScrollRef.current = null;
      stickToBottomRef.current = pos === "bottom";
      userScrollLockRef.current = false;
      lastAnchoredMsgIdRef.current = messages[messages.length - 1]?.id ?? null;
      return;
    }

    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.id === lastAnchoredMsgIdRef.current) return;

    if (suppressTailScrollRef.current) {
      lastAnchoredMsgIdRef.current = last.id;
      return;
    }

    lastAnchoredMsgIdRef.current = last.id;

    if (last.role === "user") {
      stickToBottomRef.current = true;
      userScrollLockRef.current = false;
      // Instant end first so we don't undershoot; smooth is unreliable when the
      // thinking row paints on the next frame and grows scrollHeight.
      scrollViewportToEnd("auto");
      return;
    }

    // Pin to the top of the model bubble; don't chase growth while streaming.
    const target = el.querySelector(
      `[data-msg-id="${CSS.escape(last.id)}"]`,
    ) as HTMLElement | null;
    if (!target) return;
    const cRect = el.getBoundingClientRect();
    const mRect = target.getBoundingClientRect();
    const topPad = 16;
    const delta = mRect.top - cRect.top - topPad;
    el.scrollTo({
      top: Math.max(0, el.scrollTop + delta),
      behavior: "smooth",
    });
    stickToBottomRef.current = false;
    userScrollLockRef.current = true;
  }, [lastMessageAnchorKey, currentSessionId, messages]);

  // Thinking is always a trailing row (avatar + spinner) — never inside the bubble.
  // Overlay/pending-bundle morph was the “bubble grows then shrinks” jank.
  const thinkingActive = pendingActivityLines != null || pendingActivityFading;
  const activitySlotVisible = thinkingActive;

  /**
   * After send, the wait spinner / live line often mounts after the user bubble.
   * Keep glued to the true bottom while stick is on (until model bubble pins top).
   */
  useLayoutEffect(() => {
    if (!stickToBottomRef.current || userScrollLockRef.current) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && !thinkingActive) return;
    scrollViewportToEnd("auto");
    const id = window.requestAnimationFrame(() => {
      if (!stickToBottomRef.current || userScrollLockRef.current) return;
      scrollViewportToEnd("auto");
    });
    return () => window.cancelAnimationFrame(id);
  }, [
    messages,
    thinkingActive,
    pendingActivityLines,
    thinkingLiveLine,
    lastMessageAnchorKey,
  ]);

  useLayoutEffect(() => {
    if (!thinkingActive || pendingActivityFading) return;
    if (activityRenderReadyRef.current === "thinking") return;

    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || activityRenderReadyRef.current === "thinking") return;
        activityRenderReadyRef.current = "thinking";
        onActivityRenderReady?.();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [thinkingActive, pendingActivityFading, onActivityRenderReady]);

  useEffect(() => {
    activityRenderReadyRef.current = null;
  }, [pendingActivityLines]);

  function renderAssistantBody(m: PojuMessage, reveal?: boolean) {
    if (bareMessageSlotIds?.has(m.id) && messageSlots?.[m.id]) {
      return messageSlots[m.id];
    }
    if (typewritingMessageId && m.id === typewritingMessageId) {
      return (
        <TypewriterPlainText
          text={m.content}
          className="pchat__streaming-line pchat__typewriter-body"
          onDone={onTypewriterDone}
        />
      );
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

  function renderAssistantMessage(m: PojuMessage) {
    if (bareMessageSlotIds?.has(m.id) && messageSlots?.[m.id]) {
      return messageSlots[m.id];
    }
    return (
      <div className="pchat__ai-row">
        <PojuAiAvatar />
        <div className="pchat__ai-col">
          <div className="pchat__ai">{renderAssistantBody(m)}</div>
          {messageFooters?.[m.id] ? (
            <div className="pchat__msg-meta">{messageFooters[m.id]}</div>
          ) : null}
        </div>
      </div>
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

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [ctxMenu]);

  function ingestDroppedFiles(fileList: FileList | File[] | null | undefined) {
    if (!fileList || !onAttachFiles) return;
    const files = Array.from(fileList).filter(Boolean);
    if (!files.length) return;
    if (!attachEnabled) {
      window.alert(attachLockedHint || "Please describe your question in text first");
      return;
    }
    onAttachFiles(files.slice(0, 1));
  }

  async function runCtxAction(action: "cut" | "copy" | "paste" | "selectAll") {
    setCtxMenu(null);
    const ta = taRef.current;
    if (!ta || ta.disabled) return;
    ta.focus();
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = textareaValue;

    if (action === "selectAll") {
      ta.setSelectionRange(0, value.length);
      return;
    }
    if (action === "copy") {
      const selected = value.slice(start, end);
      if (selected) await navigator.clipboard.writeText(selected).catch(() => undefined);
      return;
    }
    if (action === "cut") {
      const selected = value.slice(start, end);
      if (!selected) return;
      await navigator.clipboard.writeText(selected).catch(() => undefined);
      setTextareaValue(value.slice(0, start) + value.slice(end));
      requestAnimationFrame(() => ta.setSelectionRange(start, start));
      return;
    }
    if (action === "paste") {
      try {
        const clip = await navigator.clipboard.read();
        for (const item of clip) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const ext = imageType.split("/")[1] || "png";
            const file = new File([blob], `paste.${ext}`, { type: imageType });
            ingestDroppedFiles([file]);
            return;
          }
        }
      } catch {
        /* fall through to text paste */
      }
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const next = value.slice(0, start) + text + value.slice(end);
        setTextareaValue(next);
        const caret = start + text.length;
        requestAnimationFrame(() => ta.setSelectionRange(caret, caret));
      } catch {
        /* ignore */
      }
    }
  }

  const send = () => {
    const t = textareaValue.trim();
    if (!t || isStreaming || composerDisabled) return;
    suppressTailScrollRef.current = false;
    stickToBottomRef.current = true;
    userScrollLockRef.current = false;
    onSend(t);
    setTextareaValue("");
  };

  const handleOptionEdit = (optionText: string) => {
    if (isStreaming || composerDisabled) return;
    setTextareaValue(optionText);
    onComposerOptionEdit?.(optionText);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const len = optionText.length;
      ta.setSelectionRange(len, len);
    });
  };

  const activeTitle =
    sessions.find((s) => s.id === currentSessionId)?.title || "Pivot";

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
    <div
      className={`pchat${sidebarCollapsed && !hideShellChrome ? " pchat--sidebar-collapsed" : ""}${
        composerOnly ? " pchat--composer-only" : ""
      }${workspaceChrome ? " pchat--workspace" : ""}`}
    >
      {!hideShellChrome ? (
        <>
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
        </>
      ) : null}

      {/* 主区 */}
      <main
        className={`pchat__main${composerOnly ? " pchat__main--composer-only" : ""}${
          workspaceChrome ? " pchat__main--workspace" : ""
        }`}
      >
        {!composerOnly ? (
          <>
        {workspaceChrome ? null : (
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
        )}

        {workspaceChrome ? (
          <WorkspaceScrollArea
            className="pchat__ws-scroll"
            viewportClassName="pchat__scroll pchat__scroll--ws"
            viewportRef={scrollRef}
            fixedThumbPx={52}
          >
            <div className="pchat__messages">
            {centerSlot ? (
              <div className="pchat__center-slot">{centerSlot}</div>
            ) : (
            messages.map((m) => (
              <div key={m.id}>
                <div
                  data-msg-id={m.id}
                  className={`pchat__msg pchat__msg--${
                    m.role === "user" ? "user" : "ai"
                  }`}
                >
                  {m.role === "user" ? (
                    <>
                      <div className="pchat__user-row">
                        <div className="pchat__bubble">{m.content}</div>
                        <span className="pchat__user-accent" aria-hidden />
                      </div>
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
                  ) : (
                    renderAssistantMessage(m)
                  )}
                </div>
                {messageFollowUps?.[m.id] ? (
                  <div className="pchat__msg pchat__msg--ai">
                    <div className="pchat__ai-row">
                      <PojuAiAvatar />
                      <div className="pchat__ai-col">
                        <div className="pchat__ai">
                          {messageFollowUps[m.id]}
                          {messageFollowUpActionsText?.[m.id] ? (
                            <AssistantMessageActions
                              content={messageFollowUpActionsText[m.id]!}
                              locale={thinkingLocale ?? "en"}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
            )}

            {centerSlot ? null : inlineNotice ? <div className="pchat__inline-notice">{inlineNotice}</div> : null}

            {centerSlot ? null : (
            <div
              className={`pchat__activity-slot${
                activitySlotVisible ? " is-visible" : ""
              }${pendingActivityFading ? " is-fading" : ""}`}
              aria-hidden={!activitySlotVisible}
            >
              {activitySlotVisible ? (
                <div className="pchat__msg pchat__msg--ai pchat__pending-reply">
                  <AiThinkingShell>
                    <PojuActivityIndicator
                      lines={pendingActivityLines ?? []}
                      thinkingLine={thinkingLiveLine}
                    />
                  </AiThinkingShell>
                </div>
              ) : null}
            </div>
            )}
          </div>
          </WorkspaceScrollArea>
        ) : (
        <div className="pchat__scroll" ref={scrollRef}>
          <div className="pchat__messages">
            {centerSlot ? (
              <div className="pchat__center-slot">{centerSlot}</div>
            ) : (
            messages.map((m) => (
              <div key={m.id}>
                <div
                  data-msg-id={m.id}
                  className={`pchat__msg pchat__msg--${
                    m.role === "user" ? "user" : "ai"
                  }`}
                >
                  {m.role === "user" ? (
                    <>
                      <div className="pchat__user-row">
                        <div className="pchat__bubble">{m.content}</div>
                        <span className="pchat__user-accent" aria-hidden />
                      </div>
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
                  ) : (
                    renderAssistantMessage(m)
                  )}
                </div>
                {messageFollowUps?.[m.id] ? (
                  <div className="pchat__msg pchat__msg--ai">
                    <div className="pchat__ai-row">
                      <PojuAiAvatar />
                      <div className="pchat__ai-col">
                        <div className="pchat__ai">
                          {messageFollowUps[m.id]}
                          {messageFollowUpActionsText?.[m.id] ? (
                            <AssistantMessageActions
                              content={messageFollowUpActionsText[m.id]!}
                              locale={thinkingLocale ?? "en"}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
            )}

            {centerSlot ? null : inlineNotice ? <div className="pchat__inline-notice">{inlineNotice}</div> : null}

            {centerSlot ? null : (
            <div
              className={`pchat__activity-slot${
                activitySlotVisible ? " is-visible" : ""
              }${pendingActivityFading ? " is-fading" : ""}`}
              aria-hidden={!activitySlotVisible}
            >
              {activitySlotVisible ? (
                <div className="pchat__msg pchat__msg--ai pchat__pending-reply">
                  <AiThinkingShell>
                    <PojuActivityIndicator
                      lines={pendingActivityLines ?? []}
                      thinkingLine={thinkingLiveLine}
                    />
                  </AiThinkingShell>
                </div>
              ) : null}
            </div>
            )}
          </div>
        </div>
        )}
          </>
        ) : null}

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

        {/* Glass composer: options + input layer + action toolbar */}
        {!hideComposer ? (
        <div className="pchat__inputbar">
          <div
            className={
              composerOptions && composerOptions.length >= 2
                ? "pchat__composer-unit pchat__composer-unit--with-options"
                : "pchat__composer-unit"
            }
          >
            {composerOptions && composerOptions.length >= 2 && onComposerOptionPick ? (
              <div className="pchat__composer-options">
                <PojuReplyOptions
                  options={composerOptions}
                  busy={Boolean(isStreaming || composerDisabled)}
                  onPick={onComposerOptionPick}
                  onEdit={handleOptionEdit}
                  groupLabel={composerOptionsLabel}
                  editLabel={composerOptionEditLabel}
                />
              </div>
            ) : null}

            <div className="pchat__composer-field">
              <textarea
                ref={taRef}
                className="pchat__textarea"
                rows={1}
                placeholder={inputPlaceholder ?? "State your strategic dilemma..."}
                value={textareaValue}
                disabled={isStreaming || composerDisabled}
                onPointerDown={handleComposerPointerDown}
                onFocus={handleComposerFocus}
                onChange={(e) => setTextareaValue(e.target.value)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY });
                }}
                onTouchStart={(e) => {
                  if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
                  const t = e.touches[0];
                  if (!t) return;
                  longPressTimerRef.current = window.setTimeout(() => {
                    setCtxMenu({ x: t.clientX, y: t.clientY });
                  }, 480);
                }}
                onTouchEnd={() => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onTouchMove={() => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
            </div>

            <div className="pchat__composer-toolbar">
              <div className="pchat__composer-toolbar__tools">
                <button
                  type="button"
                  className={`pchat__tool-btn${voiceActive ? " pchat__tool-btn--active" : ""}`}
                  aria-label={voiceActive ? (voiceStopLabel ?? "Stop voice input") : (voiceStartLabel ?? "Start voice input")}
                  aria-pressed={voiceActive}
                  onClick={onVoice}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {voiceActive ? "mic_off" : "mic"}
                  </span>
                  <span className="pchat__tool-btn__label">
                    {voiceActive ? "Stop" : "Voice"}
                  </span>
                </button>
              </div>
              <button
                type="button"
                className={`pchat__send-btn${isStreaming ? " pchat__send-btn--stop" : ""}`}
                onClick={() => {
                  if (isStreaming && onStop) {
                    onStop();
                    return;
                  }
                  send();
                }}
                disabled={(!isStreaming && !textareaValue.trim()) || composerDisabled}
                aria-label={isStreaming ? "Stop" : "Send"}
              >
                {isStreaming ? (
                  <span className="material-symbols-outlined">stop</span>
                ) : (
                  <svg
                    className="pchat__send-btn__icon"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M16.1401 2.96004L7.11012 5.96004C1.04012 7.99004 1.04012 11.3 7.11012 13.32L9.79012 14.21L10.6801 16.89C12.7001 22.96 16.0201 22.96 18.0401 16.89L21.0501 7.87004C22.3901 3.82004 20.1901 1.61004 16.1401 2.96004ZM16.4601 8.34004L12.6601 12.16C12.5101 12.31 12.3201 12.38 12.1301 12.38C11.9401 12.38 11.7501 12.31 11.6001 12.16C11.3101 11.87 11.3101 11.39 11.6001 11.1L15.4001 7.28004C15.6901 6.99004 16.1701 6.99004 16.4601 7.28004C16.7501 7.57004 16.7501 8.05004 16.4601 8.34004Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {ctxMenu ? (
            <div
              className="pchat__ctx-menu"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" role="menuitem" onClick={() => void runCtxAction("cut")}>
                {contextMenuLabels?.cut ?? "Cut"}
              </button>
              <button type="button" role="menuitem" onClick={() => void runCtxAction("copy")}>
                {contextMenuLabels?.copy ?? "Copy"}
              </button>
              <button type="button" role="menuitem" onClick={() => void runCtxAction("paste")}>
                {contextMenuLabels?.paste ?? "Paste"}
              </button>
              <button type="button" role="menuitem" onClick={() => void runCtxAction("selectAll")}>
                {contextMenuLabels?.selectAll ?? "Select all"}
              </button>
            </div>
          ) : null}
        </div>
        ) : null}

        {editDialog ? <EditMessageDialog open {...editDialog} /> : null}
        <QuestionBriefingDialog
          open={questionBriefingOpen}
          onConfirm={handleQuestionBriefingConfirm}
        />
      </main>
    </div>
  );
}
