"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BirthProfileFlow, type BirthProfileFlowStage } from "@/components/poju/BirthProfileFlow";
import PojuChat from "@/components/poju/PojuChat";
import { EditMessageDialog } from "@/components/poju/EditMessageDialog";
import { useAppDialog } from "@/components/ui/app-dialog";
import { ContextSummaryEditor } from "@/components/poju/ContextSummaryEditor";
import type { ContextSummary } from "@/lib/poju/agent-state";
import { OffTopicAction } from "@/components/poju/OffTopicAction";
import {
  resolveThinkingStreamMode,
  type ThinkingStreamMode,
} from "@/lib/poju/thinking-stream-mode";
import { ProfileSelector } from "@/components/profile/ProfileSelector";
import { getPojuDb } from "@/lib/db/poju-db";
import { createPOJUSession, loadPOJUSession, savePOJUSession, extendPOJUV4Session } from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId, readPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { runConfirmationPipeline, runPostTurnOrchestration } from "@/lib/poju/agent-orchestrator";
import { handleUserMessage, tryHandleRuleRejection } from "@/lib/poju/agent";
import { appendBirthFlowMessage } from "@/lib/poju/birth-flow-messages";
import {
  downgradePrematureConfirmationPhase,
  shouldShowContextSummaryForm,
} from "@/lib/poju/summary-readiness";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import {
  clearBirthFormActionIfProfileBound,
  lastAssistantRequestsBirthForm,
  resolveSessionHasProfile,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
import { applyPhaseTransition } from "@/lib/poju/agent-state";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { importCalculatedProfileAsStored, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
import { markPOJUV4SessionResolved } from "@/lib/poju/v4-lifecycle";
import { DEFAULT_NEW_SESSION_TITLE, formatSessionListPrimaryLine } from "@/lib/poju/session-list-label";
import { getActiveCycle, recordUserResponse } from "@/lib/poju/cycle-manager";
import { findPendingToolInjection } from "@/lib/poju/find-pending-tool-injection";
import { getToolSuggestionResponseState } from "@/lib/poju/tool-suggestion";
import type { POJUSessionState, POJUAction, POJUMessage, ToolName } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, requestSituationAnalysis } from "@/lib/llm/deepseek/situation-analysis";
import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";
import { rewindSessionToUserMessage } from "@/lib/poju/session-rewind";

/** Internal pipeline / phase UI — development only. */
const POJU_DEV_DEBUG = process.env.NODE_ENV === "development";
import "@/styles/topic-drift.css";

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

type ComposerImage = {
  name: string;
  dataUrl: string;
};

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export function POJUChatUI({ session, onSessionUpdate, locale }: Props) {
  const t = useTranslations("poju.chat");
  const dialog = useAppDialog();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [birthFlowStage, setBirthFlowStage] = useState<BirthProfileFlowStage | null>(null);
  const [birthAnalysisFailed, setBirthAnalysisFailed] = useState(false);
  const summaryIntroAppendedRef = useRef(false);
  const [summaryFormDismissed, setSummaryFormDismissed] = useState(false);
  const [extending, setExtending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sessionRows, setSessionRows] = useState<SessionListRow[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [composerImage, setComposerImage] = useState<ComposerImage | null>(null);
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
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [generationStopped, setGenerationStopped] = useState(false);
  const [showOffTopicAction, setShowOffTopicAction] = useState(false);
  const [driftReason, setDriftReason] = useState("");
  const [editDialog, setEditDialog] = useState<{ messageId: string; content: string } | null>(null);
  const openingInitRef = useRef(false);
  const toolResumeInitRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sendAbortRef = useRef<AbortController | null>(null);
  const sendGenerationRef = useRef(0);
  const router = useRouter();

  const scrollChatToBottom = useCallback((_behavior: ScrollBehavior = "smooth") => {
    /* PojuChat scrolls internally */
  }, []);

  const visibleMessages = session.messages.filter(
    (m) => m.role !== "system" && !m.content.trim().startsWith("[SYSTEM:"),
  );
  const hasUserMessage = visibleMessages.some((m) => m.role === "user");
  const birthFlowBlocking = birthFlowStage === "form" || birthFlowStage === "received" || birthFlowStage === "analyzing";
  const showSummaryForm =
    shouldShowContextSummaryForm(session) && !summaryFormDismissed && !session.main_delivery_done;
  const overlayFormOpen = birthFlowBlocking || showProfilePicker || showSummaryForm;

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
    if (resolveSessionHasProfile(session) || session.profile_skipped) {
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
    if (normalizeAgentPhase(session.agent_v2?.current_phase) !== "opening") return;
    if (visibleMessages.length > 0) return;
    if (sending || confirmBusy || pipelineBusy) return;

    openingInitRef.current = true;
    void triggerOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per empty opening session
  }, [session.session_id, session.agent_v2?.current_phase, visibleMessages.length]);

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
    setStreamingReply(null);
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
    setStreamingReply("");
    setGenerationStopped(false);

    try {
      let updated = await handleUserMessage({
        session: sessionRef.current,
        userMessage: "__OPENING__",
        locale,
        signal: ac.signal,
        onStream: {
          onReasoning: (text) => setLiveThinkingLine(text),
          onPartialResponse: (text) => {
            setStreamingReply(text);
            scrollChatToBottom("auto");
          },
        },
      });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      const orch = await runPostTurnOrchestration(updated, { locale });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      onSessionUpdate(orch.session);
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
        setStreamingReply(null);
      }
    }
  }

  async function runUserTurn(
    baseSession: POJUSessionState,
    userMessage: string,
    errorRestore?: { rollbackSession: POJUSessionState; typed: string; image: ComposerImage | null },
  ) {
    const gen = ++sendGenerationRef.current;
    const ac = new AbortController();
    sendAbortRef.current = ac;
    setSending(true);
    setThinkingMode(resolveThinkingStreamMode(baseSession, userMessage));
    setLiveThinkingLine(null);
    setStreamingReply("");
    setGenerationStopped(false);
    scrollChatToBottom("smooth");

    try {
      const updatedSession = await handleUserMessage({
        session: baseSession,
        userMessage,
        locale,
        userAlreadyAppended: true,
        signal: ac.signal,
        onStream: {
          onReasoning: (text) => setLiveThinkingLine(text),
          onPartialResponse: (text) => {
            setStreamingReply(text);
            scrollChatToBottom("auto");
          },
        },
      });
      if (ac.signal.aborted || gen !== sendGenerationRef.current) return;

      const userCount = updatedSession.messages.filter((m) => m.role === "user").length;
      let toPersist = updatedSession;
      if (userCount === 1 && updatedSession.original_question.trim() === DEFAULT_NEW_SESSION_TITLE) {
        const topic = topicFromFirstUserMessage(userMessage);
        if (topic) {
          toPersist = { ...updatedSession, original_question: topic };
          await getPojuDb().pojuSessionRecords.update(toPersist.session_id, {
            original_question: topic,
          });
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
        if (errorRestore.image) setComposerImage(errorRestore.image);
      }
      await dialog.alert(t("dialog_connection_error"));
    } finally {
      if (sendAbortRef.current === ac) sendAbortRef.current = null;
      if (gen === sendGenerationRef.current) {
        setSending(false);
        setThinkingMode(null);
        setLiveThinkingLine(null);
        setStreamingReply(null);
      }
    }
  }

  async function handlePojuSend(text: string) {
    const typed = text.trim();
    if (!typed || sending) return;
    const imageNote = composerImage ? `[Image attached: ${composerImage.name}]` : "";
    const userMessage = typed || imageNote;
    const baseSession = sessionRef.current;

    const rejected = tryHandleRuleRejection(baseSession, userMessage, locale);
    if (rejected) {
      setInput("");
      setComposerImage(null);
      onSessionUpdate(rejected);
      await savePOJUSession(rejected);
      return;
    }

    const savedComposerImage = composerImage;
    setInput("");
    setComposerImage(null);

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
      image: savedComposerImage,
    });
  }

  async function handleDeleteSession(targetSessionId: string) {
    if (!(await dialog.confirm(t("dialog_delete_session")))) return;
    await getPojuDb().pojuSessionRecords.delete(targetSessionId);
    setSessionRows((prev) => prev.filter((x) => x.session_id !== targetSessionId));
    if (targetSessionId === sessionRef.current.session_id) {
      router.push("/poju");
    }
  }

  function toggleSpeechInput() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      void dialog.alert(t("dialog_speech_unsupported"));
      return;
    }
    if (recognizing && speechRef.current) {
      speechRef.current.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (evt) => {
      let acc = "";
      for (let i = 0; i < evt.results.length; i += 1) acc += evt.results[i][0].transcript;
      setInput(acc);
    };
    rec.onend = () => setRecognizing(false);
    rec.onerror = () => setRecognizing(false);
    speechRef.current = rec;
    setRecognizing(true);
    rec.start();
  }

  async function handleAttachFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setComposerImage({ name: file.name, dataUrl });
    };
    reader.readAsDataURL(file);
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

    void generateBaseAnalysis(profileId)
      .then(() => {
        const cur = sessionRef.current;
        if (!cur.agent_v2) return;
        onSessionUpdate({
          ...cur,
          agent_v2: { ...cur.agent_v2, has_base_analysis: true, selected_profile_id: profileId },
        });
      })
      .catch((e) => console.warn("[poju] base analysis after profile select:", e));

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

  async function handleProfileSkipped() {
    const s = sessionRef.current;
    setBirthFlowStage(null);
    setShowProfilePicker(false);
    const updatedSession: POJUSessionState = {
      ...s,
      profile_skipped: true,
      selected_stored_profile_id: null,
      messages: [
        ...s.messages,
        {
          role: "system",
          content: "[User chose to skip birth info. Continue with generic analysis.]",
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const finalSession = await handleUserMessage({
      session: updatedSession,
      userMessage: "[SYSTEM: User skipped birth info. Continue with generic perspectives.]",
      locale,
    });
    onSessionUpdate(finalSession);
    await savePOJUSession(finalSession);
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

  async function handleExtendSession() {
    const sid = sessionRef.current.session_id;
    setExtending(true);
    try {
      const next = await extendPOJUV4Session(sid);
      if (next) {
        onSessionUpdate(next);
      }
    } finally {
      setExtending(false);
    }
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

  const pojuSessions = sessionRows.map((row) => ({
    id: row.session_id,
    title: formatSessionListPrimaryLine(row.created_at, row.original_question, locale),
  }));

  const pojuMessages = visibleMessages.map((m) => ({
    id: m.timestamp,
    role: m.role as "user" | "assistant",
    content: m.content,
    editable: m.role === "user" && !m.is_rejected,
  }));

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
          if (f) void handleAttachFile(f);
        }}
      />
      <PojuChat
        sessions={pojuSessions}
        currentSessionId={session.session_id}
        messages={pojuMessages}
        isStreaming={streaming}
        streamingText={streamingReply ?? undefined}
        thinkingMode={streaming ? thinkingMode : null}
        thinkingLocale={locale}
        liveThinkingLine={liveThinkingLine}
        thinkingWaitLabel={t("thinking_wait")}
        inputPlaceholder={t("input_placeholder")}
        composerText={input}
        onComposerTextChange={setInput}
        onSend={(text) => void handlePojuSend(text)}
        onNewSession={() => void handleCreateNewSession()}
        onSelectSession={(id) => router.push(`/poju/session/${id}`)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        onCopy={(text) => void copyChatText(text)}
        onSpeak={(text) => speakChatText(text)}
        onAttach={() => fileRef.current?.click()}
        onVoice={toggleSpeechInput}
        onStop={handleStopGeneration}
        newSessionDisabled={creatingSession}
        onEditMessage={(id, content) => void handleEditUserMessage(id, content)}
        editDisabled={streaming}
        editLabel={t("edit_message")}
        onClose={() => router.push("/poju")}
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
          ) : null
        }
      />

      <EditMessageDialog
        open={editDialog !== null}
        title={t("edit_message_title")}
        description={t("edit_message_prompt")}
        defaultValue={editDialog?.content ?? ""}
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={(value) => void confirmEditUserMessage(value)}
        onCancel={() => setEditDialog(null)}
      />

      <div
        style={{
          position: "fixed",
          top: 72,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          width: "min(1100px, calc(100vw - 32px))",
        }}
      >
        <SessionExpiryNotice session={session} extending={extending} onExtend={() => void handleExtendSession()} />
      </div>

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
                  allowSkip
                  onSelected={(id) => void handleStoredProfileSelected(id)}
                  onSkip={() => void handleProfileSkipped()}
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
                onSkip={() => void handleProfileSkipped()}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

async function copyChatText(text: string): Promise<void> {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fallback below */
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function speakChatText(text: string): void {
  if (typeof window === "undefined" || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = /[\u4e00-\u9fff]/.test(text) ? "zh-CN" : "en-US";
  window.speechSynthesis.speak(utterance);
}

function topicFromFirstUserMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("[Image attached:")) return "Image";
  const max = 72;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
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

function SessionExpiryNotice({
  session,
  extending,
  onExtend,
}: {
  session: POJUSessionState;
  extending: boolean;
  onExtend: () => void;
}) {
  const tExpiry = useTranslations("poju.expiry");
  const now = Date.now();
  const expiresAt = new Date(session.expires_at).getTime();
  const msLeft = expiresAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft > 7 || daysLeft <= 0) return null;

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-50/95">
      <p className="m-0">{tExpiry("expires_in", { days: daysLeft })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={extending}
          onClick={onExtend}
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-50"
        >
          {extending ? tExpiry("extending") : tExpiry("extend_30")}
        </button>
      </div>
    </div>
  );
}

