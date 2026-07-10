"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import PojuChat from "@/components/poju/PojuChat";
import { useAppDialog } from "@/components/ui/app-dialog";
import { OffTopicAction } from "@/components/poju/OffTopicAction";
import { RefundOfferAction } from "@/components/poju/RefundOfferAction";
import {
  resolveActivityForSend,
  willRunDegradedDelivery,
  type PojuActivity,
} from "@/lib/poju/activity";
import { PojuActivityIndicator } from "@/components/poju/PojuActivityIndicator";
import { getPojuDb } from "@/lib/db/poju-db";
import { createPOJUSession, loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId, readPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { runDegradedDeliveryPipeline } from "@/lib/poju/agent-orchestrator";
import { handleUserMessage, tryHandleRuleRejection } from "@/lib/poju/agent";
import {
  dedupeWelcomeMessages,
  hasFixedWelcomeMessage,
  hasMatrixWelcomeMessage,
  isMatrixWelcomeMessage,
  seedFixedWelcomeMessages,
  seedMatrixWelcomeMessage,
} from "@/lib/poju/chat-bootstrap";
import { AgendaProgressPanel } from "@/components/poju/AgendaProgressPanel";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { InfraBusyRetryAction } from "@/components/poju/InfraBusyRetryAction";
import { getPojuServiceBusyMessage, isPojuFailurePlaceholderMessage } from "@/lib/llm/poju-service-busy-message";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { profileHasBaseAnalysis } from "@/lib/profile/stored-profiles-service";
import { markPOJUV4SessionResolved } from "@/lib/poju/v4-lifecycle";
import {
  DEFAULT_NEW_SESSION_TITLE,
  formatSessionListDateTime,
  isDefaultNewSessionTitle,
  resolveSessionListTopic,
  topicFromFirstUserMessage,
} from "@/lib/poju/session-list-label";
import { getActiveCycle, recordUserResponse } from "@/lib/poju/cycle-manager";
import { findPendingToolInjection } from "@/lib/poju/find-pending-tool-injection";
import { getToolSuggestionResponseState } from "@/lib/poju/tool-suggestion";
import type { POJUSessionState, POJUAction, POJUMessage, ToolName } from "@/lib/poju/types";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, requestSituationAnalysis } from "@/lib/llm/deepseek/situation-analysis";
import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";
import { rewindSessionToUserMessage } from "@/lib/poju/session-rewind";
import { useSpeechInput } from "@/lib/poju/use-speech-input";
import { SessionExpiryDialog } from "@/components/poju/SessionExpiryDialog";
import {
  isSessionExpired,
  setExpiryReminderSnoozed,
  shouldShowExpiryWarning,
} from "@/lib/poju/expiry-reminder";
import { MatrixNarrativeReply, matrixNarrativeActionsText } from "@/components/poju/MatrixNarrativeReply";
import { AssistantMessageActions } from "@/components/poju/AssistantMessageActions";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { PojuPaywallInline } from "@/components/poju/PojuPaywallInline";
import { MainDeliveryView } from "@/components/poju/MainDeliveryView";
import { PojuReportChatCard } from "@/components/poju/PojuReportChatCard";
import { PojuStateDebugPanel } from "@/components/poju/PojuStateDebugPanel";
import { LLMCallDebugPanel } from "@/components/poju/LLMCallDebugPanel";
import { StateMachineDebugPanel } from "@/components/poju/StateMachineDebugPanel";
import { buildDevStateLedger } from "@/lib/poju/dev-state-ledger";
import { useLlmDebugEnabled } from "@/lib/poju/use-llm-debug-enabled";
import { PojuAgendaCard } from "@/components/poju/PojuAgendaCard";
import { PojuUnlockReportModal } from "@/components/poju/PojuUnlockReportModal";
import { hasUnlockReportMessage, prepareUnlockReleaseSession } from "@/lib/poju/finalize-unlock-bazi-session";
import {
  createPaywallMessage,
  dedupePreviewMatrixMessages,
  hasPaywallMessage,
  hasPreviewMatrixMessage,
  isEnergyMatrixMessage,
  isPreviewSession,
  POJU_RELEASE_PENDING_QUESTION_FLAG,
} from "@/lib/poju/preview-unlock";
import {
  getUnlockReportMessage,
  getUnlockReportText,
  getInitialUnlockReportUiState,
  isPendingUnlockQuestionRelease,
  reportPreviewForCard,
} from "@/lib/poju/unlock-report-gate";
import {
  markPojuChatIntroSeen,
  pojuChatInitialScrollPosition,
} from "@/lib/poju/chat-intro-scroll";
import { redirectToPojuSessionPayment } from "@/lib/poju/start-poju-session-payment";
import "@/styles/topic-drift.css";
import "@/styles/poju-energy-matrix.css";

interface Props {
  session: POJUSessionState;
  onSessionUpdate: (s: POJUSessionState) => void;
  locale: string;
}

type SessionListRow = {
  session_id: string;
  original_question: string;
  status: "active" | "paused" | "resolved" | "archived";
  created_at: Date;
  last_interaction_at: Date;
};

type ComposerAttachment = {
  name: string;
  kind: "image" | "document" | "pdf";
  dataUrl?: string;
};

type TurnErrorRestore = {
  rollbackSession: POJUSessionState;
  typed: string;
  attachment: ComposerAttachment | null;
};

const PROVIDER_QUEUE_SILENT_RETRY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildOptimisticUserMessage(content: string): POJUMessage {
  return {
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
  };
}

export function POJUChatUI({ session, onSessionUpdate, locale }: Props) {
  const t = useTranslations("poju.chat");
  const tActivity = useTranslations("poju.activity");
  const tBrand = useTranslations("poju.branding");
  const dialog = useAppDialog();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false);
  const [expiryPaymentBusy, setExpiryPaymentBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sessionRows, setSessionRows] = useState<SessionListRow[]>([]);
  const [composerAttachment, setComposerAttachment] = useState<ComposerAttachment | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [situationFp, setSituationFp] = useState<string | null>(null);
  const [situationBusy, setSituationBusy] = useState(false);
  const [situationError, setSituationError] = useState<string | null>(null);
  const [situationNotice, setSituationNotice] = useState<string | null>(null);
  const [finalBusy, setFinalBusy] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [slotActivity, setSlotActivity] = useState<PojuActivity | null>(null);
  const [slotActivityFading, setSlotActivityFading] = useState(false);
  const [thinkingLiveLine, setThinkingLiveLine] = useState<string | null>(null);
  const [debugStateLedger, setDebugStateLedger] = useState<unknown>(null);
  const [generationStopped, setGenerationStopped] = useState(false);
  const [showOffTopicAction, setShowOffTopicAction] = useState(false);
  const [driftReason, setDriftReason] = useState("");
  const [editDialog, setEditDialog] = useState<{ messageId: string; content: string } | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockReportModalOpen, setUnlockReportModalOpen] = useState(
    () => getInitialUnlockReportUiState(session).modalOpen,
  );
  const [unlockReportGateDismissed, setUnlockReportGateDismissed] = useState(
    () => getInitialUnlockReportUiState(session).gateDismissed,
  );
  const openingInitRef = useRef(false);
  const releasePendingInitRef = useRef<string | null>(null);
  const toolResumeInitRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const documentFileRef = useRef<HTMLInputElement | null>(null);
  const pdfFileRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const syncDebugStateLedger = useCallback((s: POJUSessionState) => {
    if (process.env.NODE_ENV !== "development") return;
    setDebugStateLedger(buildDevStateLedger(s));
  }, []);

  useEffect(() => {
    syncDebugStateLedger(session);
  }, [session.session_id, session.agent_v2, syncDebugStateLedger]);
  const sendAbortRef = useRef<AbortController | null>(null);
  const sendGenerationRef = useRef(0);
  const turnInFlightRef = useRef(false);
  /** Synchronous dedupe — blocks same-tick double runUserTurn before turnInFlightRef is visible. */
  const activeTurnKeyRef = useRef<string | null>(null);
  /** One silent provider-queue retry per user send turn. */
  const silentRetriedRef = useRef(false);
  const pendingSilentRetryRef = useRef<{
    rollbackSession: POJUSessionState;
    userMessage: string;
    errorRestore: TurnErrorRestore;
  } | null>(null);
  const infraRetryContextRef = useRef<(TurnErrorRestore & { userMessage: string }) | null>(null);
  const awaitingActivityDismissRef = useRef(false);
  const skipActivityRenderReadyRef = useRef(false);
  const router = useRouter();
  const showStateDebug = useLlmDebugEnabled();
  const speechLang = locale.startsWith("zh") ? "zh-CN" : locale.startsWith("fr") ? "fr-FR" : "en-US";
  const {
    active: voiceActive,
    stop: stopVoiceInput,
    toggle: toggleVoiceInput,
  } = useSpeechInput(input, setInput, {
    lang: speechLang,
    onUnsupported: () => void dialog.alert(t("dialog_speech_unsupported")),
    onPermissionDenied: () => void dialog.alert(t("dialog_speech_denied")),
  });

  const getActivityLines = useCallback(
    (key: PojuActivity): string[] => {
      const raw = tActivity.raw(key);
      return Array.isArray(raw) ? (raw as string[]) : [];
    },
    [tActivity],
  );

  const clearSlotActivityWithFade = useCallback(() => {
    if (!slotActivity || slotActivityFading) return;
    setSlotActivityFading(true);
    window.setTimeout(() => {
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
    }, 220);
  }, [slotActivity, slotActivityFading]);

  const handleActivityRenderReady = useCallback(() => {
    if (skipActivityRenderReadyRef.current) return;
    awaitingActivityDismissRef.current = false;
    clearSlotActivityWithFade();
  }, [clearSlotActivityWithFade]);

  const pendingActivityLines = useMemo(() => {
    if (slotActivity) return getActivityLines(slotActivity);
    return null;
  }, [slotActivity, getActivityLines]);

  const scrollChatToBottom = useCallback((_behavior: ScrollBehavior = "smooth") => {
    /* PojuChat scrolls internally */
  }, []);

  const displaySession = useMemo(
    () => dedupeWelcomeMessages(dedupePreviewMatrixMessages(session)),
    [session],
  );

  const visibleMessages = useMemo(
    () =>
      displaySession.messages.filter(
        (m) =>
          m.role !== "system" &&
          !m.content.trim().startsWith("[SYSTEM:") &&
          m.meta?.kind !== "paywall",
      ),
    [displaySession.messages],
  );
  const paywallOpen = isPreviewSession(session) && hasPaywallMessage(session);
  const initialScrollPosition = useMemo(
    () => pojuChatInitialScrollPosition(session.session_id),
    [session.session_id],
  );
  const unlockReportMessage = useMemo(() => getUnlockReportMessage(session), [session.messages]);
  const unlockReportText = useMemo(() => getUnlockReportText(unlockReportMessage), [unlockReportMessage]);
  const unlockReportProfileId =
    unlockReportMessage?.meta?.report_profile_id ??
    session.agent_v2?.selected_profile_id ??
    session.selected_stored_profile_id ??
    undefined;
  const unlockReportGatePending =
    Boolean(unlockReportMessage) &&
    isPendingUnlockQuestionRelease(session.session_id) &&
    !unlockReportGateDismissed;
  const unlockReportGateBlocking = unlockReportGatePending;
  const hasUserMessage = visibleMessages.some((m) => m.role === "user");
  const expired = isSessionExpired(session.expires_at);
  const previewComposerBlocked = isPreviewSession(session) && hasPaywallMessage(session);
  const questionBriefingEnabled =
    isPreviewSession(session) && !hasPaywallMessage(session) && !session.pending_question?.trim();
  const composerLocked = expired || previewComposerBlocked || unlockBusy || unlockReportGateBlocking;

  const openUnlockReportModal = useCallback(() => setUnlockReportModalOpen(true), []);

  useEffect(() => {
    if (!unlockReportMessage) {
      setUnlockReportModalOpen(false);
      return;
    }
    if (!isPendingUnlockQuestionRelease(session.session_id)) {
      setUnlockReportGateDismissed(true);
      setUnlockReportModalOpen(false);
      return;
    }
    setUnlockReportGateDismissed(false);
    setUnlockReportModalOpen(true);
  }, [session.session_id, unlockReportMessage]);

  useEffect(() => {
    if (initialScrollPosition === "top") {
      markPojuChatIntroSeen(session.session_id);
    }
  }, [session.session_id, initialScrollPosition]);

  useEffect(() => {
    if (expired) {
      setExpiryDialogOpen(true);
      return;
    }
    setExpiryDialogOpen(shouldShowExpiryWarning(session.session_id, session.expires_at));
  }, [session.session_id, session.expires_at, expired]);

  useEffect(() => {
    scrollChatToBottom("smooth");
  }, [session.messages, scrollChatToBottom]);

  useEffect(() => {
    if (sending) scrollChatToBottom("auto");
  }, [sending, scrollChatToBottom]);

  useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      const rows = await getPojuDb().pojuSessionRecords.where("device_id").equals(session.device_id).toArray();
      if (cancelled) return;
      rows.sort((a, b) => b.last_interaction_at.getTime() - a.last_interaction_at.getTime());
      setSessionRows(
        rows.map((r) => ({
          session_id: r.session_id,
          original_question: r.original_question,
          status: r.status,
          created_at: r.created_at,
          last_interaction_at: r.last_interaction_at,
        })),
      );
    }
    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [session.device_id, session.session_id, session.last_interaction_at, session.original_question]);

  useEffect(() => {
    let cancelled = false;
    void computeSituationContextFingerprint({
      session_id: session.session_id,
      original_question: session.original_question,
      agent_v2: session.agent_v2,
      context_collected: session.context_collected,
    }).then((fp) => {
      if (!cancelled) setSituationFp(fp);
    });
    return () => {
      cancelled = true;
    };
  }, [session.session_id, session.original_question, session.agent_v2, session.context_collected]);

  useEffect(() => {
    if (openingInitRef.current) return;
    if (!resolveSessionHasProfile(session)) return;
    if (session.matrix_payload) return;
    if (hasUnlockReportMessage(session)) return;
    if (hasFixedWelcomeMessage(session)) return;
    if (sending || pipelineBusy) return;

    openingInitRef.current = true;
    const seeded = seedFixedWelcomeMessages(session, locale);
    if (seeded !== session) {
      onSessionUpdate(seeded);
      void savePOJUSession(seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per profile-less session
  }, [session.session_id, session.messages, session.matrix_payload]);

  useEffect(() => {
    let next = dedupePreviewMatrixMessages(session);
    next = dedupeWelcomeMessages(next);
    if (
      resolveSessionHasProfile(next) &&
      next.matrix_payload &&
      !hasMatrixWelcomeMessage(next)
    ) {
      next = seedMatrixWelcomeMessage(next, locale);
    }
    next = dedupeWelcomeMessages(next);
    if (next !== session) {
      onSessionUpdate(next);
      void savePOJUSession(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dedupe / migrate welcome when messages change
  }, [session.session_id, session.messages, session.matrix_payload, locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (releasePendingInitRef.current === session.session_id) return;
    const flag = sessionStorage.getItem(POJU_RELEASE_PENDING_QUESTION_FLAG);
    if (flag !== session.session_id) return;
    if (sending || pipelineBusy) return;
    if (!hasUnlockReportMessage(session)) return;
    if (!unlockReportGateDismissed) return;

    const pending = session.pending_question?.trim() || session.original_question?.trim();
    if (!pending) return;

    const alreadySent = session.messages.some(
      (m) => m.role === "user" && !m.is_rejected && m.content.trim() === pending,
    );
    if (alreadySent) {
      releasePendingInitRef.current = session.session_id;
      sessionStorage.removeItem(POJU_RELEASE_PENDING_QUESTION_FLAG);
      return;
    }

    releasePendingInitRef.current = session.session_id;
    sessionStorage.removeItem(POJU_RELEASE_PENDING_QUESTION_FLAG);

    const cleared = prepareUnlockReleaseSession(sessionRef.current, pending);
    onSessionUpdate(cleared);
    void savePOJUSession(cleared).then(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      void runUserTurn(cleared, pending);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per unlock return
  }, [
    session.session_id,
    session.messages,
    sending,
    pipelineBusy,
    unlockReportGateDismissed,
    onSessionUpdate,
  ]);

  useEffect(() => {
    if (toolResumeInitRef.current === session.session_id) return;
    if (!hasUserMessage) return;
    if (sending || pipelineBusy) return;
    if (!findPendingToolInjection(session)) return;

    toolResumeInitRef.current = session.session_id;
    const resumeMsg = locale.startsWith("zh")
      ? "我从工具回来了，我们继续聊。"
      : "I'm back from the tool — let's continue.";
    void runUserTurn(sessionRef.current, resumeMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session when tool result pending
  }, [session.session_id, hasUserMessage, sending, pipelineBusy, locale]);

  function handleStopGeneration() {
    sendGenerationRef.current += 1;
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    turnInFlightRef.current = false;
    activeTurnKeyRef.current = null;
    setSending(false);
    setSlotActivity(null);
    setSlotActivityFading(false);
    setThinkingLiveLine(null);
    awaitingActivityDismissRef.current = false;
    skipActivityRenderReadyRef.current = false;
    setGenerationStopped(true);
  }

  async function handleEditUserMessage(messageId: string, currentContent: string) {
    if (sending || pipelineBusy) return;
    setEditDialog({ messageId, content: currentContent });
  }

  async function confirmEditUserMessage(newContent: string) {
    if (!editDialog) return;
    const { messageId, content: currentContent } = editDialog;
    setEditDialog(null);

    if (!newContent || newContent === currentContent.trim()) return;

    const fullIndex = sessionRef.current.messages.findIndex(
      (m) => m.timestamp === messageId && m.role === "user",
    );
    if (fullIndex < 0) return;

    handleStopGeneration();

    const rewound = rewindSessionToUserMessage(sessionRef.current, fullIndex, newContent);
    const rejected = tryHandleRuleRejection(rewound, newContent, locale);
    const nextSession = rejected ?? rewound;

    onSessionUpdate(nextSession);
    await savePOJUSession(nextSession);

    if (rejected) return;

    await runUserTurn(rewound, newContent);
  }

  async function persistInfraBusyTurn(
    errorRestore: TurnErrorRestore,
    userMessage: string,
  ): Promise<void> {
    const busyMessage: POJUMessage = {
      role: "assistant",
      content: getPojuServiceBusyMessage(locale),
      timestamp: new Date().toISOString(),
      client_id: safeRandomUUID(),
      meta: { kind: "infra_busy" },
    };
    const userEcho = buildOptimisticUserMessage(userMessage);
    const nextSession: POJUSessionState = {
      ...errorRestore.rollbackSession,
      messages: [...errorRestore.rollbackSession.messages, userEcho, busyMessage],
    };
    infraRetryContextRef.current = { ...errorRestore, userMessage };
    onSessionUpdate(nextSession);
    await savePOJUSession(nextSession);
  }


  async function runUserTurn(
    baseSession: POJUSessionState,
    userMessage: string,
    errorRestore?: TurnErrorRestore,
  ) {
    if (turnInFlightRef.current) return;

    const turnKey = `${baseSession.session_id}::${userMessage.trim()}`;
    if (activeTurnKeyRef.current === turnKey) return;

    turnInFlightRef.current = true;
    activeTurnKeyRef.current = turnKey;

    const liveMsgs = sessionRef.current.messages;
    const lastUserMsg = [...liveMsgs].reverse().find((m) => m.role === "user" && !m.is_rejected);
    const lastMsg = liveMsgs[liveMsgs.length - 1];
    const alreadyAnswered =
      lastUserMsg?.content.trim() === userMessage.trim() &&
      lastMsg?.role === "assistant" &&
      !isPojuFailurePlaceholderMessage(lastMsg.content);
    if (alreadyAnswered) {
      turnInFlightRef.current = false;
      activeTurnKeyRef.current = null;
      return;
    }

    const gen = ++sendGenerationRef.current;
    const ac = new AbortController();
    sendAbortRef.current = ac;
    setSending(true);
    setSlotActivity(resolveActivityForSend(baseSession));
    setThinkingLiveLine(null);
    setGenerationStopped(false);
    scrollChatToBottom("smooth");

    try {
      const profileId = baseSession.selected_stored_profile_id?.trim();
      const isRealUserTurn =
        userMessage.trim().length > 0 && !userMessage.startsWith("[SYSTEM:");
      if (isRealUserTurn && profileId && resolveSessionHasProfile(baseSession)) {
        const ready = await ensureBaseAnalysisReady(profileId);
        if (!ready) {
          await dialog.alert(
            locale.startsWith("zh")
              ? "命主基础分析准备中，请稍后再发送。"
              : "Base chart analysis is still preparing. Please wait and try again.",
          );
          return;
        }
      }

      const updatedSession = await handleUserMessage({
        session: baseSession,
        userMessage,
        locale,
        userAlreadyAppended: true,
        signal: ac.signal,
      });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      const userCount = updatedSession.messages.filter((m) => m.role === "user").length;
      let toPersist = updatedSession;
      if (
        userCount === 1 &&
        isDefaultNewSessionTitle(updatedSession.original_question)
      ) {
        const topic = topicFromFirstUserMessage(userMessage);
        if (topic) {
          toPersist = { ...updatedSession, original_question: topic };
          setSessionRows((prev) =>
            prev.map((x) => (x.session_id === toPersist.session_id ? { ...x, original_question: topic } : x)),
          );
        }
      }

      onSessionUpdate(toPersist);
      const runDegraded = willRunDegradedDelivery(toPersist);
      if (runDegraded) {
        skipActivityRenderReadyRef.current = true;
      } else {
        skipActivityRenderReadyRef.current = false;
        awaitingActivityDismissRef.current = true;
      }
      syncDebugStateLedger(toPersist);
      await savePOJUSession(toPersist);
      if (toPersist.main_delivery_done && !baseSession.main_delivery_done) {
        setSituationNotice(t("final_delivery_done"));
      }

      const lastAssistant = [...toPersist.messages]
        .reverse()
        .find((m) => m.role === "assistant" && !m.is_rejected);
      if (lastAssistant?.meta?.should_show_new_session_button) {
        setShowOffTopicAction(true);
        setDriftReason(lastAssistant.meta.drift_reason ?? "");
      } else {
        setShowOffTopicAction(false);
        setDriftReason("");
      }

      if (runDegraded) {
        setPipelineBusy(true);
        setSlotActivity("degraded_delivering");
        try {
          let finalSession = await runDegradedDeliveryPipeline(toPersist, locale);
          if (finalSession.main_delivery_done && !finalSession.action_plan_archive_id) {
            const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
            finalSession = await trySaveDeliveryActionsToArchive(finalSession, locale);
          }
          skipActivityRenderReadyRef.current = false;
          awaitingActivityDismissRef.current = true;
          onSessionUpdate(finalSession);
          syncDebugStateLedger(finalSession);
          await savePOJUSession(finalSession);
          setSituationNotice(
            locale.startsWith("zh") ? "方向性分析已生成。" : "Directional analysis is ready.",
          );
        } catch (e) {
          console.warn("[poju] Degraded delivery failed:", e);
          setSituationError(e instanceof Error ? e.message : String(e));
          setSlotActivity(null);
          setSlotActivityFading(false);
          setThinkingLiveLine(null);
          awaitingActivityDismissRef.current = false;
        } finally {
          setPipelineBusy(false);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[poju] Send failed:", err);
      awaitingActivityDismissRef.current = false;
      skipActivityRenderReadyRef.current = false;
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      if (errorRestore) {
        onSessionUpdate(errorRestore.rollbackSession);
        setInput(errorRestore.typed);
        if (errorRestore.attachment) setComposerAttachment(errorRestore.attachment);
      }
      const isProviderQueue =
        err instanceof Error &&
        (err.name === "OpenRouterProviderQueueError" ||
          err.message === "openrouter_provider_queue");

      if (isProviderQueue && errorRestore) {
        if (!silentRetriedRef.current) {
          silentRetriedRef.current = true;
          pendingSilentRetryRef.current = {
            rollbackSession: errorRestore.rollbackSession,
            userMessage,
            errorRestore,
          };
          return;
        }
        await persistInfraBusyTurn(errorRestore, userMessage);
        return;
      }

      await dialog.alert(
        isProviderQueue ? t("dialog_provider_queue") : t("dialog_connection_error"),
      );
    } finally {
      const pendingSilent = pendingSilentRetryRef.current;
      if (pendingSilent) {
        pendingSilentRetryRef.current = null;
        void (async () => {
          await sleep(PROVIDER_QUEUE_SILENT_RETRY_MS);
          if (sendGenerationRef.current !== gen) return;
          const withUser: POJUSessionState = {
            ...pendingSilent.rollbackSession,
            messages: [
              ...pendingSilent.rollbackSession.messages,
              buildOptimisticUserMessage(pendingSilent.userMessage),
            ],
          };
          onSessionUpdate(withUser);
          await runUserTurn(
            withUser,
            pendingSilent.userMessage,
            pendingSilent.errorRestore,
          );
        })();
      }
      turnInFlightRef.current = false;
      if (activeTurnKeyRef.current === turnKey) activeTurnKeyRef.current = null;
      if (sendAbortRef.current === ac) sendAbortRef.current = null;
      if (gen === sendGenerationRef.current) {
        setSending(false);
        if (!awaitingActivityDismissRef.current) {
          setSlotActivity(null);
          setSlotActivityFading(false);
          setThinkingLiveLine(null);
        }
      }
    }
  }

  const onInfraBusyRetry = useCallback(() => {
    const ctx = infraRetryContextRef.current;
    if (!ctx || turnInFlightRef.current || sending) return;
    silentRetriedRef.current = false;
    const withUser: POJUSessionState = {
      ...ctx.rollbackSession,
      messages: [...ctx.rollbackSession.messages, buildOptimisticUserMessage(ctx.userMessage)],
    };
    onSessionUpdate(withUser);
    void runUserTurn(withUser, ctx.userMessage, {
      rollbackSession: ctx.rollbackSession,
      typed: ctx.typed,
      attachment: ctx.attachment,
    });
  }, [sending, onSessionUpdate]);

  async function handlePreviewUnlock(via: "payment" | "code") {
    if (unlockBusy) return;
    const base = sessionRef.current;
    const profileId = base.selected_stored_profile_id?.trim();
    if (!profileId) return;

    setUnlockBusy(true);
    try {
      const pendingQ = base.pending_question?.trim();
      const unlocked: POJUSessionState = {
        ...base,
        unlock_status: "unlocked",
        unlock_via: via,
        original_question: pendingQ || base.original_question,
      };
      onSessionUpdate(unlocked);
      await savePOJUSession(unlocked);
      router.push(`/poju/session/${base.session_id}/preparing?unlock=1`);
    } catch (e) {
      console.error("[poju] preview unlock failed:", e);
      await dialog.alert(t("dialog_connection_error"));
    } finally {
      setUnlockBusy(false);
    }
  }

  async function handleQuestionBriefingDismiss() {
    const base = sessionRef.current;
    if (base.question_briefing_dismissed) return;
    const updated: POJUSessionState = { ...base, question_briefing_dismissed: true };
    onSessionUpdate(updated);
    await savePOJUSession(updated);
  }

  async function handlePojuSend(text: string) {
    if (composerLocked && !expired) return;
    if (expired) return;
    stopVoiceInput();
    const typed = text.trim();
    if ((!typed && !composerAttachment) || sending) return;
    silentRetriedRef.current = false;
    const attachNote = buildAttachmentNote(composerAttachment);
    const userMessage = typed || attachNote;
    const baseSession = sessionRef.current;

    const rejected = tryHandleRuleRejection(baseSession, userMessage, locale);
    if (rejected) {
      setInput("");
      setComposerAttachment(null);
      onSessionUpdate(rejected);
      await savePOJUSession(rejected);
      return;
    }

    const savedComposerAttachment = composerAttachment;
    setInput("");
    setComposerAttachment(null);

    if (isPreviewSession(baseSession)) {
      const messages = [...baseSession.messages];
      if (!hasPaywallMessage(baseSession)) {
        messages.push(createPaywallMessage());
      }
      const topic = topicFromFirstUserMessage(userMessage);
      const withPaywall: POJUSessionState = {
        ...baseSession,
        pending_question: userMessage,
        original_question:
          isDefaultNewSessionTitle(baseSession.original_question) && topic
            ? topic
            : baseSession.original_question,
        messages,
      };
      onSessionUpdate(withPaywall);
      await savePOJUSession(withPaywall);
      if (isDefaultNewSessionTitle(baseSession.original_question) && topic) {
        setSessionRows((prev) =>
          prev.map((x) =>
            x.session_id === baseSession.session_id ? { ...x, original_question: topic } : x,
          ),
        );
      }
      return;
    }

    const nowIso = new Date().toISOString();
    const optimisticUser: POJUMessage = {
      role: "user",
      content: userMessage,
      timestamp: nowIso,
      client_id: safeRandomUUID(),
    };
    const withUser: POJUSessionState = {
      ...baseSession,
      messages: [...baseSession.messages, optimisticUser],
    };
    onSessionUpdate(withUser);

    await runUserTurn(withUser, userMessage, {
      rollbackSession: baseSession,
      typed,
      attachment: savedComposerAttachment,
    });
  }

  async function handleRenameSession(targetSessionId: string, newTitle: string) {
    const value = newTitle.trim();
    if (!value) return;

    await getPojuDb().pojuSessionRecords.update(targetSessionId, { original_question: value });
    const state = await loadPOJUSession(targetSessionId);
    if (state) {
      state.original_question = value;
      await savePOJUSession(state);
      if (targetSessionId === sessionRef.current.session_id) {
        onSessionUpdate({ ...state });
      }
    }
    setSessionRows((prev) =>
      prev.map((x) => (x.session_id === targetSessionId ? { ...x, original_question: value } : x)),
    );
  }

  async function handleDeleteSession(targetSessionId: string) {
    await getPojuDb().pojuSessionRecords.delete(targetSessionId);
    setSessionRows((prev) => prev.filter((x) => x.session_id !== targetSessionId));
    if (targetSessionId === sessionRef.current.session_id) {
      router.push("/poju");
    }
  }

  function handleAttachImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setComposerAttachment({ name: file.name, kind: "image", dataUrl });
    };
    reader.readAsDataURL(file);
  }

  function handleAttachNamedFile(file: File, kind: "document" | "pdf") {
    setComposerAttachment({ name: file.name, kind });
  }

  function handleAttachPick(kind: "image" | "document" | "pdf") {
    if (kind === "image") fileRef.current?.click();
    else if (kind === "document") documentFileRef.current?.click();
    else pdfFileRef.current?.click();
  }

  async function handleCreateNewSession() {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/poju/payment-success` : `/${locale}/poju/payment-success`;
      const payRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: "poju", locale, return_url: returnUrl }),
      });
      const payData = (await payRes.json().catch(() => ({}))) as { order_id?: string };
      const orderId = payData.order_id ?? `mockpoju_${Date.now()}`;
      const pendingProfile = readPendingStoredProfileId();
      const newSessionId = await createPOJUSession({
        payment_id: orderId,
        original_question: DEFAULT_NEW_SESSION_TITLE,
        selected_stored_profile_id: pendingProfile,
      });
      clearPendingStoredProfileId();
      router.push(`/poju/session/${newSessionId}`);
    } catch (err) {
      console.error("[poju] create session failed", err);
      await dialog.alert(t("dialog_create_session_error"));
    } finally {
      setCreatingSession(false);
    }
  }

  async function ensureBaseAnalysisReady(profileId: string): Promise<boolean> {
    try {
      if (!(await profileHasBaseAnalysis(profileId))) {
        await generateBaseAnalysis(profileId);
      }
      const cur = sessionRef.current;
      if (cur.agent_v2) {
        const withAnalysis = {
          ...cur,
          agent_v2: { ...cur.agent_v2, has_base_analysis: true, selected_profile_id: profileId },
        };
        onSessionUpdate(withAnalysis);
        await savePOJUSession(withAnalysis);
      }
      return true;
    } catch (e) {
      console.warn("[poju] base analysis not ready:", e);
      return false;
    }
  }

  function agentPhaseKey(): string {
    const phase = session.agent_v2?.current_phase;
    if (!phase) return "agent_phase_opening";
    const map: Record<string, string> = {
      opening: "agent_phase_opening",
      greeting: "agent_phase_opening",
      awaiting_profile: "agent_phase_collecting",
      collecting_context: "agent_phase_collecting",
      awaiting_confirmation: "agent_phase_confirm",
      delivered: "agent_phase_delivered",
      tracking: "agent_phase_tracking",
    };
    return map[phase] ?? "agent_phase_collecting";
  }

  async function handleToolResponse(tool: ToolName, action: "accepted" | "declined") {
    const s = sessionRef.current;
    const next = recordUserResponse(s, tool, action);
    onSessionUpdate(next);
    await savePOJUSession(next);
  }

  async function handleActionUpdate(actionId: string, status: POJUAction["status"], feedback?: string) {
    const s = sessionRef.current;
    const action = s.actions.find((a) => a.action_id === actionId);
    const updatedActions = s.actions.map((a) =>
      a.action_id === actionId
        ? {
            ...a,
            status,
            user_feedback: feedback,
            updated_at: new Date().toISOString(),
          }
        : a,
    );
    const updatedSession: POJUSessionState = { ...s, actions: updatedActions };
    onSessionUpdate(updatedSession);
    await savePOJUSession(updatedSession);

    if (action) {
      const systemNote = buildActionUpdateSystemNote(action.text, status, feedback);
      try {
        const finalSession = await handleUserMessage({
          session: updatedSession,
          userMessage: systemNote,
          locale,
        });
        onSessionUpdate(finalSession);
        await savePOJUSession(finalSession);
      } catch (err) {
        console.error("[poju] Action follow-up failed:", err);
      }
    }
  }

  async function handleExtendSessionPayment(snooze: boolean) {
    setExpiryPaymentBusy(true);
    try {
      const ok = await redirectToPojuSessionPayment({
        action: "extend",
        sessionId: sessionRef.current.session_id,
        locale,
        snoozeReminder: snooze,
      });
      if (!ok) {
        await dialog.alert(t("dialog_payment_redirect_failed"));
        setExpiryPaymentBusy(false);
      }
    } catch {
      await dialog.alert(t("dialog_payment_redirect_failed"));
      setExpiryPaymentBusy(false);
    }
  }

  function handleExpiryDismiss({ snooze }: { snooze: boolean }) {
    if (snooze) setExpiryReminderSnoozed(sessionRef.current.session_id);
    setExpiryDialogOpen(false);
  }

  async function handleSituationAnalysis(force: boolean) {
    setSituationError(null);
    setSituationNotice(null);
    setFinalError(null);
    setSituationBusy(true);
    try {
      const out = await requestSituationAnalysis(sessionRef.current, locale, { force });
      onSessionUpdate(out.session);
      await savePOJUSession(out.session);
      setSituationNotice(out.cache_hit ? t("situation_analysis_cache_hit") : t("situation_analysis_new"));
    } catch (e) {
      setSituationError(e instanceof Error ? e.message : String(e));
    } finally {
      setSituationBusy(false);
    }
  }

  async function handleFinalDelivery() {
    setFinalError(null);
    setSituationError(null);
    setFinalBusy(true);
    try {
      let next = await runFinalDeliveryForSession(sessionRef.current, locale);
      const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
      next = await trySaveDeliveryActionsToArchive(next, locale);
      onSessionUpdate(next);
      await savePOJUSession(next);
      setSituationNotice(t("final_delivery_done"));
    } catch (e) {
      setFinalError(e instanceof Error ? e.message : String(e));
    } finally {
      setFinalBusy(false);
    }
  }

  async function handleEndSession() {
    if (!(await dialog.confirm(t("end_confirm")))) return;
    const sid = sessionRef.current.session_id;
    setEnding(true);
    try {
      await markPOJUV4SessionResolved(sid);
      router.push("/poju");
    } finally {
      setEnding(false);
    }
  }

  const newSessionLabel = t("session_list_new");

  const pojuSessions = sessionRows.map((row) => {
    const isCurrent = row.session_id === session.session_id;
    const firstUserMessage = isCurrent
      ? session.messages.find((m) => m.role === "user" && !m.is_rejected)?.content
      : undefined;
    return {
      id: row.session_id,
      title: resolveSessionListTopic(
        {
          original_question: isCurrent ? session.original_question : row.original_question,
          pending_question: isCurrent ? session.pending_question : undefined,
          first_user_message: firstUserMessage,
        },
        newSessionLabel,
      ),
      updatedAt: row.last_interaction_at.toISOString(),
      meta: formatSessionListDateTime(row.created_at, locale),
    };
  });

  const pojuMessages = useMemo(
    () =>
      visibleMessages.map((m) => ({
        id: m.client_id ?? m.timestamp,
        role: m.role as "user" | "assistant",
        content: m.content,
        editable: m.role === "user" && !m.is_rejected,
      })),
    [visibleMessages],
  );

  const { messageSlots, bareMessageSlotIds, messageFooters, messageFollowUps, messageFollowUpActionsText } =
    useMemo(() => {
    const slots: Record<string, ReactNode> = {};
    const bareIds = new Set<string>();
    const footers: Record<string, ReactNode> = {};
    const followUps: Record<string, ReactNode> = {};
    const followUpActions: Record<string, string> = {};
    let energyMatrixRendered = false;
    const lastAssistantMid = [...visibleMessages]
      .reverse()
      .find((m) => m.role === "assistant" && !m.is_rejected);
    const lastAssistantKey = lastAssistantMid
      ? (lastAssistantMid.client_id ?? lastAssistantMid.timestamp)
      : null;

    for (const m of visibleMessages) {
      const mid = m.client_id ?? m.timestamp;
      if (isEnergyMatrixMessage(m) && m.meta?.matrix_payload) {
        if (energyMatrixRendered) continue;
        energyMatrixRendered = true;
        bareIds.add(mid);
        slots[mid] = (
          <div className="poju-matrix-bubble">
            <PojuEnergyMatrix
              payload={m.meta.matrix_payload}
              locale={locale}
              compact
              suppressNarrative
            />
          </div>
        );
      }
      if (isMatrixWelcomeMessage(m)) {
        const payload = m.meta?.matrix_payload ?? session.matrix_payload;
        if (payload) {
          const actionsText = matrixNarrativeActionsText(payload, locale);
          slots[mid] = (
            <>
              <MatrixNarrativeReply payload={payload} locale={locale} />
              {actionsText ? (
                <AssistantMessageActions content={actionsText} locale={locale} />
              ) : null}
            </>
          );
        }
      }
      if (m.meta?.contains_delivery) {
        bareIds.add(mid);
        slots[mid] = (
          <MainDeliveryView
            fullText={m.content}
            actions={session.actions}
            archiveId={session.action_plan_archive_id}
          />
        );
      }
      if (m.meta?.kind === "report") {
        bareIds.add(mid);
        slots[mid] = (
          <PojuReportChatCard
            excerpt={reportPreviewForCard(getUnlockReportText(m))}
            onOpen={openUnlockReportModal}
          />
        );
      }
      if (m.meta?.suggest_refund && m.role === "assistant") {
        followUps[mid] = (
          <RefundOfferAction sessionId={session.session_id} variant="message" />
        );
      }
      if (
        (m.meta?.kind === "infra_busy" ||
          m.meta?.kind === "generation_empty" ||
          m.meta?.kind === "generation_incomplete") &&
        m.role === "assistant"
      ) {
        followUps[mid] = (
          <InfraBusyRetryAction onRetry={onInfraBusyRetry} disabled={sending} />
        );
      }
      if (m.role === "assistant" && !m.is_rejected) {
        const below: ReactNode[] = [];
        if (showStateDebug && m.meta?.llm_debug) {
          footers[mid] = (
            <LLMCallDebugPanel key="llm-debug" debug={m.meta.llm_debug} locale={locale} />
          );
        } else if (
          showStateDebug &&
          mid === lastAssistantKey &&
          !bareIds.has(mid) &&
          !m.meta?.contains_delivery &&
          (m.meta?.llm_model || m.meta?.tokens_used)
        ) {
          footers[mid] = (
            <div key="llm-debug-missing" className="poju-llm-debug poju-llm-debug--empty">
              {locale.startsWith("zh")
                ? "本轮无 LLM 调试数据（API 未返回 llm_debug）"
                : "No LLM debug data on this turn (API did not return llm_debug)"}
            </div>
          );
        }
        if (showStateDebug && m.meta?.state_snapshot) {
          below.push(
            <PojuStateDebugPanel key="state-debug" snapshot={m.meta.state_snapshot} locale={locale} />,
          );
        }
        if (m.meta?.investigation_agenda && m.meta.investigation_agenda.length > 0) {
          below.push(
            <PojuAgendaCard key="agenda" items={m.meta.investigation_agenda} locale={locale} />,
          );
        }
        if (below.length > 0) {
          followUps[mid] = followUps[mid] ? (
            <>
              {followUps[mid]}
              {below}
            </>
          ) : (
            <>{below}</>
          );
        }
      }
    }

    return {
      messageSlots: slots,
      bareMessageSlotIds: bareIds,
      messageFooters: footers,
      messageFollowUps: followUps,
      messageFollowUpActionsText: followUpActions,
    };
  }, [
    visibleMessages,
    locale,
    session.session_id,
    session.actions,
    session.action_plan_archive_id,
    openUnlockReportModal,
    getActivityLines,
    showStateDebug,
    sending,
    onInfraBusyRetry,
  ]);

  const streaming = sending;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAttachImageFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={documentFileRef}
        type="file"
        accept=".doc,.docx,.txt,.md,.rtf,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAttachNamedFile(f, "document");
          e.target.value = "";
        }}
      />
      <input
        ref={pdfFileRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAttachNamedFile(f, "pdf");
          e.target.value = "";
        }}
      />
      <div className="poju-chat-shell">
        <div className="poju-chat-shell__main">
      <PojuChat
        sessions={pojuSessions}
        currentSessionId={session.session_id}
        messages={pojuMessages}
        isStreaming={streaming}
        pendingActivityLines={pendingActivityLines}
        pendingActivityFading={slotActivityFading}
        thinkingLiveLine={thinkingLiveLine}
        thinkingLocale={locale}
        composerDisabled={composerLocked}
        messageSlots={messageSlots}
        bareMessageSlotIds={bareMessageSlotIds}
        messageFooters={messageFooters}
        messageFollowUps={messageFollowUps}
        messageFollowUpActionsText={messageFollowUpActionsText}
        paywallOverlay={
          paywallOpen ? (
            <PojuPaywallInline
              sessionId={session.session_id}
              locale={locale}
              pendingQuestion={session.pending_question ?? session.original_question}
              busy={unlockBusy}
              onUnlocked={(via) => void handlePreviewUnlock(via)}
            />
          ) : undefined
        }
        initialScrollPosition={initialScrollPosition}
        onActivityRenderReady={handleActivityRenderReady}
        inputPlaceholder={t("input_placeholder")}
        composerText={input}
        onComposerTextChange={setInput}
        composerHasAttachment={composerAttachment !== null}
        onSend={(text) => void handlePojuSend(text)}
        onNewSession={() => void handleCreateNewSession()}
        onSelectSession={(id) => router.push(`/poju/session/${id}`)}
        onRenameSession={(id, title) => void handleRenameSession(id, title)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        renameLabel={t("session_menu_rename")}
        deleteLabel={t("session_menu_delete")}
        sessionMenuLabel={t("session_menu_label")}
        sessionDialogLabels={{
          renameTitle: t("dialog_rename_placeholder"),
          renameMessage: t("dialog_rename_session"),
          deleteTitle: t("session_menu_delete"),
          deleteMessage: t("dialog_delete_session_confirm"),
          cancel: t("dialog_cancel"),
          ok: t("dialog_ok"),
        }}
        onAttachPick={handleAttachPick}
        attachMenuLabel={t("attach_menu_label")}
        attachMenuLabels={{
          document: t("attach_menu_document"),
          image: t("attach_menu_image"),
          pdf: t("attach_menu_pdf"),
        }}
        onVoice={toggleVoiceInput}
        voiceActive={voiceActive}
        voiceStartLabel={t("voice_input_start")}
        voiceStopLabel={t("voice_input_stop")}
        onStop={handleStopGeneration}
        newSessionDisabled={creatingSession}
        onEditMessage={(id, content) => void handleEditUserMessage(id, content)}
        editDisabled={streaming}
        editLabel={t("edit_message")}
        questionBriefingEnabled={questionBriefingEnabled}
        questionBriefingDismissed={Boolean(session.question_briefing_dismissed)}
        onQuestionBriefingDismiss={() => void handleQuestionBriefingDismiss()}
        onClose={() => router.push("/poju")}
        brandName={t("sidebar_brand_name")}
        brandTooltip={tBrand("navbar_tooltip")}
        sessionsLabel={t("sidebar_sessions_label")}
        newSessionLabel={t("session_picker.new_poju")}
        inlineNotice={
          showOffTopicAction ? (
            <OffTopicAction
              driftReason={driftReason}
              onStartNewSession={() => router.push("/poju")}
              onContinueCurrent={() => {
                setShowOffTopicAction(false);
                setDriftReason("");
              }}
            />
          ) : session.agent_v2 ? (
            <AgendaProgressPanel agent={session.agent_v2} locale={locale} />
          ) : null
        }
        editDialog={
          editDialog
            ? {
                title: t("edit_message_title"),
                description: t("edit_message_prompt"),
                defaultValue: editDialog.content,
                confirmLabel: "OK",
                cancelLabel: "Cancel",
                onConfirm: (value) => void confirmEditUserMessage(value),
                onCancel: () => setEditDialog(null),
              }
            : null
        }
      />
        </div>
        {process.env.NODE_ENV === "development" ? (
          <StateMachineDebugPanel ledger={debugStateLedger} />
        ) : null}
      </div>

      <SessionExpiryDialog
        sessionId={session.session_id}
        expiresAt={session.expires_at}
        open={expiryDialogOpen}
        mode={expired ? "expired" : "warning"}
        paymentBusy={expiryPaymentBusy}
        onDismiss={handleExpiryDismiss}
        onExtend={({ snooze }) => void handleExtendSessionPayment(snooze)}
      />

      {unlockReportText ? (
        <PojuUnlockReportModal
          open={unlockReportModalOpen}
          reportText={unlockReportText}
          profileId={unlockReportProfileId}
          gateMode={unlockReportGatePending}
          showMatrix={!hasPreviewMatrixMessage(session)}
          onClose={() => {
            if (unlockReportGatePending) {
              setUnlockReportModalOpen(false);
              setUnlockReportGateDismissed(true);
              return;
            }
            setUnlockReportModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function buildAttachmentNote(attachment: ComposerAttachment | null): string {
  if (!attachment) return "";
  if (attachment.kind === "image") return `[Image attached: ${attachment.name}]`;
  if (attachment.kind === "pdf") return `[PDF attached: ${attachment.name}]`;
  return `[Document attached: ${attachment.name}]`;
}

function buildActionUpdateSystemNote(actionText: string, status: string, feedback?: string): string {
  const map: Record<string, string> = {
    completed: "completed this action",
    modified: "modified the action",
    skipped: "chose not to do this action",
  };
  const verb = map[status] ?? "updated this action";
  return `[SYSTEM: User ${verb}: "${actionText}"${feedback ? `. Feedback: "${feedback}"` : ""}. Please acknowledge and continue.]`;
}

