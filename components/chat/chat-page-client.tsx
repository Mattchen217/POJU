"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearLegacySnapshot,
  clearSecureChatSnapshot,
  loadLegacySnapshot,
  loadSecureChatSnapshot,
  saveSecureChatSnapshot,
} from "@/lib/chat/secure-storage";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { useChatStore } from "@/lib/store/chat-store";
import type { ChatMessage, ChatSession, DrawerKind } from "@/lib/chat/types";
import { siteConfig } from "@/lib/config/site";
import type { ArchiveEntry } from "@/lib/archive/types";
import { PojuDataCollectionForm } from "@/components/poju/poju-data-collection-form";
import { PojuRenewalBanner } from "@/components/poju/poju-renewal-banner";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { getUserProfile } from "@/lib/profile/storage";
import type { ActionItem } from "@/lib/poju/types";

type ComposerImage = { id: string; dataUrl: string; name: string };
const ARCHIVE_RUNTIME_KEY = "pojulife_archive_runtime_v1";
const EMAIL_SCHEMA = z.string().email();
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

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

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function seedSession(): ChatSession {
  return {
    id: uid("sess"),
    title: "New session",
    createdAt: Date.now(),
    hidden: false,
    status: "active",
    pdfSaves: 0,
  };
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateGroup(ts: number): "Today" | "Yesterday" | "Previous Sessions" {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const val = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.floor((today - val) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return "Previous Sessions";
}

function sessionListIcon(group: "Today" | "Yesterday" | "Previous Sessions", isActive: boolean) {
  const name = group === "Today" ? "history" : group === "Yesterday" ? "schedule" : "folder_open";
  const cls =
    group === "Today" && isActive
      ? "text-violet-400"
      : "text-neutral-400 group-hover/session-row:text-white";
  return (
    <span className={`material-symbols-outlined shrink-0 text-[20px] leading-none ${cls}`}>
      {name}
    </span>
  );
}

export function ChatPageClient() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const speakRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsForIdRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mysticalToolsOpen, setMysticalToolsOpen] = useState(false);
  const sessions = useChatStore((s) => s.sessions);
  const messages = useChatStore((s) => s.messages);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setAll = useChatStore((s) => s.setAll);
  const setSessions = useChatStore((s) => s.setSessions);
  const setMessages = useChatStore((s) => s.setMessages);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const [composer, setComposer] = useState("");
  const [composerImage, setComposerImage] = useState<ComposerImage | null>(null);
  const [thinkingLines, setThinkingLines] = useState<string[]>([]);
  const [thinkingVisible, setThinkingVisible] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [ttsPlayingId, setTtsPlayingId] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [inlineRenameId, setInlineRenameId] = useState<string | null>(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const inlineRenameEscapeRef = useRef(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfEmail, setPdfEmail] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [sentToast, setSentToast] = useState("");
  const [welcomeToast, setWelcomeToast] = useState(false);
  const [sessionMenu, setSessionMenu] = useState<{ sessionId: string; top: number; right: number } | null>(null);
  const [exportHistorySessionId, setExportHistorySessionId] = useState<string | null>(null);
  const [exportHistoryEmail, setExportHistoryEmail] = useState("");
  const [exportHistoryError, setExportHistoryError] = useState("");
  const [pojuActionsBySession, setPojuActionsBySession] = useState<Record<string, ActionItem[]>>({});
  const [pojuSessionUi, setPojuSessionUi] = useState<Record<string, { phase: number; showDataForm: boolean }>>({});
  const [pojuRenewalHintBySession, setPojuRenewalHintBySession] = useState<
    Record<string, { expiresAt: number; show: boolean }>
  >({});
  const [pojuRenewalDismissed, setPojuRenewalDismissed] = useState<Record<string, boolean>>({});
  const [pojuExtendBusy, setPojuExtendBusy] = useState(false);

  useEffect(() => {
    let stop = false;

    const token = searchParams.get("token");

    const bootstrap = async () => {
      const sid = searchParams.get("sid");
      if (sid) {
        const r = await fetch(`/api/poju/session?sessionId=${encodeURIComponent(sid)}`);
        const d = (await r.json()) as {
          ok?: boolean;
          sessionId?: string;
          expiresAt?: number;
          showRenewalPrompt?: boolean;
        };
        if (stop) return;
        if (r.ok && d.ok && d.sessionId) {
          const row = seedSession();
          row.id = d.sessionId;
          setAll({
            sessions: [row],
            messages: [],
            activeSessionId: d.sessionId,
          });
          if (typeof d.expiresAt === "number") {
            setPojuRenewalHintBySession({
              [d.sessionId]: {
                expiresAt: d.expiresAt,
                show: Boolean(d.showRenewalPrompt),
              },
            });
          }
          setReady(true);
          router.replace("/chat");
          return;
        }
      }

      const secure = await loadSecureChatSnapshot();
      if (stop) return;
      if (secure) {
        setAll({
          sessions: secure.sessions || [],
          messages: secure.messages || [],
          activeSessionId: secure.activeSessionId || "",
        });
        setReady(true);
        return;
      }

      const legacy = loadLegacySnapshot();
      if (legacy) {
        setAll({
          sessions: legacy.sessions || [],
          messages: legacy.messages || [],
          activeSessionId: legacy.activeSessionId || "",
        });
        // 迁移到加密 IndexedDB 后清理旧明文快照
        clearLegacySnapshot();
      }

      const hasAny = Boolean(((secure as any)?.sessions?.length ?? 0) || ((legacy as any)?.sessions?.length ?? 0));
      if (!token && !hasAny) {
        setReady(true);
        router.replace("/poju");
        return;
      }
      if (token && !hasAny) {
        const profile = await getUserProfile();
        const created = await fetch("/api/poju/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId: getPojuDeviceId(), userProfile: profile ?? undefined }),
        });
        const data = (await created.json()) as { sessionId?: string };
        const first = seedSession();
        first.id = data.sessionId ?? first.id;
        setSessions(() => [first]);
        setActiveSessionId(first.id);
      }
      setReady(true);
    };

    void bootstrap();

    return () => {
      stop = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!ready || !sessions.length || !activeSessionId) return;
    void saveSecureChatSnapshot({ sessions, messages, activeSessionId });
  }, [ready, sessions, messages, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    const key = `pojulife_chat_welcome_seen_${activeSessionId}`;
    if (!localStorage.getItem(key)) setWelcomeToast(true);
  }, [activeSessionId]);

  useEffect(() => {
    const from = searchParams.get("from");
    const kind = searchParams.get("kind");
    const entry = searchParams.get("entry");
    if (from !== "archive" || kind !== "poju" || !entry || !sessions.length) return;
    try {
      const raw = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
      const list = raw ? (JSON.parse(raw) as ArchiveEntry[]) : [];
      const archiveRow = list.find((x) => x.id === entry && x.kind === "poju");
      const targetId = archiveRow?.refId || entry;
      const hit = sessions.find((s) => s.id === targetId);
      if (hit) setActiveSessionId(hit.id);
    } catch {
      const fallback = sessions.find((s) => s.id === entry);
      if (fallback) setActiveSessionId(fallback.id);
    }
  }, [searchParams, sessions, setActiveSessionId]);

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId), [sessions, activeSessionId]);
  const pojuActions = useMemo(
    () => (activeSessionId ? pojuActionsBySession[activeSessionId] ?? [] : []),
    [activeSessionId, pojuActionsBySession],
  );
  const activeMessages = useMemo(
    () => messages.filter((m) => m.sessionId === activeSessionId),
    [messages, activeSessionId],
  );

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinkingLines, activeSessionId, activeMessages.length, pojuSessionUi]);
  const groupedSessions = useMemo(() => {
    const visible = sessions.filter((s) => !s.hidden || s.id === activeSessionId).sort((a, b) => b.createdAt - a.createdAt);
    return {
      Today: visible.filter((s) => dateGroup(s.createdAt) === "Today"),
      Yesterday: visible.filter((s) => dateGroup(s.createdAt) === "Yesterday"),
      "Previous Sessions": visible.filter((s) => dateGroup(s.createdAt) === "Previous Sessions"),
    };
  }, [sessions, activeSessionId]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const onPojuDataCollectComplete = useCallback(
    (payload: { reply: string; phase: number }) => {
      if (!activeSessionId) return;
      appendMessage({
        id: uid("msg"),
        sessionId: activeSessionId,
        role: "assistant",
        text: payload.reply,
        createdAt: Date.now(),
        phaseFive: payload.phase >= 5,
      });
      setPojuSessionUi((prev) => ({
        ...prev,
        [activeSessionId]: { phase: payload.phase, showDataForm: false },
      }));
      if (payload.phase >= 5) {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, title: "Action tracking" } : s)),
        );
      }
    },
    [activeSessionId, appendMessage, setSessions],
  );

  const updatePojuActionStatus = useCallback(
    async (actionId: string, status: ActionItem["status"]) => {
      if (!activeSessionId) return;
      const res = await fetch("/api/poju/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId, actionId, status }),
      });
      const data = (await res.json()) as { actions?: ActionItem[] };
      if (res.ok && data.actions) {
        setPojuActionsBySession((prev) => ({ ...prev, [activeSessionId]: data.actions! }));
      }
    },
    [activeSessionId],
  );

  const simulateAssistant = useCallback(
    async (input: string) => {
      setThinkingVisible(true);
      setThinkingLines(["Reading session state...", "Routing current phase...", "Composing response..."]);
      const profile = await getUserProfile();
      const res = await fetch("/api/poju/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          input,
          locale,
          userProfile: profile ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        phase?: number;
        status?: "active" | "suspended" | "resolved" | "archived";
        actions?: ActionItem[];
        showDataForm?: boolean;
        expiresAt?: number;
        showRenewalPrompt?: boolean;
        error?: string;
      };
      setThinkingVisible(false);
      setThinkingLines([]);
      if (!res.ok) {
        appendMessage({
          id: uid("msg"),
          sessionId: activeSessionId,
          role: "assistant",
          text: `Session error: ${data.error ?? "unknown_error"}`,
          createdAt: Date.now(),
        });
        return;
      }
      if (data.actions && activeSessionId) {
        setPojuActionsBySession((prev) => ({ ...prev, [activeSessionId]: data.actions! }));
      }
      if (activeSessionId) {
        setPojuSessionUi((prev) => ({
          ...prev,
          [activeSessionId]: {
            phase: data.phase ?? 1,
            showDataForm: Boolean(data.showDataForm),
          },
        }));
        if (typeof data.expiresAt === "number") {
          setPojuRenewalHintBySession((prev) => ({
            ...prev,
            [activeSessionId]: {
              expiresAt: data.expiresAt!,
              show: Boolean(data.showRenewalPrompt),
            },
          }));
        }
      }

      const shouldPhaseFive = (data.phase ?? 1) >= 5;
      appendMessage({
        id: uid("msg"),
        sessionId: activeSessionId,
        role: "assistant",
        text: data.reply ?? "",
        createdAt: Date.now(),
        phaseFive: shouldPhaseFive,
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                title: shouldPhaseFive ? "Action tracking" : s.title,
                status: data.status ?? s.status,
              }
            : s,
        ),
      );
    },
    [activeSessionId, appendMessage, locale, setSessions],
  );

  const extendPojuActiveSession = useCallback(async () => {
    if (!activeSessionId) return;
    setPojuExtendBusy(true);
    try {
      const res = await fetch("/api/poju/extend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
      });
      const data = (await res.json()) as { ok?: boolean; expiresAt?: number };
      if (res.ok && data.ok && typeof data.expiresAt === "number") {
        setPojuRenewalHintBySession((prev) => ({
          ...prev,
          [activeSessionId]: { expiresAt: data.expiresAt!, show: false },
        }));
      }
    } finally {
      setPojuExtendBusy(false);
    }
  }, [activeSessionId]);

  const onSend = useCallback(async () => {
    if (!composer.trim() && !composerImage) return;
    if (!activeSessionId) return;
    const text = composer.trim();
    appendMessage({
      id: uid("msg"),
      sessionId: activeSessionId,
      role: "user",
      text: text || "Image attachment",
      createdAt: Date.now(),
      imageDataUrl: composerImage?.dataUrl,
    });
    setComposer("");
    setComposerImage(null);
    await simulateAssistant(text);
  }, [activeSessionId, appendMessage, composer, composerImage, messages, simulateAssistant]);

  const newSession = () => {
    void (async () => {
      const profile = await getUserProfile();
      const created = await fetch("/api/poju/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: getPojuDeviceId(), userProfile: profile ?? undefined }),
      });
      const data = (await created.json()) as { sessionId?: string };
      const s = seedSession();
      s.id = data.sessionId ?? s.id;
      setSessions((prev) => [s, ...prev]);
      setActiveSessionId(s.id);
      setPojuActionsBySession((prev) => ({ ...prev, [s.id]: [] }));
      setPojuSessionUi((prev) => ({ ...prev, [s.id]: { phase: 1, showDataForm: false } }));
      setMessages((prev) => prev);
    })();
  };

  const renameSession = () => {
    if (!activeSession) return;
    const val = renameValue.trim().slice(0, 40);
    if (!val) return;
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, title: val } : s)));
    setRenameOpen(false);
  };

  const commitInlineRename = useCallback(() => {
    if (!inlineRenameId) return;
    const val = inlineRenameValue.trim().slice(0, 40);
    if (!val) {
      setInlineRenameId(null);
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === inlineRenameId ? { ...s, title: val } : s)));
    setInlineRenameId(null);
  }, [inlineRenameId, inlineRenameValue, setSessions]);

  const purgeSessionById = useCallback(
    (sid: string) => {
      setMessages((prev) => prev.filter((m) => m.sessionId !== sid));
      setPojuActionsBySession((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
      setPojuSessionUi((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
      setPojuRenewalHintBySession((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
      setPojuRenewalDismissed((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
      const remaining = sessions.filter((s) => s.id !== sid);
      setSessions(() => remaining);
      try {
        localStorage.removeItem(`pojulife_chat_welcome_seen_${sid}`);
      } catch {
        //
      }
      if (!remaining.length) {
        clearLegacySnapshot();
        void clearSecureChatSnapshot();
        router.replace("/");
        return;
      }
      if (sid === activeSessionId) {
        setActiveSessionId(remaining[0].id);
      }
    },
    [sessions, activeSessionId, setMessages, setSessions, setActiveSessionId, router],
  );

  const wipeSession = () => {
    if (!activeSession) return;
    purgeSessionById(activeSession.id);
    setWipeOpen(false);
  };

  const confirmSidebarDeleteSession = () => {
    if (!deleteTargetId) return;
    purgeSessionById(deleteTargetId);
    setDeleteTargetId(null);
    setMobileDrawer(false);
  };

  const archiveActiveSession = () => {
    if (!activeSession) return;
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, status: "archived" } : s)));
    try {
      const raw = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
      const list = raw ? (JSON.parse(raw) as ArchiveEntry[]) : [];
      const msgCount = messages.filter((m) => m.sessionId === activeSession.id).length;
      const row: ArchiveEntry = {
        id: `poju_archive_${Date.now()}`,
        kind: "poju",
        createdAt: Date.now(),
        title: `${formatDate(Date.now())} · POJU`,
        subtitle: `"${activeSession.title}" · Archived · ${msgCount} messages`,
        refId: activeSession.id,
      };
      localStorage.setItem(ARCHIVE_RUNTIME_KEY, JSON.stringify([row, ...list].slice(0, 120)));
    } catch {
      // ignore
    }
  };

  const savePdf = (withCheckin: boolean) => {
    if (!activeSession) return;
    const parsed = EMAIL_SCHEMA.safeParse(pdfEmail.trim());
    if (!parsed.success) {
      setPdfError("Please enter a valid email address.");
      return;
    }
    if (activeSession.pdfSaves >= 5) {
      setPdfError("You've saved this 5 times. Ready to close this chapter?");
      return;
    }
    setPdfError("");
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, pdfSaves: s.pdfSaves + 1 } : s)));
    const hidden = parsed.data.replace(/(.{2}).+(@.+)/, "$1***$2");
    setSentToast(`Sent to ${hidden}${withCheckin ? " + one check-in" : ""}`);
    setPdfOpen(false);
    setTimeout(() => setSentToast(""), 3000);
  };

  const submitExportChatHistory = () => {
    if (!exportHistorySessionId) return;
    const parsed = EMAIL_SCHEMA.safeParse(exportHistoryEmail.trim());
    if (!parsed.success) {
      setExportHistoryError("Please enter a valid email address.");
      return;
    }
    setExportHistoryError("");
    const hidden = parsed.data.replace(/(.{2}).+(@.+)/, "$1***$2");
    const sess = sessions.find((x) => x.id === exportHistorySessionId);
    setSentToast(`We'll email the complete chat history for "${sess?.title ?? "this session"}" to ${hidden}.`);
    setExportHistorySessionId(null);
    setExportHistoryEmail("");
    setTimeout(() => setSentToast(""), 5000);
  };

  useEffect(() => {
    if (!sessionMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSessionMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionMenu]);

  useEffect(() => {
    if (!sessionMenu) return;
    if (!sessions.some((x) => x.id === sessionMenu.sessionId)) setSessionMenu(null);
  }, [sessionMenu, sessions]);

  const onAttachFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setComposerImage({ id: uid("img"), dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const toggleSpeech = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
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
      setComposer(acc);
    };
    rec.onend = () => setRecognizing(false);
    rec.onerror = () => setRecognizing(false);
    speechRef.current = rec;
    setRecognizing(true);
    rec.start();
  };

  const copyMsg = async (msg: ChatMessage) => {
    await navigator.clipboard.writeText(msg.text);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const toggleRead = (msg: ChatMessage) => {
    if (ttsPlayingId === msg.id) {
      speechSynthesis.cancel();
      setTtsPlayingId("");
      ttsForIdRef.current = null;
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg.text);
    u.lang = /[\u4e00-\u9fa5]/.test(msg.text) ? "zh-CN" : "en-US";
    u.onend = () => setTtsPlayingId("");
    speakRef.current = u;
    ttsForIdRef.current = msg.id;
    setTtsPlayingId(msg.id);
    speechSynthesis.speak(u);
  };

  const toggleSessionsSidebar = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      setDesktopSidebarCollapsed((v) => !v);
    } else {
      setMobileDrawer((v) => !v);
    }
  }, []);

  if (!ready || !activeSession) return null;

  const pendingDeleteSession = deleteTargetId ? sessions.find((s) => s.id === deleteTargetId) : undefined;
  const pendingExportSession = exportHistorySessionId
    ? sessions.find((s) => s.id === exportHistorySessionId)
    : undefined;

  const sessionGroupsOrder = ["Today", "Yesterday", "Previous Sessions"] as const;

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div>
          <Link
            href="/"
            className="bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
          >
            POJU
          </Link>
        </div>
        <img
          alt=""
          className="h-8 w-8 rounded-full border border-outline-variant object-cover"
          src="/api/pwa-icon?size=64"
          width={32}
          height={32}
        />
      </div>
      <div className="p-2">
        <button
          type="button"
          onClick={newSession}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-br from-violet-200/95 via-purple-200/90 to-fuchsia-200/85 px-3 py-2 text-[13px] font-semibold text-[#1b1030] shadow-[0_16px_40px_rgba(168,85,247,0.32)] backdrop-blur-xl transition-transform hover:scale-[1.01]"
        >
          <span className="material-symbols-outlined relative z-10 text-[18px] leading-none">add</span>
          <span className="relative z-10">New POJU {siteConfig.priceLabel}</span>
        </button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {sessionGroupsOrder.map((g) =>
          groupedSessions[g].length ? (
            <div key={g}>
              <p className="mb-1 px-1 text-[11px] uppercase tracking-wider text-on-surface-variant">{g}</p>
              <div className="flex flex-col gap-1">
                {groupedSessions[g].map((s) => {
                  const active = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      className={`group/session-row flex w-full items-stretch overflow-hidden rounded-lg transition-transform hover:scale-[1.02] ${
                        active
                          ? "bg-violet-500/10 ring-1 ring-inset ring-violet-500/20"
                          : "text-neutral-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {inlineRenameId === s.id ? (
                        <div
                          className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2 ${
                            active ? "font-semibold text-violet-300" : "text-neutral-200"
                          }`}
                        >
                          {sessionListIcon(g, active)}
                          <input
                            autoFocus
                            maxLength={40}
                            value={inlineRenameValue}
                            onChange={(e) => setInlineRenameValue(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => {
                              if (inlineRenameEscapeRef.current) {
                                inlineRenameEscapeRef.current = false;
                                return;
                              }
                              commitInlineRename();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                inlineRenameEscapeRef.current = true;
                                setInlineRenameId(null);
                              }
                            }}
                            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-text-primary outline-none ring-0 focus:border-white/15 focus:outline-none focus:ring-0"
                            aria-label="Session name"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSessionId(s.id);
                            setMobileDrawer(false);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setSessionMenu(null);
                            inlineRenameEscapeRef.current = false;
                            setActiveSessionId(s.id);
                            setMobileDrawer(false);
                            setInlineRenameId(s.id);
                            setInlineRenameValue(s.title);
                          }}
                          className={`flex min-w-0 flex-1 select-none items-center gap-3 px-3 py-3 text-left ${
                            active ? "font-semibold text-violet-300" : "hover:text-white"
                          }`}
                        >
                          {sessionListIcon(g, active)}
                          <div className="min-w-0 truncate">
                            <span className="block text-sm">
                              {formatDate(s.createdAt)} · &quot;{s.hidden ? "Hidden by you" : s.title}&quot;
                            </span>
                          </div>
                        </button>
                      )}
                      <button
                        type="button"
                        title="Session actions"
                        aria-label="Session actions"
                        aria-haspopup="menu"
                        aria-expanded={sessionMenu?.sessionId === s.id}
                        className={`flex shrink-0 items-center justify-center px-2 transition-colors hover:text-text-primary ${
                          active ? "text-violet-400/90" : "text-neutral-500"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setSessionMenu((prev) =>
                            prev?.sessionId === s.id
                              ? null
                              : {
                                  sessionId: s.id,
                                  top: rect.bottom + 6,
                                  right: Math.max(12, window.innerWidth - rect.right),
                                },
                          );
                        }}
                      >
                        <span className="material-symbols-outlined text-[22px] leading-none">more_vert</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null,
        )}
      </nav>
      <div className="flex flex-col gap-1 border-t border-white/10 p-4">
        <button
          type="button"
          className="flex items-center gap-2 text-left text-xs uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
          onClick={() => router.push("/archive")}
        >
          <span className="material-symbols-outlined text-[18px] leading-none">inventory_2</span>
          The Archive
        </button>
        <button
          type="button"
          className="mt-1 flex items-center justify-between text-left text-xs uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
          onClick={() => setDrawer("syncro")}
        >
          <span>Syncro →</span>
        </button>
        <button
          type="button"
          className="mt-1 flex items-center justify-between text-left text-xs uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
          onClick={() => setDrawer("oracle")}
        >
          <span>Oracle →</span>
        </button>
      </div>
    </div>
  );

  const desktopSidebar = desktopSidebarCollapsed ? null : (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-white/10 bg-neutral-950/60 shadow-[0_0_40px_rgba(139,92,246,0.1)] backdrop-blur-2xl md:flex">
      {sidebarInner}
    </aside>
  );

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#0A0A0B] text-on-background">
      {sentToast ? (
        <div className="fixed right-4 top-20 z-[120] rounded-lg border border-emerald-400/40 bg-emerald-900/90 px-3 py-2 text-sm text-emerald-50">
          {sentToast}
        </div>
      ) : null}

      {welcomeToast ? (
        <div className="fixed left-1/2 top-[100px] z-[120] w-[min(90vw,460px)] -translate-x-1/2 rounded-xl border border-purple-vivid/30 bg-black/75 p-4 text-sm text-text-secondary">
          <p>🔒 This conversation lives only on this device. Close to delete.</p>
          <button
            className="mt-2 text-purple-vivid hover:text-text-primary"
            onClick={() => {
              setWelcomeToast(false);
              localStorage.setItem(`pojulife_chat_welcome_seen_${activeSessionId}`, "1");
            }}
          >
            I understand
          </button>
        </div>
      ) : null}

      {sessionMenu && sessions.some((x) => x.id === sessionMenu.sessionId) ? (
        <>
          <div className="fixed inset-0 z-[134] bg-transparent" aria-hidden onClick={() => setSessionMenu(null)} />
          <div
            role="menu"
            className="fixed z-[135] min-w-[220px] rounded-xl border border-white/12 bg-neutral-950 py-1 shadow-2xl"
            style={{ top: sessionMenu.top, right: sessionMenu.right }}
          >
            {(() => {
              const s = sessions.find((x) => x.id === sessionMenu.sessionId)!;
              return (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/10 hover:text-text-primary"
                    onClick={() => {
                      setSessionMenu(null);
                      setActiveSessionId(s.id);
                      setMobileDrawer(false);
                      inlineRenameEscapeRef.current = false;
                      setInlineRenameId(s.id);
                      setInlineRenameValue(s.title);
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px] leading-none">drive_file_rename_outline</span>
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-white/10 hover:text-text-primary"
                    onClick={() => {
                      setSessionMenu(null);
                      setExportHistorySessionId(s.id);
                      setExportHistoryEmail("");
                      setExportHistoryError("");
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px] leading-none">download</span>
                    Download chat log
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-300/90 hover:bg-red-500/10 hover:text-red-200"
                    onClick={() => {
                      setSessionMenu(null);
                      setDeleteTargetId(s.id);
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px] leading-none">delete</span>
                    Delete
                  </button>
                </>
              );
            })()}
          </div>
        </>
      ) : null}

      <div className="aura-bg relative z-0 flex h-full w-full">
        {desktopSidebar}

        <section className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${desktopSidebarCollapsed ? "md:ml-0" : "md:ml-72"}`}>
          <div className="px-4 pt-3 md:px-6">
            <ArchiveReturnBanner />
            {activeSessionId &&
            pojuRenewalHintBySession[activeSessionId]?.show &&
            !pojuRenewalDismissed[activeSessionId] &&
            pojuRenewalHintBySession[activeSessionId]!.expiresAt > Date.now() ? (
              <PojuRenewalBanner
                expiresAt={pojuRenewalHintBySession[activeSessionId]!.expiresAt}
                extending={pojuExtendBusy}
                onExtend={() => void extendPojuActiveSession()}
                onDismiss={() =>
                  setPojuRenewalDismissed((prev) => ({ ...prev, [activeSessionId]: true }))
                }
              />
            ) : null}
          </div>
          <header className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-white/10 bg-neutral-950/40 px-6 py-4 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={toggleSessionsSidebar}
                className="inline-flex items-center justify-center rounded-full p-2 text-neutral-400 transition-colors hover:bg-violet-500/10 hover:text-neutral-200"
                title="Sessions sidebar"
                aria-label="Toggle sessions sidebar"
              >
                {/* Mobile: menu / close drawer; Desktop (md+): expand / collapse fixed sidebar */}
                <span className="material-symbols-outlined text-[22px] leading-none md:hidden">
                  {mobileDrawer ? "close" : "menu"}
                </span>
                <span className="material-symbols-outlined hidden text-[22px] leading-none md:inline">
                  {desktopSidebarCollapsed ? "chevron_right" : "chevron_left"}
                </span>
              </button>
              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-medium text-on-surface">POJU Session</h2>
                <p className="text-xs text-on-surface-variant">
                  Started {formatDate(activeSession.createdAt)} · {activeSession.status === "active" ? "Active" : "Archived"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/poju"
                className="flex items-center justify-center rounded-full p-2 text-neutral-500 transition-colors hover:bg-red-500/15 hover:text-red-200"
                title="关闭并返回 POJU 介绍页"
                aria-label="关闭并返回 POJU 介绍页"
              >
                <span className="material-symbols-outlined text-[22px] leading-none">close</span>
              </Link>
              <button
                type="button"
                title="Save as PDF"
                onClick={() => {
                  setPdfOpen(true);
                  setMysticalToolsOpen(false);
                }}
                className="flex items-center justify-center rounded-full p-2 text-neutral-500 transition-colors hover:bg-violet-500/10 hover:text-neutral-200"
              >
                <span className="material-symbols-outlined text-[22px] leading-none">picture_as_pdf</span>
              </button>
              <button
                type="button"
                title="Mystical tools"
                onClick={() => setMysticalToolsOpen((v) => !v)}
                className="flex items-center justify-center rounded-full p-2 text-neutral-500 transition-colors hover:bg-violet-500/10 hover:text-neutral-200"
              >
                <span className="material-symbols-outlined text-[22px] leading-none">auto_fix_high</span>
              </button>
            </div>
          </header>

          <div
            ref={scrollerRef}
            className="relative flex min-h-0 flex-1 flex-col items-center gap-10 overflow-y-auto p-6 pb-40 selection:bg-primary-container selection:text-on-primary-container sm:gap-12"
          >
            <div className="relative z-[1] mt-4 w-full max-w-2xl shrink-0 rounded-xl bg-white/[0.06] p-8 text-center shadow-[0_8px_34px_rgba(12,12,16,0.35)] backdrop-blur-xl sm:mt-8">
              <span className="material-symbols-outlined jewel-icon mb-2 block text-6xl leading-none sm:text-7xl">self_improvement</span>
              <h3 className="mb-2 text-2xl font-semibold text-on-surface">Welcome to POJU</h3>
              <p className="mx-auto mb-6 max-w-md text-base leading-relaxed text-on-surface-variant">
                I am POJU, blending ancient Eastern wisdom with modern clarity. Ask specific questions for guidance, or simply share your
                thoughts. Your privacy is sacred here.
              </p>
              <p className="mt-6 text-xs text-on-surface-variant/80">Type below to begin, or tap the microphone to speak.</p>
            </div>

            <div className="flex w-full max-w-3xl flex-col gap-10 sm:gap-12">
              {activeMessages.map((m) => (
                <article key={m.id} className={`flex w-full gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.09] shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-md">
                      <img alt="" className="h-full w-full object-cover" src="/api/pwa-icon?size=128" width={40} height={40} />
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[85%] ${
                      m.role === "user"
                        ? "rounded-2xl rounded-tr-sm bg-white/[0.07] p-4 shadow-[0_8px_24px_rgba(16,16,26,0.24)] backdrop-blur-xl"
                        : "p-0"
                    }`}
                  >
                    {m.imageDataUrl ? <img src={m.imageDataUrl} alt="attachment" className="mb-2 max-h-48 rounded-lg" /> : null}
                    <p
                      className={`whitespace-pre-wrap text-[15px] ${
                        m.role === "assistant"
                          ? "leading-8 text-justify text-on-surface"
                          : "leading-relaxed text-on-surface"
                      }`}
                    >
                      {m.text}
                    </p>
                    {m.role === "assistant" ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3 pt-3">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] text-on-surface-variant/85 transition-colors hover:text-primary"
                          onClick={() => copyMsg(m)}
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none">content_copy</span>
                          {copiedId === m.id ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] text-on-surface-variant/85 transition-colors hover:text-primary"
                          onClick={() => toggleRead(m)}
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none">volume_up</span>
                          {ttsPlayingId === m.id ? "Stop" : "Read Aloud"}
                        </button>
                      </div>
                    ) : null}
                    {m.summon ? (
                      <div className="mt-3 pt-3 text-sm">
                        <button className="text-purple-vivid underline underline-offset-4" onClick={() => setDrawer(m.summon || null)}>
                          ✦ {m.summon === "syncro" ? "Summon Syncro" : "Summon Glyph"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}

              {activeSessionId && pojuSessionUi[activeSessionId]?.showDataForm ? (
                <div className="w-full max-w-2xl shrink-0">
                  <PojuDataCollectionForm
                    sessionId={activeSessionId}
                    locale={locale}
                    onComplete={onPojuDataCollectComplete}
                  />
                </div>
              ) : null}

              {thinkingVisible ? (
                <article className="flex w-full justify-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.09] shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-md">
                    <span className="material-symbols-outlined jewel-icon text-[20px] leading-none">auto_awesome</span>
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/[0.07] p-4 shadow-[0_8px_24px_rgba(16,16,26,0.24)] backdrop-blur-xl">
                    <p className="animate-pulse text-xs font-medium uppercase tracking-wider text-primary">Consulting the wisdom...</p>
                    {thinkingLines.map((line) => (
                      <p key={line} className="mt-2 text-sm italic leading-7 text-on-surface-variant">
                        {line}
                      </p>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] bg-gradient-to-t from-background via-background/90 to-transparent p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto mx-auto max-w-3xl">
              {pojuActions.length > 0 ? (
                <div className="mb-2 max-h-36 overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-3 text-xs shadow-lg backdrop-blur-md">
                  <p className="mb-2 font-semibold uppercase tracking-wide text-on-surface-variant">Phase actions</p>
                  <ul className="space-y-2">
                    {pojuActions.map((a) => (
                      <li key={a.id} className="flex flex-col gap-1 rounded-lg border border-white/5 bg-white/[0.04] p-2 sm:flex-row sm:items-center sm:gap-2">
                        <span className="min-w-0 flex-1 text-on-surface">{a.title}</span>
                        <select
                          value={a.status}
                          onChange={(e) => void updatePojuActionStatus(a.id, e.target.value as ActionItem["status"])}
                          className="w-full shrink-0 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-on-surface sm:w-28"
                        >
                          <option value="todo">To do</option>
                          <option value="doing">Doing</option>
                          <option value="done">Done</option>
                          <option value="skipped">Skipped</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {composerImage ? (
                <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs">
                  <img src={composerImage.dataUrl} alt={composerImage.name} className="h-9 w-9 rounded object-cover" />
                  <span className="max-w-40 truncate text-text-secondary">{composerImage.name}</span>
                  <button type="button" onClick={() => setComposerImage(null)} className="text-text-dim hover:text-text-primary">
                    ×
                  </button>
                </div>
              ) : null}
              <div className="glass-panel flex items-end gap-1 rounded-full border border-white/10 p-2 pr-3">
                <button
                  type="button"
                  className="flex items-center justify-center rounded-full p-2 text-on-surface-variant transition-colors hover:text-primary"
                  onClick={() => fileRef.current?.click()}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">attach_file</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onAttachFile(f);
                  }}
                />
                <button
                  type="button"
                  className={`flex items-center justify-center rounded-full p-2 transition-colors ${
                    recognizing ? "text-red-300" : "text-on-surface-variant hover:text-primary"
                  }`}
                  onClick={toggleSpeech}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">mic</span>
                </button>
                <textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder="Type your reply..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && window.innerWidth >= 768) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  className="max-h-40 min-h-[44px] flex-1 resize-y border-none bg-transparent px-2 py-3 text-sm text-on-surface outline-none ring-0 placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => void onSend()}
                  disabled={!composer.trim() && !composerImage}
                  className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                  <span className="material-symbols-outlined text-[16px] leading-none">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {mobileDrawer ? (
        <div className="fixed inset-0 z-[120] bg-black/70 md:hidden">
          <aside className="h-full w-[86%] max-w-sm border-r border-white/10 bg-neutral-950/95 shadow-xl backdrop-blur-2xl">{sidebarInner}</aside>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md border border-white/10 px-3 py-1 text-sm text-text-secondary"
            onClick={() => setMobileDrawer(false)}
          >
            Close
          </button>
        </div>
      ) : null}

      {mysticalToolsOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[110] bg-black/50"
            aria-label="Close tools"
            onClick={() => setMysticalToolsOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-[115] flex h-full w-[min(100vw,20rem)] flex-col border-l border-white/10 bg-neutral-950/85 shadow-2xl shadow-violet-900/20 backdrop-blur-3xl">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold text-violet-100">Mystical Tools</h2>
              <p className="text-xs text-violet-400">Enhance your session</p>
            </div>
            <nav className="flex flex-col gap-1 p-2 text-sm text-neutral-400">
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  setPdfOpen(true);
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">download</span>
                Export PDF
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  setDrawer("syncro");
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">auto_awesome</span>
                Summon Syncro
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  setDrawer("oracle");
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">auto_awesome</span>
                Summon Glyph
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  setRenameValue(activeSession.title);
                  setRenameOpen(true);
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">settings</span>
                Session settings (rename)
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  void router.push("/archive");
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">inventory_2</span>
                Archive
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  archiveActiveSession();
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">archive</span>
                Archive this session
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-red-300 transition-colors hover:bg-red-500/10"
                onClick={() => {
                  setWipeOpen(true);
                  setMysticalToolsOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[20px] leading-none">delete_forever</span>
                End &amp; wipe session
              </button>
            </nav>
          </aside>
        </>
      ) : null}

      {drawer ? (
        <div className="fixed inset-0 z-[130] bg-black/70 p-2 sm:p-4">
          <div className="mx-auto h-[90dvh] max-w-4xl rounded-2xl border border-white/12 bg-bg-layer-1 p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-text-primary">Summon {drawer === "syncro" ? "Syncro" : "Glyph"}</p>
              <button className="text-text-dim hover:text-text-primary" onClick={() => setDrawer(null)}>
                ×
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-text-secondary">
              <p>This is the embedded {drawer} panel placeholder (Task 2 quick mode).</p>
              <button
                className="mt-4 rounded-full border border-purple-vivid/30 px-4 py-2 text-purple-vivid"
                onClick={() => {
                  appendMessage({
                    id: uid("msg"),
                    sessionId: activeSessionId,
                    role: "assistant",
                    text:
                      drawer === "syncro"
                        ? "Syncro data received: I now see your space orientation. Next, I will align this with your current decision cycle."
                        : "Glyph pattern received: I now have a symbolic mirror to refine your next action.",
                    createdAt: Date.now(),
                  });
                  setDrawer(null);
                }}
              >
                Complete and return to chat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportHistorySessionId ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/12 bg-bg-layer-1 p-6 text-text-secondary">
            <p className="text-lg font-semibold text-text-primary">Email this chat</p>
            <p className="mt-3 text-sm leading-7">
              Enter your email address. We will send the <span className="font-medium text-text-primary">complete chat transcript</span>{" "}
              for this session to that inbox. This is a one-time delivery for this export — no marketing.
            </p>
            {pendingExportSession ? (
              <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-on-surface-variant">
                {formatDate(pendingExportSession.createdAt)} · &quot;
                {pendingExportSession.hidden ? "Hidden by you" : pendingExportSession.title}&quot;
              </p>
            ) : null}
            <input
              type="email"
              value={exportHistoryEmail}
              onChange={(e) => setExportHistoryEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="mt-4 w-full rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-sm"
            />
            {exportHistoryError ? <p className="mt-2 text-xs text-red-300">{exportHistoryError}</p> : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="rounded-full border border-white/12 px-4 py-2 text-sm"
                onClick={() => {
                  setExportHistorySessionId(null);
                  setExportHistoryEmail("");
                  setExportHistoryError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border border-purple-vivid/30 px-4 py-2 text-sm text-purple-vivid"
                onClick={submitExportChatHistory}
              >
                Send transcript
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTargetId ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/12 bg-bg-layer-1 p-6 text-text-secondary">
            <p className="text-lg font-semibold text-text-primary">Delete this session?</p>
            <p className="mt-3 text-sm leading-7">
              All messages in this chat will be removed from this device.{" "}
              <span className="font-medium text-text-primary">This cannot be undone and cannot be recovered.</span>
            </p>
            {pendingDeleteSession ? (
              <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-on-surface-variant">
                {formatDate(pendingDeleteSession.createdAt)} · &quot;
                {pendingDeleteSession.hidden ? "Hidden by you" : pendingDeleteSession.title}&quot;
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="rounded-full border border-white/12 px-4 py-2 text-sm"
                onClick={() => setDeleteTargetId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                onClick={confirmSidebarDeleteSession}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renameOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/12 bg-bg-layer-1 p-6">
            <p className="text-lg font-semibold text-text-primary">Rename this session</p>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={40}
              className="mt-4 w-full rounded-lg border border-white/12 bg-black/25 px-3 py-2"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRenameOpen(false)} className="rounded-full border border-white/12 px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={renameSession} className="rounded-full border border-purple-vivid/30 px-4 py-2 text-sm text-purple-vivid">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {wipeOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/12 bg-bg-layer-1 p-6 text-text-secondary">
            <p className="text-lg font-semibold text-text-primary">End and wipe this session?</p>
            <p className="mt-3 text-sm leading-7">Everything in this conversation will be gone forever. This cannot be undone.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button className="rounded-full border border-purple-vivid/30 px-4 py-2 text-sm text-purple-vivid" onClick={() => setPdfOpen(true)}>
                Save PDF first →
              </button>
              <button className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-300" onClick={wipeSession}>
                Wipe without saving
              </button>
              <button className="rounded-full border border-white/12 px-4 py-2 text-sm" onClick={() => setWipeOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pdfOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/12 bg-bg-layer-1 p-6">
            <p className="text-lg font-semibold text-text-primary">Where should we send it?</p>
            <input
              type="email"
              value={pdfEmail}
              onChange={(e) => setPdfEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="mt-4 w-full rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-sm"
            />
            <p className="mt-3 text-xs text-text-dim">Your reading will arrive in minutes. No marketing.</p>
            {pdfError ? <p className="mt-2 text-xs text-red-300">{pdfError}</p> : null}
            <div className="mt-5 flex flex-col gap-2">
              <button className="rounded-full border border-purple-vivid/30 px-4 py-2 text-sm text-purple-vivid" onClick={() => savePdf(true)}>
                Send me both
              </button>
              <button className="rounded-full border border-white/12 px-4 py-2 text-sm text-text-secondary" onClick={() => savePdf(false)}>
                Just the PDF, no check-in
              </button>
              <button className="rounded-full border border-white/12 px-4 py-2 text-sm text-text-secondary" onClick={() => setPdfOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
