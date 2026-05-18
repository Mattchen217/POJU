"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import pojuLogo from "@/assets/images/POJUlogo.png";
import { BirthProfileFlow, type BirthProfileFlowStage } from "@/components/poju/BirthProfileFlow";
import { useAppDialog } from "@/components/ui/app-dialog";
import { ContextSummaryEditor } from "@/components/poju/ContextSummaryEditor";
import type { ContextSummary } from "@/lib/poju/agent-state";
import { MessageBubble } from "@/components/poju/MessageBubble";
import { ThinkingProcessDetails } from "@/components/poju/ThinkingProcessDetails";
import { ProfileSelector } from "@/components/profile/ProfileSelector";
import { getPojuDb } from "@/lib/db/poju-db";
import { createPOJUSession, loadPOJUSession, savePOJUSession, extendPOJUV4Session } from "@/lib/poju/session-manager";
import { clearPendingStoredProfileId, readPendingStoredProfileId } from "@/lib/poju/pending-stored-profile";
import { runConfirmationPipeline, runPostTurnOrchestration } from "@/lib/poju/agent-orchestrator";
import { handleUserMessage, tryHandleRuleRejection } from "@/lib/poju/agent";
import { appendBirthFlowMessage } from "@/lib/poju/birth-flow-messages";
import { getLastUserMessageContent } from "@/lib/poju/context-readiness";
import {
  clearBirthFormActionIfProfileBound,
  resolveSessionHasProfile,
  shouldForceBirthForm,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
import { applyPhaseTransition } from "@/lib/poju/agent-state";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { importCalculatedProfileAsStored, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
import { markPOJUV4SessionResolved } from "@/lib/poju/v4-lifecycle";
import { DEFAULT_NEW_SESSION_TITLE, formatSessionListPrimaryLine } from "@/lib/poju/session-list-label";
import type { POJUSessionState, POJUAction, POJUMessage } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { getCachedSituationAnalysis, requestSituationAnalysis } from "@/lib/llm/deepseek/situation-analysis";
import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";

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
  const birthFlowPendingRef = useRef(false);
  const birthIntroAppendedRef = useRef(false);
  const [extending, setExtending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [sessionRows, setSessionRows] = useState<SessionListRow[]>([]);
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const router = useRouter();

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
      });
    });
  }, []);

  const visibleMessages = session.messages.filter((m) => m.role !== "system");
  const hasUserMessage = visibleMessages.some((m) => m.role === "user");
  const shouldHideWelcomePanel = hasUserMessage;
  const birthFlowBlocking = birthFlowStage === "form" || birthFlowStage === "received" || birthFlowStage === "analyzing";
  const overlayFormOpen = birthFlowBlocking || showProfilePicker;
  const lastDeliveryTs = [...visibleMessages]
    .reverse()
    .find((m) => m.role === "assistant" && m.meta?.contains_delivery)?.timestamp;

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
      birthFlowPendingRef.current = false;
      birthIntroAppendedRef.current = false;
      return;
    }
    if (session.profile_skipped || sending || birthFlowBlocking) return;

    const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
    const lastUser = getLastUserMessageContent(session);
    const wantsBirthFlow =
      birthFlowPendingRef.current ||
      lastAssistant?.meta?.action_requested === "show_birth_form" ||
      shouldForceBirthForm(session, lastUser);

    if (!wantsBirthFlow) return;

    if (!birthFlowStage) {
      if (!birthIntroAppendedRef.current) {
        birthIntroAppendedRef.current = true;
        const withIntro = clearBirthFormActionIfProfileBound(appendBirthFlowMessage(session, locale, "intro"));
        onSessionUpdate(withIntro);
        void savePOJUSession(withIntro);
      }
      setBirthFlowStage("intro");
    }
  }, [session, locale, sending, birthFlowStage, birthFlowBlocking]);

  useEffect(() => {
    if (!overlayFormOpen) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [overlayFormOpen]);


  async function handleSend() {
    if ((!input.trim() && !composerImage) || sending) return;
    const typed = input.trim();
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
    setSending(true);
    scrollChatToBottom("smooth");

    try {
      const updatedSession = await handleUserMessage({
        session: withUser,
        userMessage,
        locale,
        userAlreadyAppended: true,
      });
      const userCount = updatedSession.messages.filter((m) => m.role === "user").length;
      let toPersist = updatedSession;
      if (
        userCount === 1 &&
        updatedSession.original_question.trim() === DEFAULT_NEW_SESSION_TITLE
      ) {
        const topic = topicFromFirstUserMessage(userMessage);
        if (topic) {
          toPersist = { ...updatedSession, original_question: topic };
          await getPojuDb().pojuSessionRecords.update(toPersist.session_id, {
            original_question: topic,
          });
          setSessionRows((prev) =>
            prev.map((x) =>
              x.session_id === toPersist.session_id ? { ...x, original_question: topic } : x,
            ),
          );
        }
      }
      const orch = await runPostTurnOrchestration(toPersist, {
        locale,
        lastUserMessage: userMessage,
      });
      onSessionUpdate(orch.session);
      await savePOJUSession(orch.session);
      if (!resolveSessionHasProfile(orch.session)) {
        if (orch.ui.showBirthForm) birthFlowPendingRef.current = true;
        if (orch.ui.showProfilePicker) setShowProfilePicker(true);
      }
      if (orch.ui.pipelineNotice) setSituationNotice(orch.ui.pipelineNotice);
      if (orch.ui.pipelineError) setSituationError(orch.ui.pipelineError);
      setPipelineBusy(orch.ui.pipelineBusy);
    } catch (err) {
      console.error("[poju] Send failed:", err);
      onSessionUpdate(baseSession);
      setInput(typed);
      if (savedComposerImage) setComposerImage(savedComposerImage);
      await dialog.alert(t("dialog_connection_error"));
    } finally {
      setSending(false);
    }
  }

  async function handleRenameSession(targetSessionId: string) {
    const row = sessionRows.find((s) => s.session_id === targetSessionId);
    const nextQuestion = await dialog.prompt(
      t("dialog_rename_session"),
      row?.original_question ?? "",
      t("dialog_rename_placeholder"),
    );
    if (!nextQuestion) return;
    const value = nextQuestion.trim();
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
    setSessionRows((prev) => prev.map((x) => (x.session_id === targetSessionId ? { ...x, original_question: value } : x)));
    setSessionMenuId(null);
  }

  async function handleDeleteSession(targetSessionId: string) {
    if (!(await dialog.confirm(t("dialog_delete_session")))) return;
    await getPojuDb().pojuSessionRecords.delete(targetSessionId);
    setSessionRows((prev) => prev.filter((x) => x.session_id !== targetSessionId));
    setSessionMenuId(null);
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
      setSidebarOpenMobile(false);
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
      ({ profile_id } = await importCalculatedProfileAsStored({
        profile,
        display_name: `${profile.birth.year}-${profile.birth.month}-${profile.birth.day}`,
        relationship: "self",
      }));
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
        const transitioned =
          updatedSession.agent_v2.current_phase === "awaiting_profile" ||
          updatedSession.agent_v2.current_phase === "greeting"
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
    let analyzingSession = appendBirthFlowMessage(updatedSession, locale, "analyzing");
    onSessionUpdate(analyzingSession);
    await savePOJUSession(analyzingSession);
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
        analyzingSession = withAnalysis;
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

    birthFlowPendingRef.current = false;
    birthIntroAppendedRef.current = false;

    window.setTimeout(() => {
      setBirthFlowStage(null);
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
    birthFlowPendingRef.current = false;
    birthIntroAppendedRef.current = false;
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
        updatedSession.agent_v2.current_phase === "awaiting_profile" ||
        updatedSession.agent_v2.current_phase === "greeting"
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
    setFinalError(null);
    setSituationError(null);
    try {
      const base = sessionRef.current;
      const withSummary: POJUSessionState = base.agent_v2
        ? { ...base, agent_v2: { ...base.agent_v2, current_summary: editedSummary } }
        : base;
      onSessionUpdate(withSummary);
      const next = await runConfirmationPipeline(withSummary, locale);
      onSessionUpdate(next);
      await savePOJUSession(next);
      setSituationNotice(t("final_delivery_done"));
    } catch (e) {
      setFinalError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleSummaryAddMore(note: string) {
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
    if (!phase) return "agent_phase_greeting";
    const map: Record<string, string> = {
      greeting: "agent_phase_greeting",
      awaiting_profile: "agent_phase_awaiting_profile",
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
    birthFlowPendingRef.current = false;
    birthIntroAppendedRef.current = false;
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
      const next = await runFinalDeliveryForSession(sessionRef.current, locale);
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

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-on-surface">
      {sidebarOpenMobile ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpenMobile(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <div className="flex h-full w-full">
        <aside
          className={`${
            sidebarCollapsed ? "md:w-20" : "md:w-[280px]"
          } fixed left-0 top-0 z-40 flex h-full w-[86%] max-w-sm flex-col border-r border-outline-variant bg-surface shadow-[1px_0_15px_rgba(0,0,0,0.2)] transition-all duration-200 md:static md:max-w-none ${
            sidebarOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-outline-variant/50 px-4">
            <div className={`${sidebarCollapsed ? "md:hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
                  <Image src={pojuLogo} alt="" width={64} height={64} className="object-cover" />
                </span>
                <p className="text-base font-semibold tracking-tight text-white">POJU</p>
              </div>
            </div>
            <button
              type="button"
              className="hidden rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface md:inline-flex"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label="Toggle sidebar"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">menu</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 py-4">
            <div className="mb-6 px-2">
              <button
                type="button"
                className={`w-full rounded-xl bg-gradient-to-r from-[#d831ff] via-[#8a3ffc] to-[#0f62fe] px-4 py-3 shadow-lg shadow-[#6b21a8]/25 transition-opacity hover:opacity-95 ${
                  sidebarCollapsed ? "md:px-0" : ""
                }`}
                onClick={() => void handleCreateNewSession()}
                disabled={creatingSession}
              >
                <div className={`flex items-center justify-between ${sidebarCollapsed ? "md:hidden" : ""}`}>
                  <span className="text-sm font-bold text-white">{creatingSession ? "Creating..." : "+ New POJU"}</span>
                  <span className="rounded bg-primary px-2 py-1 text-xs font-bold text-on-primary">$9.99</span>
                </div>
                <span className="hidden md:inline">{sidebarCollapsed ? (creatingSession ? "…" : "+") : ""}</span>
              </button>
            </div>

            <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">Sessions</p>
            <div className="flex flex-col gap-1">
              {sessionRows.map((row) => (
                <div
                  key={row.session_id}
                  className={`rounded-lg ${
                    row.session_id === session.session_id
                      ? "border border-primary/30 bg-surface-container-high"
                      : "border border-transparent hover:border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center gap-2 p-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        router.push(`/poju/session/${row.session_id}`);
                        setSidebarOpenMobile(false);
                      }}
                    >
                      <p className="truncate text-sm text-on-surface">
                        {formatSessionListPrimaryLine(row.created_at, row.original_question, locale)}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      onClick={() => setSessionMenuId((prev) => (prev === row.session_id ? null : row.session_id))}
                      aria-label="Open session menu"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">more_horiz</span>
                    </button>
                  </div>
                  {sessionMenuId === row.session_id ? (
                    <div className="mx-2 mb-2 grid gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1.5 text-xs">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1.5 text-left text-on-surface-variant hover:bg-surface-container-high"
                        onClick={() => void handleRenameSession(row.session_id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1.5 text-left text-red-300 hover:bg-red-500/10"
                        onClick={() => void handleDeleteSession(row.session_id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col bg-background">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-background/80 px-4 backdrop-blur-md md:px-8">
            <div className="mx-auto flex w-full max-w-[800px] items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpenMobile(true)}
                  className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface md:hidden"
                  aria-label="Open sidebar"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">menu</span>
                </button>
                <p className="truncate text-sm text-on-surface">
                  {formatSessionListPrimaryLine(session.created_at, session.original_question, locale)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
                  <span className="material-symbols-outlined text-[20px] leading-none">share</span>
                </button>
                <Link
                  href="/poju"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  aria-label="Close session"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">close</span>
                </Link>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 md:px-8">
            <div
              className={`mx-auto flex w-full max-w-[800px] flex-col gap-6 py-6 ${overlayFormOpen ? "pb-8" : "pb-36"}`}
            >
              <SessionExpiryNotice session={session} extending={extending} onExtend={() => void handleExtendSession()} />

              {session.agent_v2 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-xs">
                  <span className="text-on-surface-variant">{t("agent_phase_label")}:</span>
                  <span className="rounded-md bg-primary/20 px-2 py-0.5 font-medium text-primary">{t(agentPhaseKey())}</span>
                  {session.agent_v2.has_base_analysis ? <span className="text-emerald-300/90">Step 7 ✓</span> : null}
                  {session.agent_v2.has_situation_analysis ? <span className="text-cyan-300/90">Step 8 ✓</span> : null}
                  {session.main_delivery_done ? <span className="text-violet-300/90">Step 9 ✓</span> : null}
                  {pipelineBusy || confirmBusy ? <span className="text-amber-200/90">{t("pipeline_busy")}</span> : null}
                </div>
              ) : null}

              {session.agent_v2?.current_phase === "awaiting_confirmation" &&
              session.agent_v2.current_summary &&
              !session.main_delivery_done ? (
                <ContextSummaryEditor
                  summary={session.agent_v2.current_summary}
                  busy={confirmBusy || pipelineBusy}
                  onConfirm={(edited) => void handleConfirmSummary(edited)}
                  onAddMore={(note) => void handleSummaryAddMore(note)}
                />
              ) : null}

              {showProfilePicker ? (
                <div className="rounded-2xl border border-violet-300/20 bg-violet-950/30 p-3">
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

              {situationNotice || situationError || finalError ? (
                <p className="text-xs text-on-surface-variant">
                  {situationNotice ? <span className="text-cyan-200/90">{situationNotice} </span> : null}
                  {situationError ? <span className="text-red-300">{situationError} </span> : null}
                  {finalError ? <span className="text-red-300">{finalError}</span> : null}
                </p>
              ) : null}

              {session.agent_v2 && !session.main_delivery_done ? (
                <details className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs text-on-surface-variant">
                  <summary className="cursor-pointer text-on-surface">{t("advanced_pipeline")}</summary>
                  <p className="mt-2 text-on-surface">{t("situation_analysis_hint")}</p>
                  {situationFp && getCachedSituationAnalysis(session, situationFp) ? (
                    <p className="mt-1 text-emerald-200/90">{t("situation_analysis_have_cache")}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-white/50">{t("final_delivery_hint")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={situationBusy}
                      className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-100 disabled:opacity-50"
                      onClick={() => void handleSituationAnalysis(false)}
                    >
                      {situationBusy ? t("situation_analysis_running") : t("situation_analysis_run")}
                    </button>
                    {situationFp && getCachedSituationAnalysis(session, situationFp) ? (
                      <button
                        type="button"
                        disabled={situationBusy}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-on-surface-variant disabled:opacity-50"
                        onClick={() => void handleSituationAnalysis(true)}
                      >
                        {t("situation_analysis_force")}
                      </button>
                    ) : null}
                    {situationFp && getCachedSituationAnalysis(session, situationFp) && !session.main_delivery_done ? (
                      <button
                        type="button"
                        disabled={finalBusy || situationBusy}
                        className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100 disabled:opacity-50"
                        onClick={() => void handleFinalDelivery()}
                      >
                        {finalBusy ? t("final_delivery_running") : t("final_delivery_run")}
                      </button>
                    ) : null}
                  </div>
                </details>
              ) : null}

              {visibleMessages.map((msg, idx) => (
                <MessageBubble
                  key={`${msg.timestamp}-${idx}`}
                  message={msg}
                  hideWelcomePanel={shouldHideWelcomePanel}
                  actions={msg.role === "assistant" && msg.meta?.contains_delivery && msg.timestamp === lastDeliveryTs ? session.actions : undefined}
                  onActionUpdate={(id, st, fb) => void handleActionUpdate(id, st, fb)}
                />
              ))}
              {sending ? (
                <ThinkingProcessDetails open pulseIcon waitingLabel={t("thinking_waiting")} />
              ) : null}

              {birthFlowStage ? (
                <div className="rounded-2xl border border-violet-300/20 bg-violet-950/30 p-3">
                  <BirthProfileFlow
                    stage={birthFlowStage}
                    analysisFailed={birthAnalysisFailed}
                    onContinueToForm={() => setBirthFlowStage("form")}
                    onComplete={(p) => void handleProfileSubmitted(p)}
                    onSkip={() => void handleProfileSkipped()}
                  />
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {!overlayFormOpen ? (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center bg-gradient-to-t from-background via-background/90 to-transparent p-4 md:p-6">
            <div className="pointer-events-auto w-full max-w-[800px]">
              {composerImage ? (
                <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-highest px-2 py-1 text-xs text-on-surface-variant">
                  <img src={composerImage.dataUrl} alt={composerImage.name} className="h-8 w-8 rounded object-cover" />
                  <span className="max-w-40 truncate">{composerImage.name}</span>
                  <button type="button" className="text-on-surface-variant hover:text-on-surface" onClick={() => setComposerImage(null)}>
                    ×
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container/60 p-2 backdrop-blur-xl">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Attach image"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">attach_file</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAttachFile(f);
                  }}
                />

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={t("input_placeholder")}
                  disabled={sending}
                  rows={1}
                  className="max-h-[150px] min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                />
                <button
                  type="button"
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                    recognizing ? "text-red-300" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                  onClick={toggleSpeechInput}
                  aria-label="Voice input"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">mic</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={(!input.trim() && !composerImage) || sending}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
          ) : null}
        </section>
      </div>
    </div>
  );
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

