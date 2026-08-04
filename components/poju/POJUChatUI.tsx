"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import PojuChat from "@/components/poju/PojuChat";
import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { unlockWithPass } from "@/lib/passes/unlock-with-pass";
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
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";
import { clearPendingStoredProfileId, readPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { runDegradedDeliveryPipeline } from "@/lib/poju/agent-orchestrator";
import { handleUserMessage, tryHandleRuleRejection } from "@/lib/poju/phase-router";
import { applyUnderstandingGateSupplement, handleRetryOpeningUnderstanding } from "@/lib/poju/phases/opening/control";
import {
  applySegment2PollSuccess,
  createSegment2AgendaJob,
  finalizeSegment2AgendaBridgeFailure,
  finalizeSegment2AgendaBridgeSuccess,
  finalizeSegment2JobFailure,
  startSegment2AfterGateConfirm,
  startSegment2AgendaRegenerate,
  startSegment2Regenerate,
  segment2AgendaPreparingHint,
  segment2RegenerateButtonLabel,
  SHOW_SEGMENT2_TEST_REGENERATE,
  SEGMENT2_INPUT_LOCK_HARD_MS,
} from "@/lib/poju/phases/segment2";
import {
  understandingGateConfirmButtonLabel,
  understandingGateSupplementButtonLabel,
} from "@/lib/poju/understanding-gate-reply";
import {
  dedupeWelcomeMessages,
  hasFixedWelcomeMessage,
  hasMatrixWelcomeMessage,
  isMatrixWelcomeMessage,
  seedFixedWelcomeMessages,
  seedMatrixWelcomeMessage,
} from "@/lib/poju/chat-bootstrap";
import { AgendaProgressPanel } from "@/components/poju/AgendaProgressPanel";
import { RegenerateAnalysisAction } from "@/components/poju/RegenerateAnalysisAction";
import { RegenerateQuestionAction } from "@/components/poju/RegenerateQuestionAction";
import { RegenerateDeliveryAction } from "@/components/poju/RegenerateDeliveryAction";
import {
  applyDeliveryConfirmationSupplement,
  canStartDeliveryRegenerate,
  startDeliveryAfterGateConfirm,
  startDeliveryRegenerate,
} from "@/lib/poju/phases/delivery/control";
import {
  deliveryConfirmButtonLabel,
  deliverySupplementButtonLabel,
} from "@/lib/poju/delivery-confirm-reply";
import { RegenerateOpeningAction } from "@/components/poju/RegenerateOpeningAction";
import { Segment2AnalysisPreparing } from "@/components/poju/Segment2AnalysisPreparing";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { InfraBusyRetryAction } from "@/components/poju/InfraBusyRetryAction";
import { getPojuServiceBusyMessage, isPojuFailurePlaceholderMessage } from "@/lib/llm/poju-service-busy-message";
import {
  acceptForAttachKind,
  attachmentClientErrorMessage,
  fileToComposerAttachment,
  isLikelyMobileClient,
  type ComposerAttachmentLocal,
} from "@/lib/poju/attachments/client";
import type { PojuChatAttachment } from "@/lib/poju/attachments/types";
import { waitForLayer1 } from "@/lib/profile/stored-profiles-service";
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
import { consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, requestSituationAnalysis } from "@/lib/llm/deepseek/situation-analysis";
import {
  continueInterruptedFinalDeliveryForSession,
  isFinalDeliveryInterruptedError,
  resumeFinalDeliveryJobForSession,
  runFinalDeliveryForSession,
} from "@/lib/llm/pro/final-delivery";
import { rewindSessionToUserMessage } from "@/lib/poju/session-rewind";
import { useSpeechInput } from "@/lib/poju/use-speech-input";
import { SessionExpiryDialog } from "@/components/poju/SessionExpiryDialog";
import {
  isSessionExpired,
  setExpiryReminderSnoozed,
  shouldShowExpiryWarning,
} from "@/lib/poju/expiry-reminder";
import { MatrixNarrativeReply } from "@/components/poju/MatrixNarrativeReply";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { PojuPaywallInline } from "@/components/poju/PojuPaywallInline";
import { DeliveryShelfView } from "@/components/poju/DeliveryShelfView";
import { PojuReportChatCard } from "@/components/poju/PojuReportChatCard";
import { PojuStateDebugPanel } from "@/components/poju/PojuStateDebugPanel";
import { LLMCallDebugPanel } from "@/components/poju/LLMCallDebugPanel";
import { StateMachineDebugPanel } from "@/components/poju/StateMachineDebugPanel";
import { buildDevStateLedger } from "@/lib/poju/dev-state-ledger";
import { useLlmDebugEnabled } from "@/lib/poju/use-llm-debug-enabled";
import { PojuAgendaCard } from "@/components/poju/PojuAgendaCard";
import { PojuUnlockReportModal } from "@/components/poju/PojuUnlockReportModal";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
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
  /**
   * `workspace-opening` — avatar welcome + original PojuChat composer only
   * (no chat shell / sidebar / debug panel).
   */
  layout?: "full" | "workspace-opening";
}

type SessionListRow = {
  session_id: string;
  original_question: string;
  status: "active" | "paused" | "resolved" | "archived";
  created_at: Date;
  last_interaction_at: Date;
};

type ComposerAttachment = ComposerAttachmentLocal;

type TurnErrorRestore = {
  rollbackSession: POJUSessionState;
  typed: string;
  attachment: ComposerAttachment | null;
};

const PROVIDER_QUEUE_SILENT_RETRY_MS = 5000;
/** Silent auto-retries before showing the user-facing infra retry button. */
const MAX_SILENT_INFRA_RETRIES = 3;

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

export function POJUChatUI({ session, onSessionUpdate, locale, layout = "full" }: Props) {
  const t = useTranslations("poju.chat");
  const tActivity = useTranslations("poju.activity");
  const tBrand = useTranslations("poju.branding");
  const dialog = useAppDialog();
  const workspacePrepare = useWorkspacePojuPrepareOptional();
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
  /** Progressive delivery markdown from segment:ready (overwritten by full_text on complete). */
  const [streamedDeliveryMarkdown, setStreamedDeliveryMarkdown] = useState<string | null>(null);
  /** Phase-4 ritual: center shelf wait → progressive papers. */
  const [deliveryRitual, setDeliveryRitual] = useState<"idle" | "shelf">("idle");
  const [deliveryWaitingNext, setDeliveryWaitingNext] = useState(false);
  /** Soft pause — keep streamed markdown; user Continue resumes same job. */
  const [deliveryInterruptedJobId, setDeliveryInterruptedJobId] = useState<string | null>(null);
  const [deliveryContinueBusy, setDeliveryContinueBusy] = useState(false);
  /** Client status-poll blip — server job may still be running. */
  const [deliveryNetworkIssue, setDeliveryNetworkIssue] = useState(false);

  const shelfActive =
    deliveryRitual === "shelf" ||
    Boolean(streamedDeliveryMarkdown?.trim()) ||
    Boolean(deliveryInterruptedJobId) ||
    Boolean(session.pending_delivery_job_id?.trim()) ||
    Boolean(session.main_delivery_done);

  /** Center is the delivery book page — chat transcript is hidden. */
  const deliveryPageActive = shelfActive;

  const deliveryFullText = useMemo(() => {
    const streamed = streamedDeliveryMarkdown?.trim() || "";
    if (streamed) return streamed;
    const fromMain = session.main_delivery?.full_text?.trim() || "";
    if (fromMain) return fromMain;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.meta?.contains_delivery && m.content?.trim()) {
        return m.content.trim();
      }
    }
    return "";
  }, [streamedDeliveryMarkdown, session.main_delivery?.full_text, session.messages]);

  /** Session switch: enter delivery page if this session already has a book; else restore chat. */
  useEffect(() => {
    setStreamedDeliveryMarkdown(null);
    setDeliveryInterruptedJobId(null);
    setDeliveryNetworkIssue(false);
    setDeliveryWaitingNext(false);
    if (session.main_delivery_done || session.pending_delivery_job_id?.trim()) {
      setDeliveryRitual("shelf");
    } else {
      setDeliveryRitual("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on session switch
  }, [session.session_id]);

  useEffect(() => {
    if (!shelfActive) return;
    const onOffline = () => setDeliveryNetworkIssue(true);
    const onOnline = () => setDeliveryNetworkIssue(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setDeliveryNetworkIssue(true);
    }
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [shelfActive]);

  const onDeliveryNetworkIssue = useCallback((offline: boolean) => {
    setDeliveryNetworkIssue(offline);
  }, []);

  const [segment2JobId, setSegment2JobId] = useState<string | null>(null);
  /** report = Call A; agenda = Call B. */
  const [segment2Stage, setSegment2Stage] = useState<"report" | "agenda" | null>(null);
  /** Stays true from A start until B success/fail or hard timer — never permanently lock. */
  const [segment2PipelineLock, setSegment2PipelineLock] = useState(false);
  const segment2LockTimerRef = useRef<number | null>(null);
  const [debugStateLedger, setDebugStateLedger] = useState<unknown>(null);
  const [generationStopped, setGenerationStopped] = useState(false);
  const [showOffTopicAction, setShowOffTopicAction] = useState(false);
  const [driftReason, setDriftReason] = useState("");
  const [editDialog, setEditDialog] = useState<{ messageId: string; content: string } | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [passBuyOpen, setPassBuyOpen] = useState(false);
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

  /** Resume / reconcile Phase 4 delivery after leave/reopen — hydrate KV into local session. */
  const deliveryResumeRef = useRef<string | null>(null);
  useEffect(() => {
    const sid = session.session_id;
    const pendingId = session.pending_delivery_job_id?.trim() || "";
    const hasDelivery =
      session.main_delivery_done ||
      session.messages.some((m) => m.meta?.contains_delivery);
    const phaseDelivered = session.agent_v2?.current_phase === "delivered";
    // Always check KV when pending, when phase is delivered, or when a book is already shown
    // (regenerate may finish after the tab closed with the old book still in IndexedDB).
    const shouldCheck = Boolean(pendingId) || hasDelivery || phaseDelivered;
    if (!shouldCheck) return;

    const resumeKey = `${sid}:${pendingId || "reconcile"}`;
    if (deliveryResumeRef.current === resumeKey) return;
    deliveryResumeRef.current = resumeKey;

    const showBusy = Boolean(pendingId) || !hasDelivery;
    let cancelled = false;
    void (async () => {
      try {
        if (showBusy) {
          setSlotActivity("delivering");
          setThinkingLiveLine(
            locale.startsWith("zh")
              ? "正在恢复交付书生成…"
              : "Resuming delivery book…",
          );
        }
        const next = await resumeFinalDeliveryJobForSession(
          sessionRef.current,
          locale,
          pendingId || null,
        );
        if (cancelled || !next) {
          if (showBusy && !cancelled) {
            setSlotActivity(null);
            setThinkingLiveLine(null);
          }
          return;
        }
        const prev = sessionRef.current;
        const textChanged =
          (next.main_delivery?.full_text ?? "").trim() !==
          (prev.main_delivery?.full_text ?? "").trim();
        const pendingChanged = next.pending_delivery_job_id !== prev.pending_delivery_job_id;
        if (!textChanged && !pendingChanged && next.main_delivery_done === prev.main_delivery_done) {
          if (showBusy) {
            setSlotActivity(null);
            setThinkingLiveLine(null);
          }
          return;
        }
        onSessionUpdate(next);
        syncDebugStateLedger(next);
        await savePOJUSession(next);
        setSlotActivity(null);
        setThinkingLiveLine(null);
        if (textChanged) scrollChatToBottom("smooth");
      } catch (e) {
        console.warn("[poju] delivery resume failed:", e);
        if (!cancelled) {
          const cleared: POJUSessionState = {
            ...sessionRef.current,
            pending_delivery_job_id: null,
          };
          onSessionUpdate(cleared);
          await savePOJUSession(cleared).catch(() => undefined);
          setSlotActivity(null);
          setThinkingLiveLine(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional resume gate
  }, [session.session_id, session.pending_delivery_job_id, session.main_delivery_done]);
  const sendAbortRef = useRef<AbortController | null>(null);
  const sendGenerationRef = useRef(0);
  const turnInFlightRef = useRef(false);
  /** Synchronous dedupe — blocks same-tick double runUserTurn before turnInFlightRef is visible. */
  const activeTurnKeyRef = useRef<string | null>(null);
  /** Silent provider-queue / soft-infra retries per user send turn (then show retry button). */
  const silentRetryCountRef = useRef(0);
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
  const understandingGatePending =
    session.agent_v2?.current_phase === "awaiting_understanding_confirm";
  // Gate choices live in the composer (same pattern as 3-option chips) — do not lock input.
  const composerLocked =
    expired ||
    previewComposerBlocked ||
    unlockBusy ||
    unlockReportGateBlocking ||
    segment2PipelineLock ||
    Boolean(segment2JobId);

  /** Phase-4 delivery and after: no more chat — hide bottom composer. */
  const hideComposer =
    shelfActive ||
    Boolean(session.pending_delivery_job_id?.trim()) ||
    Boolean(session.main_delivery_done);

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
      const ownerKey = await resolveLocalOwnerKey();
      const rows = await getPojuDb()
        .pojuSessionRecords.where("owner_key")
        .equals(ownerKey)
        .and((r) => r.device_id === session.device_id)
        .toArray();
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

    const workspaceParallel =
      layout === "workspace-opening" && session.unlock_status === "unlocked";
    if (!workspaceParallel) {
      if (!hasUnlockReportMessage(session)) return;
      if (!unlockReportGateDismissed) return;
    }

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
    session.unlock_status,
    session.pending_question,
    sending,
    pipelineBusy,
    unlockReportGateDismissed,
    layout,
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
      const attachWire: PojuChatAttachment | null = errorRestore?.attachment?.data_url
        ? {
            name: errorRestore.attachment.name,
            kind: errorRestore.attachment.kind,
            mime: errorRestore.attachment.mime,
            data_url: errorRestore.attachment.data_url,
          }
        : null;
      const updatedSession = await handleUserMessage({
        session: baseSession,
        userMessage,
        locale,
        userAlreadyAppended: true,
        signal: ac.signal,
        attachment: attachWire,
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

      const lastAssistantPreview = [...toPersist.messages]
        .reverse()
        .find((m) => m.role === "assistant" && !m.is_rejected);
      const softInfraFailure =
        Boolean(errorRestore) &&
        Boolean(lastAssistantPreview) &&
        (lastAssistantPreview?.meta?.kind === "infra_busy" ||
          lastAssistantPreview?.meta?.kind === "generation_empty" ||
          lastAssistantPreview?.meta?.kind === "generation_incomplete" ||
          lastAssistantPreview?.meta?.understanding_generation_failed === true ||
          (typeof lastAssistantPreview?.content === "string" &&
            isPojuFailurePlaceholderMessage(lastAssistantPreview.content)));

      if (softInfraFailure && errorRestore && silentRetryCountRef.current < MAX_SILENT_INFRA_RETRIES) {
        silentRetryCountRef.current += 1;
        console.warn(
          `[poju] soft infra failure — silent retry ${silentRetryCountRef.current}/${MAX_SILENT_INFRA_RETRIES}`,
        );
        // Keep the optimistic user bubble; drop the failure placeholder until retries exhaust.
        onSessionUpdate({
          ...errorRestore.rollbackSession,
          messages: [
            ...errorRestore.rollbackSession.messages,
            buildOptimisticUserMessage(userMessage),
          ],
        });
        pendingSilentRetryRef.current = {
          rollbackSession: errorRestore.rollbackSession,
          userMessage,
          errorRestore,
        };
        return;
      }

      if (softInfraFailure && errorRestore) {
        infraRetryContextRef.current = { ...errorRestore, userMessage };
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
        if (silentRetryCountRef.current < MAX_SILENT_INFRA_RETRIES) {
          silentRetryCountRef.current += 1;
          console.warn(
            `[poju] provider queue — silent retry ${silentRetryCountRef.current}/${MAX_SILENT_INFRA_RETRIES}`,
          );
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

  async function handleDeliveryRegenerateClick() {
    if (sending || turnInFlightRef.current || segment2JobId || segment2PipelineLock) return;
    const baseSession = sessionRef.current;
    if (!canStartDeliveryRegenerate(baseSession)) {
      return;
    }

    turnInFlightRef.current = true;
    const gen = ++sendGenerationRef.current;
    setSending(true);
    setSlotActivity("delivering");
    setThinkingLiveLine(
      locale.startsWith("zh") ? "正在重新生成交付书…" : "Regenerating delivery book…",
    );
    setGenerationStopped(false);
    awaitingActivityDismissRef.current = true;

    try {
      setStreamedDeliveryMarkdown(null);


      setDeliveryRitual("shelf");
      setDeliveryInterruptedJobId(null);
      setDeliveryNetworkIssue(false);
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      awaitingActivityDismissRef.current = false;
      const next = await startDeliveryRegenerate({
        session: baseSession,
        locale,
        onAwaitingPersisted: (awaiting) => {
          onSessionUpdate(awaiting);
          syncDebugStateLedger(awaiting);
        },
        onStreamProgress: (hint, md, meta) => {
          if (gen !== sendGenerationRef.current) return;
          if (hint) setThinkingLiveLine(hint);
          setDeliveryWaitingNext(Boolean(meta?.waiting_next));
          if (md.trim()) {
            setStreamedDeliveryMarkdown(md);
            scrollChatToBottom("smooth");
          }
        },
        onNetworkIssue: onDeliveryNetworkIssue,
      });
      if (gen !== sendGenerationRef.current) return;
      setStreamedDeliveryMarkdown(null);
      setDeliveryRitual("shelf");
      setDeliveryWaitingNext(false);
      setDeliveryNetworkIssue(false);

      onSessionUpdate(next);
      syncDebugStateLedger(next);
      await savePOJUSession(next);
      skipActivityRenderReadyRef.current = false;
      scrollChatToBottom("smooth");
    } catch (err) {
      console.error("[poju] delivery regenerate failed:", err);
      setDeliveryWaitingNext(false);
      if (isFinalDeliveryInterruptedError(err)) {
        setDeliveryRitual("shelf");
        setDeliveryNetworkIssue(false);
        if (err.streamed_markdown.trim()) {
          setStreamedDeliveryMarkdown(err.streamed_markdown);
        }
        setDeliveryInterruptedJobId(err.job_id);

        return;
      }
      setDeliveryRitual("idle");
      setDeliveryNetworkIssue(false);
      setStreamedDeliveryMarkdown(null);
      setDeliveryInterruptedJobId(null);
      // Clear stuck awaiting marker so the retry button stays available.
      const cleared: POJUSessionState = {
        ...sessionRef.current,
        pending_delivery_job_id: null,
      };
      onSessionUpdate(cleared);
      await savePOJUSession(cleared).catch(() => undefined);
      const detail = err instanceof Error ? err.message.trim() : String(err ?? "");
      // Prefer server STOP reason over generic "connection error" (job often failed mid-stage).
      const looksLikeDeliveryStop =
        detail.startsWith("STOP at ") ||
        detail.includes("delivery_") ||
        detail.includes("[stage=") ||
        detail.includes("final delivery");
      await dialog.alert(
        looksLikeDeliveryStop && detail
          ? detail.slice(0, 400)
          : detail && !/failed to fetch|networkerror|load failed/i.test(detail)
            ? detail.slice(0, 400)
            : t("dialog_connection_error"),
      );
    } finally {
      turnInFlightRef.current = false;
      if (gen === sendGenerationRef.current) {
        setSending(false);
        awaitingActivityDismissRef.current = false;
        setSlotActivity(null);
        setSlotActivityFading(false);
        setThinkingLiveLine(null);
      }
    }
  }

  const onInfraBusyRetry = useCallback(() => {
    const ctx = infraRetryContextRef.current;
    if (!ctx || turnInFlightRef.current || sending) return;
    silentRetryCountRef.current = 0;
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

  async function applyPreviewUnlock(via: "payment" | "code", baseOverride?: POJUSessionState) {
    const base = baseOverride ?? sessionRef.current;
    const profileId = base.selected_stored_profile_id?.trim();
    if (!profileId) return;

    const pendingQ = base.pending_question?.trim();
    const unlocked: POJUSessionState = {
      ...base,
      unlock_status: "unlocked",
      unlock_via: via,
      original_question: pendingQ || base.original_question,
      // Drop paywall marker if present — unlock succeeded
      messages: base.messages.filter((m) => m.meta?.kind !== "paywall"),
    };
    onSessionUpdate(unlocked);
    await savePOJUSession(unlocked);

    if (layout === "workspace-opening" && workspacePrepare) {
      try {
        sessionStorage.setItem(POJU_RELEASE_PENDING_QUESTION_FLAG, base.session_id);
      } catch {
        /* ignore */
      }
      workspacePrepare.startUnlockRitual();
      return;
    }

    router.push(`/poju/session/${base.session_id}/preparing?unlock=1`);
  }

  async function handlePreviewUnlock(via: "payment" | "code") {
    if (unlockBusy) return;
    setUnlockBusy(true);
    try {
      await applyPreviewUnlock(via);
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
    silentRetryCountRef.current = 0;
    const attachNote = buildAttachmentNote(composerAttachment);
    const userMessage = typed || attachNote;
    const baseSession = consumeReplyOptionsOnSession(sessionRef.current);

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
      const topic = topicFromFirstUserMessage(userMessage);
      const withPending: POJUSessionState = {
        ...baseSession,
        pending_question: userMessage,
        original_question:
          isDefaultNewSessionTitle(baseSession.original_question) && topic
            ? topic
            : baseSession.original_question,
      };
      onSessionUpdate(withPending);
      await savePOJUSession(withPending);
      if (isDefaultNewSessionTitle(baseSession.original_question) && topic) {
        setSessionRows((prev) =>
          prev.map((x) =>
            x.session_id === baseSession.session_id ? { ...x, original_question: topic } : x,
          ),
        );
      }

      // Has Pass → unlock immediately (no paywall). No Pass → show paywall.
      setUnlockBusy(true);
      try {
        const spend = await unlockWithPass({
          product: "pivot",
          refId: baseSession.session_id,
          description: "Pivot full delivery unlock",
        });
        if (spend.ok) {
          await applyPreviewUnlock("payment", withPending);
          return;
        }

        const messages = [...withPending.messages];
        if (!hasPaywallMessage(withPending)) {
          messages.push(createPaywallMessage());
        }
        const withPaywall: POJUSessionState = { ...withPending, messages };
        onSessionUpdate(withPaywall);
        await savePOJUSession(withPaywall);
      } catch (e) {
        console.error("[poju] preview pass check failed:", e);
        const messages = [...withPending.messages];
        if (!hasPaywallMessage(withPending)) {
          messages.push(createPaywallMessage());
        }
        const withPaywall: POJUSessionState = { ...withPending, messages };
        onSessionUpdate(withPaywall);
        await savePOJUSession(withPaywall);
      } finally {
        setUnlockBusy(false);
      }
      return;
    }

    const nowIso = new Date().toISOString();
    const optimisticUser: POJUMessage = {
      role: "user",
      content: userMessage,
      timestamp: nowIso,
      client_id: safeRandomUUID(),
      meta: savedComposerAttachment
        ? {
            attachment_preview: {
              name: savedComposerAttachment.name,
              kind: savedComposerAttachment.kind,
              mime: savedComposerAttachment.mime,
              data_url:
                savedComposerAttachment.kind === "image"
                  ? savedComposerAttachment.data_url
                  : undefined,
            },
          }
        : undefined,
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

  const agentPhase = session.agent_v2?.current_phase;
  const attachmentsUnlocked =
    Boolean(session.agent_v2?.attachments_unlocked) ||
    Boolean(agentPhase && agentPhase !== "opening");

  async function ingestComposerFiles(files: File[]) {
    if (!attachmentsUnlocked) {
      await dialog.alert(attachmentClientErrorMessage("attach_locked", locale));
      return;
    }
    const file = files[0];
    if (!file) return;
    try {
      const att = await fileToComposerAttachment(file);
      setComposerAttachment(att);
    } catch (e) {
      const code = e instanceof Error ? e.message : "unsupported_type";
      await dialog.alert(attachmentClientErrorMessage(code, locale));
    }
  }

  function handleAttachPick(kind: "image" | "document" | "pdf") {
    if (!attachmentsUnlocked) {
      void dialog.alert(attachmentClientErrorMessage("attach_locked", locale));
      return;
    }
    const mobile = isLikelyMobileClient();
    const inputEl =
      kind === "image" ? fileRef.current : kind === "document" ? documentFileRef.current : pdfFileRef.current;
    if (inputEl) {
      inputEl.accept = acceptForAttachKind(kind, mobile);
      inputEl.click();
    }
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

  /** Segment2 only: wait for 真算 Layer1 (existing deep_reckoning UI covers the wait). */
  async function waitLayer1ForSegment2(profileId: string): Promise<boolean> {
    try {
      const ok = await waitForLayer1(profileId, { timeoutMs: 300_000 });
      if (!ok) return false;
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
      console.warn("[poju] Layer1 not ready for segment2:", e);
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
      awaiting_understanding_confirm: "agent_phase_confirm",
      awaiting_confirmation: "agent_phase_confirm",
      delivered: "agent_phase_delivered",
      tracking: "agent_phase_tracking",
    };
    return map[phase] ?? "agent_phase_collecting";
  }

  async function handleDeliveryConfirmGateClick(action: "confirmed" | "wants_to_add") {
    if (sending || turnInFlightRef.current || segment2JobId || pipelineBusy) return;
    const baseSession = sessionRef.current;
    if (baseSession.agent_v2?.current_phase !== "awaiting_confirmation") return;

    if (action === "wants_to_add") {
      const next = applyDeliveryConfirmationSupplement(baseSession, locale);
      onSessionUpdate(next);
      syncDebugStateLedger(next);
      await savePOJUSession(next);
      scrollChatToBottom("smooth");
      return;
    }

    const userLabel = deliveryConfirmButtonLabel(locale);
    const withUser: POJUSessionState = {
      ...baseSession,
      messages: [...baseSession.messages, buildOptimisticUserMessage(userLabel)],
    };
    onSessionUpdate(withUser);
    scrollChatToBottom("smooth");

    turnInFlightRef.current = true;
    const gen = ++sendGenerationRef.current;
    setSending(true);
    setSlotActivity("delivering");
    setThinkingLiveLine(
      locale.startsWith("zh") ? "正在生成完整破局方案…" : "Generating your full breakthrough plan…",
    );
    setGenerationStopped(false);
    awaitingActivityDismissRef.current = true;

    try {
      setStreamedDeliveryMarkdown(null);
      setDeliveryWaitingNext(false);


      setDeliveryRitual("shelf");
      setDeliveryInterruptedJobId(null);
      setDeliveryNetworkIssue(false);
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      awaitingActivityDismissRef.current = false;
      const delivered = await startDeliveryAfterGateConfirm({
        session: withUser,
        locale,
        userAlreadyAppended: true,
        onStreamProgress: (hint, md, meta) => {
          if (gen !== sendGenerationRef.current) return;
          if (hint) setThinkingLiveLine(hint);
          setDeliveryWaitingNext(Boolean(meta?.waiting_next));
          if (md.trim()) {
            setStreamedDeliveryMarkdown(md);
            scrollChatToBottom("smooth");
          }
        },
        onNetworkIssue: onDeliveryNetworkIssue,
      });
      if (gen !== sendGenerationRef.current) return;
      setStreamedDeliveryMarkdown(null);
      setDeliveryRitual("shelf");
      setDeliveryWaitingNext(false);
      setDeliveryNetworkIssue(false);

      onSessionUpdate(delivered);
      syncDebugStateLedger(delivered);
      await savePOJUSession(delivered);
      if (delivered.main_delivery_done) {
        setSituationNotice(t("final_delivery_done"));
      }
      scrollChatToBottom("smooth");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[poju] delivery confirm gate failed:", e);
      if (gen !== sendGenerationRef.current) return;
      setDeliveryWaitingNext(false);
      if (isFinalDeliveryInterruptedError(e)) {
        setDeliveryRitual("shelf");
        setDeliveryNetworkIssue(false);
        if (e.streamed_markdown.trim()) {
          setStreamedDeliveryMarkdown(e.streamed_markdown);
        }
        setDeliveryInterruptedJobId(e.job_id);

        setSlotActivity(null);
        setSlotActivityFading(false);
        setThinkingLiveLine(null);
        awaitingActivityDismissRef.current = false;
        return;
      }
      setDeliveryRitual("idle");
      setDeliveryNetworkIssue(false);
      setStreamedDeliveryMarkdown(null);
      setDeliveryInterruptedJobId(null);
      onSessionUpdate(baseSession);
      await savePOJUSession(baseSession).catch(() => undefined);
      await dialog.alert(
        msg === "PASS_REQUIRED"
          ? locale.startsWith("zh")
            ? "解锁完整交付需要 1 个 Pass。请到定价页或账户页购买后再试。"
            : "You need 1 Pass to unlock full delivery. Buy Passes from Pricing or your account, then try again."
          : msg === "PASS_LOGIN_REQUIRED"
            ? locale.startsWith("zh")
              ? "请先登录后再使用 Pass 解锁交付。"
              : "Sign in to use a Pass for this delivery."
            : locale.startsWith("zh")
              ? "完整方案生成时遇到问题。你的信息都已保留——请再点一次「可以，没有补充了」。"
              : "Delivery could not be generated. Your context is saved — tap confirm again to retry.",
      );
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      setStreamedDeliveryMarkdown(null);
      awaitingActivityDismissRef.current = false;
    } finally {
      if (gen === sendGenerationRef.current) {
        setSending(false);
        turnInFlightRef.current = false;
      }
    }
  }

  async function handleUnderstandingGateClick(action: "confirmed" | "wants_to_add") {
    if (sending || turnInFlightRef.current || segment2JobId) return;
    const baseSession = sessionRef.current;
    if (baseSession.agent_v2?.current_phase !== "awaiting_understanding_confirm") return;

    if (action === "wants_to_add") {
      const next = applyUnderstandingGateSupplement(baseSession);
      onSessionUpdate(next);
      syncDebugStateLedger(next);
      await savePOJUSession(next);
      return;
    }

    const userLabel = understandingGateConfirmButtonLabel(locale);
    const withUser: POJUSessionState = {
      ...baseSession,
      messages: [...baseSession.messages, buildOptimisticUserMessage(userLabel)],
    };
    onSessionUpdate(withUser);
    scrollChatToBottom("smooth");

    turnInFlightRef.current = true;
    const gen = ++sendGenerationRef.current;
    setSending(true);
    setSlotActivity("deep_reckoning");
    setThinkingLiveLine(null);
    setGenerationStopped(false);
    awaitingActivityDismissRef.current = true;

    try {
      const profileId = baseSession.selected_stored_profile_id?.trim();
      if (profileId && resolveSessionHasProfile(baseSession)) {
        const ready = await waitLayer1ForSegment2(profileId);
        if (!ready) {
          onSessionUpdate(baseSession);
          await dialog.alert(
            locale.startsWith("zh")
              ? "能量底座仍在计算，请稍后再确认。"
              : "Energy base is still computing. Please wait a moment and try again.",
          );
          return;
        }
      }

      const started = await startSegment2AfterGateConfirm({
        session: withUser,
        locale,
        userAlreadyAppended: true,
      });
      if (gen !== sendGenerationRef.current) return;

      onSessionUpdate(started.session);
      syncDebugStateLedger(started.session);
      await savePOJUSession(started.session);

      if (started.already_complete || !started.job_id) {
        const core = started.session.agent_v2?.breakthrough_core;
        if (started.already_complete && core && !started.session.agent_v2?.agenda_generated) {
          armSegment2PipelineLock();
          setSegment2Stage("agenda");
          setThinkingLiveLine(segment2AgendaPreparingHint(locale));
          const created = await createSegment2AgendaJob({
            session: started.session,
            locale,
            breakthrough_core: core,
          });
          if (!created.ok) {
            const failed = finalizeSegment2AgendaBridgeFailure({
              session: started.session,
              locale,
              error: created.error,
            });
            unlockSegment2Pipeline();
            onSessionUpdate(failed);
            await savePOJUSession(failed);
            setSending(false);
            return;
          }
          setSegment2JobId(created.job_id);
          return;
        }
        skipActivityRenderReadyRef.current = false;
        setSending(false);
        if (!awaitingActivityDismissRef.current) {
          setSlotActivity(null);
          setSlotActivityFading(false);
          setThinkingLiveLine(null);
        }
        return;
      }

      // Fix 5 — only poll this create's job_id (never reuse a stale id).
      armSegment2PipelineLock();
      setSegment2Stage("report");
      setSegment2JobId(null);
      console.info("[segment2] job created (ui)", { job_id: started.job_id });
      setSegment2JobId(started.job_id);
      setThinkingLiveLine(
        locale.startsWith("zh") ? "正在深度分析…" : "Running deep analysis…",
      );
      // Keep sending/activity until prepare onComplete/onError.
    } catch (err) {
      console.error("[poju] understanding gate confirm failed:", err);
      onSessionUpdate(baseSession);
      await dialog.alert(t("dialog_connection_error"));
      setSending(false);
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
    } finally {
      turnInFlightRef.current = false;
    }
  }

  function clearSegment2LockTimer() {
    if (segment2LockTimerRef.current != null) {
      window.clearTimeout(segment2LockTimerRef.current);
      segment2LockTimerRef.current = null;
    }
  }

  function unlockSegment2Pipeline() {
    clearSegment2LockTimer();
    setSegment2PipelineLock(false);
    setSegment2JobId(null);
    setSegment2Stage(null);
  }

  function armSegment2PipelineLock() {
    clearSegment2LockTimer();
    setSegment2PipelineLock(true);
    segment2LockTimerRef.current = window.setTimeout(() => {
      console.warn("[segment2] hard unlock timer fired");
      setSegment2PipelineLock(false);
      setSegment2JobId(null);
      setSegment2Stage(null);
    }, SEGMENT2_INPUT_LOCK_HARD_MS);
  }

  async function handleSegment2JobComplete(
    result: Parameters<typeof applySegment2PollSuccess>[2],
  ) {
    const base = sessionRef.current;

    // Call B complete
    if (segment2Stage === "agenda") {
      const next = finalizeSegment2AgendaBridgeSuccess({
        session: base,
        locale,
        investigation_agenda: result.investigation_agenda ?? [],
        first_question:
          result.first_question ??
          result.breakthrough_core?.first_question ??
          "",
        options: result.options,
        model: result.model,
        tokens_used: result.tokens_used,
        llm_debug: result.llm_debug,
      });
      unlockSegment2Pipeline();
      onSessionUpdate(next);
      syncDebugStateLedger(next);
      await savePOJUSession(next);
      setSending(false);
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      awaitingActivityDismissRef.current = false;
      scrollChatToBottom("smooth");
      return;
    }

    // Call A complete → render report, keep lock, start Call B
    const next = applySegment2PollSuccess(base, locale, result);
    onSessionUpdate(next);
    syncDebugStateLedger(next);
    await savePOJUSession(next);
    scrollChatToBottom("smooth");

    const core = next.agent_v2?.breakthrough_core;
    if (!core) {
      unlockSegment2Pipeline();
      setSending(false);
      return;
    }

    setSegment2Stage("agenda");
    setThinkingLiveLine(segment2AgendaPreparingHint(locale));
    setSegment2JobId(null); // remount preparing on new id

    const created = await createSegment2AgendaJob({
      session: next,
      locale,
      breakthrough_core: core,
    });
    if (!created.ok) {
      const failed = finalizeSegment2AgendaBridgeFailure({
        session: next,
        locale,
        error: created.error,
      });
      unlockSegment2Pipeline();
      onSessionUpdate(failed);
      syncDebugStateLedger(failed);
      await savePOJUSession(failed);
      setSending(false);
      setSlotActivity(null);
      setThinkingLiveLine(null);
      awaitingActivityDismissRef.current = false;
      return;
    }

    setSegment2JobId(created.job_id);
    // stay locked + sending until B finishes
  }

  async function handleSegment2JobError(error: string, reason?: string) {
    console.warn("[poju] segment2 job failed:", error, reason, segment2Stage);
    const base = sessionRef.current;

    if (segment2Stage === "agenda") {
      const next = finalizeSegment2AgendaBridgeFailure({ session: base, locale, error });
      unlockSegment2Pipeline();
      onSessionUpdate(next);
      syncDebugStateLedger(next);
      await savePOJUSession(next);
      setSending(false);
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      awaitingActivityDismissRef.current = false;
      return;
    }

    const next = finalizeSegment2JobFailure({ session: base, locale, error, reason });
    unlockSegment2Pipeline();
    onSessionUpdate(next);
    syncDebugStateLedger(next);
    await savePOJUSession(next);
    setSending(false);
    setSlotActivity(null);
    setSlotActivityFading(false);
    setThinkingLiveLine(null);
    awaitingActivityDismissRef.current = false;
  }

  async function handleRegenerateQuestionClick() {
    if (sending || turnInFlightRef.current || segment2JobId || segment2PipelineLock) return;
    const baseSession = sessionRef.current;
    if (!baseSession.agent_v2?.breakthrough_core) return;

    turnInFlightRef.current = true;
    setSending(true);
    setThinkingLiveLine(segment2AgendaPreparingHint(locale));
    try {
      const started = await startSegment2AgendaRegenerate({
        session: baseSession,
        locale,
      });
      onSessionUpdate(started.session);
      await savePOJUSession(started.session);
      if (!started.job_id) {
        setSending(false);
        setThinkingLiveLine(null);
        return;
      }
      armSegment2PipelineLock();
      setSegment2Stage("agenda");
      setSegment2JobId(started.job_id);
    } catch (err) {
      console.error("[poju] regenerate question failed:", err);
      unlockSegment2Pipeline();
      setSending(false);
      setThinkingLiveLine(null);
    } finally {
      turnInFlightRef.current = false;
    }
  }

  async function handleRegenerateAnalysisClick() {
    if (sending || turnInFlightRef.current || segment2JobId) return;
    const baseSession = sessionRef.current;
    if (baseSession.agent_v2?.current_phase !== "collecting_context") return;

    const userLabel = segment2RegenerateButtonLabel(locale);
    const withUser: POJUSessionState = {
      ...baseSession,
      messages: [...baseSession.messages, buildOptimisticUserMessage(userLabel)],
    };
    onSessionUpdate(withUser);
    scrollChatToBottom("smooth");

    turnInFlightRef.current = true;
    const gen = ++sendGenerationRef.current;
    setSending(true);
    setSlotActivity("deep_reckoning");
    setThinkingLiveLine(null);
    setGenerationStopped(false);
    awaitingActivityDismissRef.current = true;

    try {
      const profileId = baseSession.selected_stored_profile_id?.trim();
      if (profileId && resolveSessionHasProfile(baseSession)) {
        const ready = await waitLayer1ForSegment2(profileId);
        if (!ready) {
          onSessionUpdate(baseSession);
          await dialog.alert(
            locale.startsWith("zh")
              ? "能量底座仍在计算，请稍后再试。"
              : "Energy base is still computing. Please wait a moment and try again.",
          );
          return;
        }
      }

      const started = await startSegment2Regenerate({
        session: withUser,
        locale,
        userAlreadyAppended: true,
      });
      if (gen !== sendGenerationRef.current) return;

      onSessionUpdate(started.session);
      syncDebugStateLedger(started.session);
      await savePOJUSession(started.session);

      if (started.already_complete || !started.job_id) {
        const core = started.session.agent_v2?.breakthrough_core;
        if (started.already_complete && core && !started.session.agent_v2?.agenda_generated) {
          armSegment2PipelineLock();
          setSegment2Stage("agenda");
          setThinkingLiveLine(segment2AgendaPreparingHint(locale));
          const created = await createSegment2AgendaJob({
            session: started.session,
            locale,
            breakthrough_core: core,
          });
          if (!created.ok) {
            const failed = finalizeSegment2AgendaBridgeFailure({
              session: started.session,
              locale,
              error: created.error,
            });
            unlockSegment2Pipeline();
            onSessionUpdate(failed);
            await savePOJUSession(failed);
            setSending(false);
            return;
          }
          setSegment2JobId(created.job_id);
          return;
        }
        skipActivityRenderReadyRef.current = false;
        setSending(false);
        return;
      }

      armSegment2PipelineLock();
      setSegment2Stage("report");
      setSegment2JobId(null);
      console.info("[segment2] job created (ui regenerate)", { job_id: started.job_id });
      setSegment2JobId(started.job_id);
      setThinkingLiveLine(
        locale.startsWith("zh") ? "正在深度分析…" : "Running deep analysis…",
      );
    } catch (err) {
      console.error("[poju] segment-2 regenerate failed:", err);
      onSessionUpdate(baseSession);
      await dialog.alert(t("dialog_connection_error"));
      setSending(false);
    } finally {
      turnInFlightRef.current = false;
    }
  }

  async function handleRetryOpeningUnderstandingClick() {
    if (sending || turnInFlightRef.current) return;
    const baseSession = sessionRef.current;

    turnInFlightRef.current = true;
    const gen = ++sendGenerationRef.current;
    setSending(true);
    setSlotActivity("deep_reckoning");
    setThinkingLiveLine(null);
    setGenerationStopped(false);
    awaitingActivityDismissRef.current = true;

    try {
      const updatedSession = await handleRetryOpeningUnderstanding({
        session: baseSession,
        locale,
      });
      if (gen !== sendGenerationRef.current) return;
      onSessionUpdate(updatedSession);
      skipActivityRenderReadyRef.current = false;
      syncDebugStateLedger(updatedSession);
      await savePOJUSession(updatedSession);
    } catch (err) {
      console.error("[poju] opening understanding retry failed:", err);
      await dialog.alert(t("dialog_connection_error"));
    } finally {
      turnInFlightRef.current = false;
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
      setStreamedDeliveryMarkdown(null);


      setDeliveryRitual("shelf");
      setDeliveryInterruptedJobId(null);
      setDeliveryNetworkIssue(false);
      setSlotActivity(null);
      setSlotActivityFading(false);
      setThinkingLiveLine(null);
      let next = await runFinalDeliveryForSession(sessionRef.current, locale, {
        onStreamProgress: (hint, md, meta) => {
          if (hint) setThinkingLiveLine(hint);
          setDeliveryWaitingNext(Boolean(meta?.waiting_next));
          if (md.trim()) {
            setStreamedDeliveryMarkdown(md);
            scrollChatToBottom("smooth");
          }
        },
        onNetworkIssue: onDeliveryNetworkIssue,
      });
      setStreamedDeliveryMarkdown(null);
      setDeliveryRitual("shelf");
      setDeliveryWaitingNext(false);
      setDeliveryNetworkIssue(false);

      const { trySaveDeliveryActionsToArchive } = await import("@/lib/archive/archive-service");
      next = await trySaveDeliveryActionsToArchive(next, locale);
      onSessionUpdate(next);
      await savePOJUSession(next);
      setSituationNotice(t("final_delivery_done"));
    } catch (e) {
      setDeliveryWaitingNext(false);
      if (isFinalDeliveryInterruptedError(e)) {
        setDeliveryRitual("shelf");
        setDeliveryNetworkIssue(false);
        if (e.streamed_markdown.trim()) {
          setStreamedDeliveryMarkdown(e.streamed_markdown);
        }
        setDeliveryInterruptedJobId(e.job_id);

        return;
      }
      setDeliveryRitual("idle");
      setDeliveryNetworkIssue(false);
      setStreamedDeliveryMarkdown(null);
      setDeliveryInterruptedJobId(null);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "PASS_REQUIRED") {
        setFinalError(t("pass_required"));
        setPassBuyOpen(true);
      } else if (msg === "PASS_LOGIN_REQUIRED") {
        setFinalError(t("pass_login_required"));
      } else {
        setFinalError(msg);
      }
    } finally {
      setFinalBusy(false);
    }
  }

  async function handleContinueInterruptedDelivery() {
    if (deliveryContinueBusy || !deliveryInterruptedJobId) return;
    const jobId = deliveryInterruptedJobId;
    setDeliveryContinueBusy(true);
    setDeliveryInterruptedJobId(null);
    setDeliveryWaitingNext(true);
    setDeliveryRitual("shelf");
    setDeliveryNetworkIssue(false);
    setThinkingLiveLine(t("delivery_interrupted_continuing"));
    setSending(true);
    const gen = ++sendGenerationRef.current;
    try {
      const next = await continueInterruptedFinalDeliveryForSession(sessionRef.current, locale, {
        job_id: jobId,
        onStreamProgress: (hint, md, meta) => {
          if (gen !== sendGenerationRef.current) return;
          if (hint) setThinkingLiveLine(hint);
          setDeliveryWaitingNext(Boolean(meta?.waiting_next));
          if (md.trim()) {

            setStreamedDeliveryMarkdown(md);
            scrollChatToBottom("smooth");
          }
        },
        onNetworkIssue: onDeliveryNetworkIssue,
      });
      if (gen !== sendGenerationRef.current) return;
      setStreamedDeliveryMarkdown(null);
      setDeliveryRitual("shelf");
      setDeliveryWaitingNext(false);
      setDeliveryInterruptedJobId(null);
      setDeliveryNetworkIssue(false);
      onSessionUpdate(next);
      syncDebugStateLedger(next);
      await savePOJUSession(next);
      if (next.main_delivery_done) {
        setSituationNotice(t("final_delivery_done"));
      }
      scrollChatToBottom("smooth");
    } catch (e) {
      if (gen !== sendGenerationRef.current) return;
      setDeliveryWaitingNext(false);
      if (isFinalDeliveryInterruptedError(e)) {
        setDeliveryRitual("shelf");
        if (e.streamed_markdown.trim()) {
          setStreamedDeliveryMarkdown(e.streamed_markdown);
        }
        setDeliveryInterruptedJobId(e.job_id);
        return;
      }
      setDeliveryInterruptedJobId(jobId);
      setDeliveryRitual("shelf");
      await dialog.alert(
        e instanceof Error && e.message.trim()
          ? e.message.slice(0, 400)
          : t("dialog_connection_error"),
      );
    } finally {
      if (gen === sendGenerationRef.current) {
        setSending(false);
        setDeliveryContinueBusy(false);
        setThinkingLiveLine(null);
      }
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

  const prepareShelfOpenRequest = workspacePrepare?.deliveryShelfOpenRequest ?? 0;
  const deliveryShelfNode = useMemo(() => {
    if (!deliveryPageActive) return null;
    const complete =
      Boolean(session.main_delivery_done) &&
      !deliveryInterruptedJobId &&
      !session.pending_delivery_job_id?.trim();
    return (
      <div className="delivery-phase4-stream-enter">
        <DeliveryShelfView
          fullText={deliveryFullText}
          locale={locale}
          sessionId={session.session_id}
          complete={complete}
          originalQuestion={session.original_question}
          profileId={
            session.agent_v2?.selected_profile_id ??
            session.selected_stored_profile_id ??
            null
          }
          openReaderRequest={prepareShelfOpenRequest}
          interrupted={Boolean(deliveryInterruptedJobId)}
          interruptBusy={deliveryContinueBusy || sending}
          onContinueInterrupted={() => void handleContinueInterruptedDelivery()}
          networkIssue={deliveryNetworkIssue}
        />
      </div>
    );
  }, [
    deliveryPageActive,
    deliveryFullText,
    locale,
    session.session_id,
    session.main_delivery_done,
    session.original_question,
    session.agent_v2?.selected_profile_id,
    session.selected_stored_profile_id,
    session.pending_delivery_job_id,
    prepareShelfOpenRequest,
    deliveryInterruptedJobId,
    deliveryContinueBusy,
    sending,
    deliveryNetworkIssue,
  ]);

  const pojuMessages = useMemo(() => {
    // Delivery page: empty transcript — book owns the center.
    if (deliveryPageActive) return [];
    return visibleMessages.map((m) => ({
      id: m.client_id ?? m.timestamp,
      role: m.role as "user" | "assistant",
      content: m.content,
      editable: m.role === "user" && !m.is_rejected,
    }));
  }, [visibleMessages, deliveryPageActive]);

  const { messageSlots, bareMessageSlotIds, messageFooters, messageFollowUps, messageFollowUpActionsText } =
    useMemo(() => {
      // Delivery page: no chat message slots (centerSlot owns the UI).
      if (deliveryPageActive) {
        return {
          messageSlots: {} as Record<string, ReactNode>,
          bareMessageSlotIds: new Set<string>(),
          messageFooters: {} as Record<string, ReactNode>,
          messageFollowUps: {} as Record<string, ReactNode>,
          messageFollowUpActionsText: {} as Record<string, string>,
        };
      }
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
          bareIds.add(mid);
          slots[mid] = <MatrixNarrativeReply payload={payload} locale={locale} />;
        }
      }
      if (m.meta?.contains_delivery) {
        bareIds.add(mid);
        slots[mid] = (
          <DeliveryShelfView
            fullText={m.content}
            locale={locale}
            sessionId={session.session_id}
            complete
            originalQuestion={session.original_question}
            profileId={
              session.agent_v2?.selected_profile_id ??
              session.selected_stored_profile_id ??
              null
            }
            openReaderRequest={prepareShelfOpenRequest}
          />
        );
        followUps[mid] = (
          <>
            {followUps[mid]}
            <RegenerateDeliveryAction
              busy={sending}
              onRegenerate={() => void handleDeliveryRegenerateClick()}
            />
          </>
        );
      }
      // Failed first delivery / regenerate that stripped the book: no delivery bubble hosts the button.
      if (
        m.role === "assistant" &&
        !m.is_rejected &&
        mid === lastAssistantKey &&
        !m.meta?.contains_delivery &&
        canStartDeliveryRegenerate(session)
      ) {
        followUps[mid] = (
          <>
            {followUps[mid]}
            <RegenerateDeliveryAction
              busy={sending}
              mode="retry"
              onRegenerate={() => void handleDeliveryRegenerateClick()}
            />
          </>
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
      const looksLikeSegment2Delivery =
        m.meta?.segment2_analysis === true ||
        (Array.isArray(m.meta?.investigation_agenda) &&
          (m.meta?.investigation_agenda.length ?? 0) > 0 &&
          session.agent_v2?.breakthrough_core != null);
      if (
        m.role === "assistant" &&
        !m.is_rejected &&
        mid === lastAssistantKey &&
        m.meta?.segment2_agenda_bridge_failed
      ) {
        followUps[mid] = (
          <>
            {followUps[mid]}
            <RegenerateQuestionAction busy={sending} onRegenerate={() => void handleRegenerateQuestionClick()} />
          </>
        );
      }
      if (
        m.role === "assistant" &&
        !m.is_rejected &&
        mid === lastAssistantKey &&
        (m.meta?.core_generation_failed ||
          (SHOW_SEGMENT2_TEST_REGENERATE && looksLikeSegment2Delivery))
      ) {
        followUps[mid] = (
          <>
            {followUps[mid]}
            <RegenerateAnalysisAction busy={sending} onRegenerate={() => void handleRegenerateAnalysisClick()} />
          </>
        );
      }
      if (
        m.meta?.understanding_generation_failed &&
        m.role === "assistant" &&
        !m.is_rejected &&
        mid === lastAssistantKey
      ) {
        followUps[mid] = (
          <>
            {followUps[mid]}
            <RegenerateOpeningAction busy={sending} onRetry={() => void handleRetryOpeningUnderstandingClick()} />
          </>
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
    shelfActive,
    deliveryPageActive,
    visibleMessages,
    locale,
    session.session_id,
    session.actions,
    session.action_plan_archive_id,
    session.main_delivery_done,
    session.pending_delivery_job_id,
    session.unlock_status,
    openUnlockReportModal,
    getActivityLines,
    showStateDebug,
    session.agent_v2,
    session.original_question,
    session.selected_stored_profile_id,
    sending,
    onInfraBusyRetry,
    prepareShelfOpenRequest,
  ]);

  const deliveryConfirmPending =
    session.agent_v2?.current_phase === "awaiting_confirmation" &&
    !session.agent_v2?.stall_offer_pending;

  const activeComposerOptions = useMemo(() => {
    if (composerLocked || sending) return undefined;
    if (session.agent_v2?.current_phase === "awaiting_understanding_confirm") {
      return [
        understandingGateConfirmButtonLabel(locale),
        understandingGateSupplementButtonLabel(locale),
      ];
    }
    if (
      session.agent_v2?.current_phase === "awaiting_confirmation" &&
      !session.agent_v2?.stall_offer_pending
    ) {
      return [deliveryConfirmButtonLabel(locale), deliverySupplementButtonLabel(locale)];
    }
    const last = [...visibleMessages].reverse().find((m) => m.role === "assistant" && !m.is_rejected);
    if (
      !last ||
      last.meta?.options_consumed ||
      !Array.isArray(last.options) ||
      last.options.length < 2
    ) {
      return undefined;
    }
    // Drop legacy "[object Object]" chips persisted before sanitize fix.
    const cleaned = last.options
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0 && s !== "[object Object]");
    return cleaned.length >= 2 ? cleaned.slice(0, 3) : undefined;
  }, [
    visibleMessages,
    session.agent_v2?.current_phase,
    session.agent_v2?.stall_offer_pending,
    composerLocked,
    sending,
    locale,
  ]);

  function handleComposerOptionPick(opt: string) {
    if (session.agent_v2?.current_phase === "awaiting_understanding_confirm") {
      const confirm = understandingGateConfirmButtonLabel(locale);
      const supplement = understandingGateSupplementButtonLabel(locale);
      if (opt === confirm) {
        void handleUnderstandingGateClick("confirmed");
        return;
      }
      if (opt === supplement) {
        void handleUnderstandingGateClick("wants_to_add");
        return;
      }
    }
    if (
      session.agent_v2?.current_phase === "awaiting_confirmation" &&
      !session.agent_v2?.stall_offer_pending
    ) {
      const confirm = deliveryConfirmButtonLabel(locale);
      const supplement = deliverySupplementButtonLabel(locale);
      if (opt === confirm) {
        void handleDeliveryConfirmGateClick("confirmed");
        return;
      }
      if (opt === supplement) {
        void handleDeliveryConfirmGateClick("wants_to_add");
        return;
      }
    }
    void handlePojuSend(opt);
  }

  const streaming = sending;
  const workspaceOpening = layout === "workspace-opening";

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ingestComposerFiles([f]);
          e.target.value = "";
        }}
      />
      <input
        ref={documentFileRef}
        type="file"
        accept=".txt,.md,.json,text/plain,text/markdown,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ingestComposerFiles([f]);
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
          if (f) void ingestComposerFiles([f]);
          e.target.value = "";
        }}
      />
      <div
        className={workspaceOpening ? "workspace-poju-opening" : "poju-chat-shell"}
        style={deliveryRitual === "shelf" ? { position: "relative" } : undefined}
      >
        <div
          className={
            workspaceOpening ? "workspace-poju-opening__stage" : "poju-chat-shell__main"
          }
        >
      <PojuChat
        chrome={workspaceOpening ? "workspace" : "full"}
        sessions={pojuSessions}
        currentSessionId={session.session_id}
        messages={pojuMessages}
        isStreaming={streaming}
        pendingActivityLines={pendingActivityLines}
        pendingActivityFading={slotActivityFading}
        thinkingLiveLine={thinkingLiveLine}
        thinkingLocale={locale}
        composerDisabled={composerLocked}
        hideComposer={hideComposer}
        centerSlot={deliveryShelfNode}
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
              workspaceSurface={workspaceOpening}
              onUnlocked={(via) => void handlePreviewUnlock(via)}
            />
          ) : undefined
        }
        initialScrollPosition={initialScrollPosition}
        onActivityRenderReady={handleActivityRenderReady}
        inputPlaceholder={
          activeComposerOptions ? t("input_placeholder_with_options") : t("input_placeholder")
        }
        composerOptions={activeComposerOptions}
        onComposerOptionPick={handleComposerOptionPick}
        composerOptionsLabel={
          understandingGatePending
            ? t("understanding_gate_group_label")
            : deliveryConfirmPending
              ? t("delivery_confirm_group_label")
              : t("reply_options_group_label")
        }
        composerOptionEditLabel={t("reply_option_edit_label")}
        composerText={input}
        onComposerTextChange={setInput}
        composerHasAttachment={composerAttachment !== null}
        composerAttachmentPreview={
          composerAttachment
            ? {
                name: composerAttachment.name,
                kind: composerAttachment.kind,
                previewUrl: composerAttachment.previewUrl,
              }
            : null
        }
        onClearAttachment={() => setComposerAttachment(null)}
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
        onAttachFiles={(files) => void ingestComposerFiles(files)}
        attachEnabled={attachmentsUnlocked}
        attachLockedHint={attachmentClientErrorMessage("attach_locked", locale)}
        attachMenuLabel={t("attach_menu_label")}
        attachMenuLabels={{
          document: t("attach_menu_document"),
          image: t("attach_menu_image"),
          pdf: t("attach_menu_pdf"),
        }}
        contextMenuLabels={{
          cut: t("ctx_cut"),
          copy: t("ctx_copy"),
          paste: t("ctx_paste"),
          selectAll: t("ctx_select_all"),
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
        onClose={workspaceOpening ? undefined : () => router.push("/poju")}
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
          ) : (
            <>
              {segment2JobId ? (
                <Segment2AnalysisPreparing
                  key={segment2JobId}
                  job_id={segment2JobId}
                  locale={locale}
                  onProgress={(chars) => {
                    setThinkingLiveLine(
                      locale.startsWith("zh")
                        ? `正在深度分析…已生成 ${chars} 字`
                        : `Deep analysis… ${chars} chars`,
                    );
                  }}
                  onComplete={(result) => void handleSegment2JobComplete(result)}
                  onError={(error, reason) => void handleSegment2JobError(error, reason)}
                />
              ) : null}
              {session.agent_v2 ? (
                <AgendaProgressPanel agent={session.agent_v2} locale={locale} />
              ) : null}
            </>
          )
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
        {!workspaceOpening && process.env.NODE_ENV === "development" ? (
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

      {unlockReportText && layout !== "workspace-opening" ? (
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
      <PassPurchaseModal
        open={passBuyOpen}
        onClose={() => setPassBuyOpen(false)}
        reason="insufficient"
      />
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

