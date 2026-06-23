"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BirthProfileFlow, type BirthProfileFlowStage } from "@/components/poju/BirthProfileFlow";
import PojuChat from "@/components/poju/PojuChat";
import { useAppDialog } from "@/components/ui/app-dialog";
import { ContextSummaryEditor } from "@/components/poju/ContextSummaryEditor";
import type { ContextSummary } from "@/lib/poju/agent-state";
import { OffTopicAction } from "@/components/poju/OffTopicAction";
import { RefundOfferAction } from "@/components/poju/RefundOfferAction";
import {
  resolveThinkingStreamMode,
  type ThinkingStreamMode,
} from "@/lib/poju/thinking-stream-mode";
import { ProfileSelector } from "@/components/profile/ProfileSelector";
import { getPojuDb } from "@/lib/db/poju-db";
import { createPOJUSession, loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId, readPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { runConfirmationPipeline, runPostTurnOrchestration } from "@/lib/poju/agent-orchestrator";
import { handleUserMessage, tryHandleRuleRejection } from "@/lib/poju/agent";
import { appendBirthFlowMessage } from "@/lib/poju/birth-flow-messages";
import {
  downgradePrematureConfirmationPhase,
  shouldShowContextSummaryForm,
} from "@/lib/poju/summary-readiness";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { AgendaProgressPanel } from "@/components/poju/AgendaProgressPanel";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import {
  clearBirthFormActionIfProfileBound,
  lastAssistantRequestsBirthForm,
  resolveSessionHasProfile,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
import { applyPhaseTransition } from "@/lib/poju/agent-state";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { importCalculatedProfileAsStored, profileHasBaseAnalysis, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
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
import type { UserProfile } from "@/lib/profile/types";
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
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { PojuPaywallInline } from "@/components/poju/PojuPaywallInline";
import { MainDeliveryView } from "@/components/poju/MainDeliveryView";
import { PojuReportChatCard } from "@/components/poju/PojuReportChatCard";
import { PojuUnlockReportModal } from "@/components/poju/PojuUnlockReportModal";
import { hasUnlockReportMessage, prepareUnlockReleaseSession } from "@/lib/poju/finalize-unlock-bazi-session";
import { sessionMatrixReadyForChat } from "@/lib/poju/matrix-narrative-ready";
import { markMatrixNarrativeFailed } from "@/lib/poju/apply-matrix-narrative";
import { refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  applyMatrixPreviewToPayload,
  applyStoredMatrixPreview,
  ensureProfileMatrixList,
} from "@/lib/poju/resolve-matrix-preview";
import { getOnboardingCopy } from "@/lib/poju/onboarding-templates";
import { getStoredProfile, storedMatrixListPresent } from "@/lib/profile/stored-profiles-service";
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
import {
  createEnergyMatrixMessage,
  createPaywallMessage,
  hasPaywallMessage,
  hasPreviewMatrixMessage,
  isPreviewSession,
  POJU_RELEASE_PENDING_QUESTION_FLAG,
} from "@/lib/poju/preview-unlock";

/** Internal pipeline / phase UI — development only. */
const POJU_DEV_DEBUG = process.env.NODE_ENV === "development";
import "@/styles/topic-drift.css";
import "@/styles/poju-energy-matrix.css";
import { redirectToPojuSessionPayment } from "@/lib/poju/start-poju-session-payment";

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

export function POJUChatUI({ session, onSessionUpdate, locale }: Props) {
  const t = useTranslations("poju.chat");
  const tBrand = useTranslations("poju.branding");
  const dialog = useAppDialog();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [birthFlowStage, setBirthFlowStage] = useState<BirthProfileFlowStage | null>(null);
  const [birthAnalysisFailed, setBirthAnalysisFailed] = useState(false);
  const summaryIntroAppendedRef = useRef(false);
  const [summaryFormDismissed, setSummaryFormDismissed] = useState(false);
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
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<ThinkingStreamMode | null>(null);
  const [liveThinkingLine, setLiveThinkingLine] = useState<string | null>(null);
  const [replyStreaming, setReplyStreaming] = useState(false);
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
  const previewMatrixInitRef = useRef<string | null>(null);
  const matrixNarrativeRef = useRef<string | null>(null);
  const releasePendingInitRef = useRef<string | null>(null);
  const toolResumeInitRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const documentFileRef = useRef<HTMLInputElement | null>(null);
  const pdfFileRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sendAbortRef = useRef<AbortController | null>(null);
  const sendGenerationRef = useRef(0);
  const router = useRouter();
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

  const scrollChatToBottom = useCallback((_behavior: ScrollBehavior = "smooth") => {
    /* PojuChat scrolls internally */
  }, []);

  const visibleMessages = session.messages.filter(
    (m) =>
      m.role !== "system" &&
      !m.content.trim().startsWith("[SYSTEM:") &&
      m.meta?.kind !== "paywall",
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
  const composerLocked = expired || previewComposerBlocked || unlockBusy || unlockReportGateBlocking;
  const birthFlowBlocking = birthFlowStage === "form" || birthFlowStage === "received" || birthFlowStage === "analyzing";
  const showSummaryForm =
    shouldShowContextSummaryForm(session) && !summaryFormDismissed && !session.main_delivery_done;
  const overlayFormOpen = birthFlowBlocking || showProfilePicker || showSummaryForm;

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
    setSummaryFormDismissed(false);
    summaryIntroAppendedRef.current = false;
  }, [session.session_id]);

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
    if (resolveSessionHasProfile(session)) {
      setBirthFlowStage(null);
      return;
    }
    if (sending || birthFlowStage === "received" || birthFlowStage === "analyzing" || birthFlowStage === "complete") {
      return;
    }

    if (lastAssistantRequestsBirthForm(session)) {
      setBirthFlowStage((prev) => (prev === "received" || prev === "analyzing" ? prev : "form"));
    } else if (birthFlowStage === "form" || birthFlowStage === "intro") {
      setBirthFlowStage(null);
    }
  }, [session, sending, birthFlowStage]);

  useEffect(() => {
    const downgraded = downgradePrematureConfirmationPhase(session);
    if (downgraded !== session) {
      summaryIntroAppendedRef.current = false;
      onSessionUpdate(downgraded);
      void savePOJUSession(downgraded);
      return;
    }

    if (!shouldShowContextSummaryForm(session)) {
      summaryIntroAppendedRef.current = false;
      return;
    }

    summaryIntroAppendedRef.current = true;
    scrollChatToBottom("smooth");
  }, [session, scrollChatToBottom]);

  useEffect(() => {
    if (openingInitRef.current) return;
    if (!resolveSessionHasProfile(session)) return;
    if (isPreviewSession(session)) return;
    if (normalizeAgentPhase(session.agent_v2?.current_phase) !== "opening") return;
    if (visibleMessages.length > 0) return;
    if (sending || confirmBusy || pipelineBusy) return;

    openingInitRef.current = true;
    void triggerOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per empty opening session
  }, [session.session_id, session.agent_v2?.current_phase, visibleMessages.length]);

  useEffect(() => {
    if (previewMatrixInitRef.current === session.session_id) return;
    if (!isPreviewSession(session)) return;
    if (!resolveSessionHasProfile(session)) return;
    if (sessionMatrixReadyForChat(session)) return;
    if (hasPreviewMatrixMessage(session)) return;
    if (!session.matrix_payload) return;

    previewMatrixInitRef.current = session.session_id;
    const withMatrix: POJUSessionState = {
      ...session,
      messages: [...session.messages, createEnergyMatrixMessage(session.matrix_payload, locale)],
    };
    onSessionUpdate(withMatrix);
    void savePOJUSession(withMatrix);
  }, [
    session,
    session.session_id,
    session.matrix_payload,
    locale,
    onSessionUpdate,
  ]);

  const matrixMessageReady = hasPreviewMatrixMessage(session);

  useEffect(() => {
    if (!isPreviewSession(session)) return;
    if (sessionMatrixReadyForChat(session)) return;
    if (!matrixMessageReady) return;

    const matrixIdx = sessionRef.current.messages.findIndex((m) => m.meta?.kind === "energy_matrix");
    if (matrixIdx < 0) return;

    const matrixMsg = sessionRef.current.messages[matrixIdx];
    const payload = matrixMsg?.meta?.matrix_payload;
    if (!payload?.display) return;
    if (payload.display.narrative_source === "llm" && payload.display.narrative_locale === locale) return;
    if (payload.display.narrative_failed === true) return;

    const fetchKey = `${session.session_id}:${locale}`;
    if (matrixNarrativeRef.current === fetchKey) return;
    matrixNarrativeRef.current = fetchKey;

    const ac = new AbortController();
    void (async () => {
      try {
        const refreshed = refreshMatrixPayload(payload, locale);
        const profileId = sessionRef.current.selected_stored_profile_id;
        let updatedPayload = refreshed;

        const storedRow = profileId ? await getStoredProfile(profileId) : null;
        if (storedMatrixListPresent(storedRow)) {
          updatedPayload = applyStoredMatrixPreview(
            refreshed,
            storedRow!.matrix_list!,
            "poju",
            locale,
          );
        } else if (profileId && refreshed.user_profile) {
          const ensured = await ensureProfileMatrixList({
            profileId,
            userProfile: refreshed.user_profile,
            locale,
            signal: ac.signal,
          });
          if (ac.signal.aborted) return;
          updatedPayload = applyMatrixPreviewToPayload(refreshed, ensured, "poju", locale);
        } else {
          return;
        }

        const current = sessionRef.current;
        const msgIdx = current.messages.findIndex((m) => m.meta?.kind === "energy_matrix");
        if (msgIdx < 0) return;

        const messages = [...current.messages];
        messages[msgIdx] = {
          ...messages[msgIdx]!,
          meta: { ...messages[msgIdx]!.meta, matrix_payload: updatedPayload },
        };
        const next: POJUSessionState = {
          ...current,
          messages,
          matrix_payload: updatedPayload,
        };
        onSessionUpdate(next);
        await savePOJUSession(next);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.warn("[poju] matrix preview resolve failed:", e);
        matrixNarrativeRef.current = null;

        const current = sessionRef.current;
        const msgIdx = current.messages.findIndex((m) => m.meta?.kind === "energy_matrix");
        if (msgIdx < 0) return;
        const basePayload = current.messages[msgIdx]?.meta?.matrix_payload ?? payload;
        const failedPayload = markMatrixNarrativeFailed(basePayload);
        const display = failedPayload.display;
        const withPrompt =
          display != null
            ? {
                ...failedPayload,
                display: {
                  ...display,
                  synopsis: {
                    ...display.synopsis,
                    prompt: getOnboardingCopy("poju", locale),
                  },
                },
              }
            : failedPayload;
        const messages = [...current.messages];
        messages[msgIdx] = {
          ...messages[msgIdx]!,
          meta: { ...messages[msgIdx]!.meta, matrix_payload: withPrompt },
        };
        onSessionUpdate({ ...current, messages, matrix_payload: withPrompt });
        await savePOJUSession({ ...current, messages, matrix_payload: withPrompt });
      }
    })();

    return () => ac.abort();
  }, [session.session_id, locale, matrixMessageReady, onSessionUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (releasePendingInitRef.current === session.session_id) return;
    const flag = sessionStorage.getItem(POJU_RELEASE_PENDING_QUESTION_FLAG);
    if (flag !== session.session_id) return;
    if (sending || confirmBusy || pipelineBusy) return;
    if (!hasUnlockReportMessage(session)) return;
    if (!unlockReportGateDismissed) return;

    const pending = session.pending_question?.trim() || session.original_question?.trim();
    if (!pending) return;

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
    confirmBusy,
    pipelineBusy,
    unlockReportGateDismissed,
    onSessionUpdate,
  ]);

  useEffect(() => {
    if (toolResumeInitRef.current === session.session_id) return;
    if (!hasUserMessage) return;
    if (sending || confirmBusy || pipelineBusy) return;
    if (!findPendingToolInjection(session)) return;

    toolResumeInitRef.current = session.session_id;
    const resumeMsg = locale.startsWith("zh")
      ? "我从工具回来了，我们继续聊。"
      : "I'm back from the tool — let's continue.";
    void runUserTurn(sessionRef.current, resumeMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session when tool result pending
  }, [session.session_id, hasUserMessage, sending, confirmBusy, pipelineBusy, locale]);

  useEffect(() => {
    if (!overlayFormOpen) return;
  }, [overlayFormOpen]);


  function handleStopGeneration() {
    sendGenerationRef.current += 1;
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    setSending(false);
    setThinkingMode(null);
    setLiveThinkingLine(null);
    setReplyStreaming(false);
    setGenerationStopped(true);
  }

  async function handleEditUserMessage(messageId: string, currentContent: string) {
    if (sending || confirmBusy || pipelineBusy) return;
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
    setSummaryFormDismissed(false);
    summaryIntroAppendedRef.current = false;
    setBirthFlowStage(null);
    setShowProfilePicker(false);

    if (rejected) return;

    await runUserTurn(rewound, newContent);
  }

  async function triggerOpening() {
    const gen = ++sendGenerationRef.current;
    const ac = new AbortController();
    sendAbortRef.current = ac;
    setSending(true);
    setThinkingMode("flash");
    setLiveThinkingLine(null);
    setReplyStreaming(false);
    setGenerationStopped(false);

    try {
      let updated = await handleUserMessage({
        session: sessionRef.current,
        userMessage: "__OPENING__",
        locale,
        signal: ac.signal,
        onStream: {
          onReasoning: (text) => setLiveThinkingLine(text),
          onContentStreamStart: () => {
            setReplyStreaming(true);
            setLiveThinkingLine(null);
            scrollChatToBottom("auto");
          },
        },
      });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      const orch = await runPostTurnOrchestration(updated, { locale });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      onSessionUpdate(orch.session);
      setReplyStreaming(false);
      await savePOJUSession(orch.session);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[poju] Opening failed:", err);
    } finally {
      if (sendAbortRef.current === ac) sendAbortRef.current = null;
      if (gen === sendGenerationRef.current) {
        setSending(false);
        setThinkingMode(null);
        setLiveThinkingLine(null);
        setReplyStreaming(false);
      }
    }
  }

  async function runUserTurn(
    baseSession: POJUSessionState,
    userMessage: string,
    errorRestore?: { rollbackSession: POJUSessionState; typed: string; attachment: ComposerAttachment | null },
  ) {
    const gen = ++sendGenerationRef.current;
    const ac = new AbortController();
    sendAbortRef.current = ac;
    setSending(true);
    setThinkingMode(resolveThinkingStreamMode(baseSession, userMessage));
    setLiveThinkingLine(null);
    setReplyStreaming(false);
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
        onStream: {
          onReasoning: (text) => setLiveThinkingLine(text),
          onContentStreamStart: () => {
            setReplyStreaming(true);
            setLiveThinkingLine(null);
            scrollChatToBottom("auto");
          },
        },
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

      const orch = await runPostTurnOrchestration(toPersist, {
        locale,
        lastUserMessage: userMessage,
      });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      let finalSession = orch.session;
      if (finalSession.main_delivery_done && !finalSession.action_plan_archive_id) {
        const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
        finalSession = await trySaveDeliveryActionsToArchive(finalSession, locale);
      }

      onSessionUpdate(finalSession);
      setReplyStreaming(false);
      await savePOJUSession(finalSession);

      const lastAssistant = [...finalSession.messages]
        .reverse()
        .find((m) => m.role === "assistant" && !m.is_rejected);
      if (lastAssistant?.meta?.should_show_new_session_button) {
        setShowOffTopicAction(true);
        setDriftReason(lastAssistant.meta.drift_reason ?? "");
      } else {
        setShowOffTopicAction(false);
        setDriftReason("");
      }

      if (!resolveSessionHasProfile(finalSession)) {
        if (orch.ui.showBirthForm) setBirthFlowStage("form");
        if (orch.ui.showProfilePicker) setShowProfilePicker(true);
      }
      if (orch.ui.pipelineNotice) setSituationNotice(orch.ui.pipelineNotice);
      if (orch.ui.pipelineError) setSituationError(orch.ui.pipelineError);
      setPipelineBusy(orch.ui.pipelineBusy);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[poju] Send failed:", err);
      if (errorRestore) {
        onSessionUpdate(errorRestore.rollbackSession);
        setInput(errorRestore.typed);
        if (errorRestore.attachment) setComposerAttachment(errorRestore.attachment);
      }
      await dialog.alert(t("dialog_connection_error"));
    } finally {
      if (sendAbortRef.current === ac) sendAbortRef.current = null;
      if (gen === sendGenerationRef.current) {
        setSending(false);
        setThinkingMode(null);
        setLiveThinkingLine(null);
        setReplyStreaming(false);
      }
    }
  }

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

  async function handlePojuSend(text: string) {
    if (composerLocked && !expired) return;
    if (expired) return;
    stopVoiceInput();
    const typed = text.trim();
    if ((!typed && !composerAttachment) || sending) return;
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

  async function handleProfileSubmitted(profile: UserProfile) {
    const s = sessionRef.current;
    setShowProfilePicker(false);
    setBirthAnalysisFailed(false);
    setBirthFlowStage("received");

    let profile_id: string;
    let updatedSession: POJUSessionState;
    try {
      ({ profile_id } = await importCalculatedProfileAsStored({ profile }));
      await recordProfileUsage(profile_id, "poju");

      updatedSession = withSessionProfileFlags(
        {
          ...s,
          profile_skipped: false,
          birth_submitted_in_session: true,
          selected_stored_profile_id: profile_id,
          messages: [
            ...s.messages,
            {
              role: "system",
              content: "[Birth info collected. Profile generated.]",
              timestamp: new Date().toISOString(),
            },
          ],
        },
        { birth_submitted_in_session: true, selected_stored_profile_id: profile_id },
      );

      if (updatedSession.agent_v2) {
        const agentPhase = normalizeAgentPhase(updatedSession.agent_v2.current_phase);
        const transitioned =
          agentPhase === "opening" || agentPhase === "collecting_context"
            ? applyPhaseTransition(updatedSession.agent_v2, {
                should_transition: true,
                new_phase: "collecting_context",
                reason: "Birth profile bound to session",
              })
            : updatedSession.agent_v2;
        updatedSession = {
          ...updatedSession,
          agent_v2: {
            ...transitioned,
            selected_profile_id: profile_id,
            profile_skipped: false,
          },
        };
      }

      updatedSession = appendBirthFlowMessage(updatedSession, locale, "received");
      onSessionUpdate(updatedSession);
      await savePOJUSession(updatedSession);
    } catch (e) {
      console.error("[poju] Profile local save failed:", e);
      setBirthFlowStage("form");
      await dialog.alert(t("profile_save_failed"));
      return;
    }

    setBirthFlowStage("analyzing");
    setThinkingMode("analyzing");
    onSessionUpdate(updatedSession);
    await savePOJUSession(updatedSession);
    scrollChatToBottom("smooth");

    let analysisFailed = false;
    try {
      await generateBaseAnalysis(profile_id);
      const cur = sessionRef.current;
      if (cur.agent_v2) {
        const withAnalysis = {
          ...cur,
          agent_v2: { ...cur.agent_v2, has_base_analysis: true, selected_profile_id: profile_id },
        };
        onSessionUpdate(withAnalysis);
        await savePOJUSession(withAnalysis);
      }
    } catch (err) {
      console.warn("[poju] base analysis after birth submit:", err);
      analysisFailed = true;
      setBirthAnalysisFailed(true);
    }

    const doneKey = analysisFailed ? "analysis_failed" : "analysis_done";
    const doneSession = clearBirthFormActionIfProfileBound(
      appendBirthFlowMessage(sessionRef.current, locale, doneKey),
    );
    onSessionUpdate(doneSession);
    await savePOJUSession(doneSession);
    setBirthFlowStage("complete");
    scrollChatToBottom("smooth");

    window.setTimeout(() => {
      setBirthFlowStage(null);
      setThinkingMode(null);
    }, 2400);

    try {
      let finalSession = await handleUserMessage({
        session: doneSession,
        userMessage: "[SYSTEM: Birth info just collected. Please acknowledge and continue collecting context.]",
        locale,
      });
      finalSession = clearBirthFormActionIfProfileBound(finalSession);
      const orch = await runPostTurnOrchestration(finalSession, { locale });
      const next = clearBirthFormActionIfProfileBound(orch.session);
      onSessionUpdate(next);
      await savePOJUSession(next);
    } catch (e) {
      console.error("[poju] Profile saved but follow-up chat failed:", e);
      await dialog.alert(t("profile_saved_chat_failed"));
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

  async function handleStoredProfileSelected(profileId: string) {
    setShowProfilePicker(false);
    setBirthFlowStage(null);
    const s = sessionRef.current;
    await recordProfileUsage(profileId, "poju");
    let updatedSession = withSessionProfileFlags(
      {
        ...s,
        profile_skipped: false,
        selected_stored_profile_id: profileId,
        messages: [
          ...s.messages,
          {
            role: "system",
            content: "[Stored birth profile linked to this session.]",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      { selected_stored_profile_id: profileId },
    );
    if (updatedSession.agent_v2) {
      const transitioned =
        normalizeAgentPhase(updatedSession.agent_v2.current_phase) === "opening"
          ? applyPhaseTransition(updatedSession.agent_v2, {
              should_transition: true,
              new_phase: "collecting_context",
              reason: "Stored profile linked",
            })
          : updatedSession.agent_v2;
      updatedSession = {
        ...updatedSession,
        agent_v2: { ...transitioned, selected_profile_id: profileId, profile_skipped: false },
      };
    }
    onSessionUpdate(updatedSession);
    await savePOJUSession(updatedSession);

    const analysisReady = await ensureBaseAnalysisReady(profileId);
    if (!analysisReady) {
      await dialog.alert(
        locale.startsWith("zh")
          ? "命主基础分析尚未准备好，请稍后再试。"
          : "Base chart analysis is not ready yet. Please try again in a moment.",
      );
      return;
    }

    let finalSession = await handleUserMessage({
      session: updatedSession,
      userMessage: "[SYSTEM: User linked a saved birth profile. Acknowledge and continue collecting context.]",
      locale,
    });
    finalSession = clearBirthFormActionIfProfileBound(finalSession);
    const orch = await runPostTurnOrchestration(finalSession, { locale });
    const next = clearBirthFormActionIfProfileBound(orch.session);
    onSessionUpdate(next);
    await savePOJUSession(next);
  }

  async function handleConfirmSummary(editedSummary: ContextSummary) {
    setConfirmBusy(true);
    setSummaryFormDismissed(true);
    setFinalError(null);
    setSituationError(null);
    setSending(true);
    setThinkingMode("preparing_delivery");
    scrollChatToBottom("smooth");

    try {
      const base = sessionRef.current;
      const withSummary: POJUSessionState = base.agent_v2
        ? { ...base, agent_v2: { ...base.agent_v2, current_summary: editedSummary } }
        : base;

      onSessionUpdate(withSummary);
      await savePOJUSession(withSummary);

      let next = await runConfirmationPipeline(withSummary, locale);
      const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
      next = await trySaveDeliveryActionsToArchive(next, locale);

      onSessionUpdate(next);
      await savePOJUSession(next);
      setSituationNotice(t("final_delivery_done"));
    } catch (e) {
      setFinalError(e instanceof Error ? e.message : String(e));
      setSummaryFormDismissed(false);
    } finally {
      setConfirmBusy(false);
      setSending(false);
      setThinkingMode(null);
    }
  }

  async function handleSummaryAddMore(note: string) {
    setSummaryFormDismissed(true);
    summaryIntroAppendedRef.current = false;
    const s = sessionRef.current;
    const updated: POJUSessionState = {
      ...s,
      messages: [
        ...s.messages,
        { role: "user", content: `[Additional context for summary] ${note}`, timestamp: new Date().toISOString() },
      ],
    };
    onSessionUpdate(updated);
    await savePOJUSession(updated);
    const finalSession = await handleUserMessage({
      session: updated,
      userMessage: note,
      locale,
      userAlreadyAppended: true,
    });
    const orch = await runPostTurnOrchestration(finalSession, { locale, lastUserMessage: note });
    onSessionUpdate(orch.session);
    await savePOJUSession(orch.session);
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

  const pojuMessages = visibleMessages.map((m) => ({
    id: m.timestamp,
    role: m.role as "user" | "assistant",
    content: m.content,
    editable: m.role === "user" && !m.is_rejected,
  }));

  const { messageSlots, bareMessageSlotIds, messageFollowUps, messageFollowUpActionsText } =
    useMemo(() => {
    const slots: Record<string, ReactNode> = {};
    const bareIds = new Set<string>();
    const followUps: Record<string, ReactNode> = {};
    const followUpActions: Record<string, string> = {};

    for (const m of visibleMessages) {
      if (m.meta?.kind === "energy_matrix" && m.meta.matrix_payload) {
        bareIds.add(m.timestamp);
        slots[m.timestamp] = (
          <PojuEnergyMatrix payload={m.meta.matrix_payload} locale={locale} compact />
        );
        followUps[m.timestamp] = (
          <MatrixNarrativeReply payload={m.meta.matrix_payload} locale={locale} />
        );
        const actionsText = matrixNarrativeActionsText(m.meta.matrix_payload, locale);
        if (actionsText) followUpActions[m.timestamp] = actionsText;
      }
      if (m.meta?.contains_delivery) {
        bareIds.add(m.timestamp);
        slots[m.timestamp] = (
          <MainDeliveryView
            fullText={m.content}
            actions={session.actions}
            archiveId={session.action_plan_archive_id}
          />
        );
      }
      if (m.meta?.kind === "report") {
        bareIds.add(m.timestamp);
        slots[m.timestamp] = (
          <PojuReportChatCard
            excerpt={reportPreviewForCard(getUnlockReportText(m))}
            onOpen={openUnlockReportModal}
          />
        );
      }
      if (m.meta?.suggest_refund && m.role === "assistant") {
        followUps[m.timestamp] = (
          <RefundOfferAction sessionId={session.session_id} variant="message" />
        );
      }
    }
    return {
      messageSlots: slots,
      bareMessageSlotIds: bareIds,
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
    session.session_id,
  ]);

  const streaming = sending || confirmBusy;

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
      <PojuChat
        sessions={pojuSessions}
        currentSessionId={session.session_id}
        messages={pojuMessages}
        isStreaming={streaming}
        replyStreaming={replyStreaming}
        replyingLabel={t("replying_wait")}
        composerDisabled={composerLocked}
        messageSlots={messageSlots}
        bareMessageSlotIds={bareMessageSlotIds}
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
        thinkingMode={streaming ? thinkingMode : null}
        thinkingLocale={locale}
        liveThinkingLine={liveThinkingLine}
        thinkingWaitLabel={t("thinking_wait")}
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

      {overlayFormOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.65)",
            overflowY: "auto",
          }}
        >
          {showProfilePicker ? (
            <div className="w-full max-w-lg rounded-2xl border border-violet-300/20 bg-violet-950/95 p-3">
              <p className="text-sm font-medium text-on-surface">{t("profile_picker_in_chat_title")}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{t("profile_picker_in_chat_hint")}</p>
              <div className="mt-3">
                <ProfileSelector
                  product="poju"
                  onSelected={(id) => void handleStoredProfileSelected(id)}
                  onCancel={() => setShowProfilePicker(false)}
                />
              </div>
            </div>
          ) : null}

          {showSummaryForm && session.agent_v2?.current_summary ? (
            <ContextSummaryEditor
              summary={session.agent_v2.current_summary}
              busy={confirmBusy}
              onConfirm={(edited) => void handleConfirmSummary(edited)}
              onAddMore={(note) => void handleSummaryAddMore(note)}
            />
          ) : null}

          {birthFlowStage ? (
            <div className="w-full max-w-lg rounded-2xl border border-violet-300/20 bg-violet-950/95 p-3">
              <BirthProfileFlow
                stage={birthFlowStage}
                analysisFailed={birthAnalysisFailed}
                onContinueToForm={() => setBirthFlowStage("form")}
                onComplete={(p) => void handleProfileSubmitted(p)}
              />
            </div>
          ) : null}
        </div>
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

