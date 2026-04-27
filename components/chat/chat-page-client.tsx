"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildMockResponse } from "@/lib/chat/mock-poju-response";
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

function dateGroup(ts: number): "Today" | "This Week" | "Earlier" {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const val = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.floor((today - val) / 86400000);
  if (diff <= 0) return "Today";
  if (diff < 7) return "This Week";
  return "Earlier";
}

export function ChatPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const speakRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsForIdRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [rightMenuOpen, setRightMenuOpen] = useState(false);
  const sessions = useChatStore((s) => s.sessions);
  const messages = useChatStore((s) => s.messages);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setAll = useChatStore((s) => s.setAll);
  const setSessions = useChatStore((s) => s.setSessions);
  const setMessages = useChatStore((s) => s.setMessages);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const [composer, setComposer] = useState("");
  const [composerImage, setComposerImage] = useState<ComposerImage | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [thinkingLines, setThinkingLines] = useState<string[]>([]);
  const [thinkingVisible, setThinkingVisible] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [ttsPlayingId, setTtsPlayingId] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfEmail, setPdfEmail] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [sentToast, setSentToast] = useState("");
  const [welcomeToast, setWelcomeToast] = useState(false);

  useEffect(() => {
    let stop = false;

    const token = searchParams.get("token");

    const bootstrap = async () => {
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
        const first = seedSession();
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

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinkingLines, welcomeVisible]);

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId), [sessions, activeSessionId]);
  const activeMessages = useMemo(
    () => messages.filter((m) => m.sessionId === activeSessionId),
    [messages, activeSessionId],
  );
  const activeCount = sessions.filter((s) => s.status === "active").length;

  const groupedSessions = useMemo(() => {
    const visible = sessions.filter((s) => !s.hidden || s.id === activeSessionId).sort((a, b) => b.createdAt - a.createdAt);
    return {
      Today: visible.filter((s) => dateGroup(s.createdAt) === "Today"),
      "This Week": visible.filter((s) => dateGroup(s.createdAt) === "This Week"),
      Earlier: visible.filter((s) => dateGroup(s.createdAt) === "Earlier"),
    };
  }, [sessions, activeSessionId]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const simulateAssistant = useCallback(
    async (input: string, userTurnCount: number) => {
      const chunks = buildMockResponse(input);
      setThinkingVisible(true);
      setThinkingLines([]);
      for (const chunk of chunks) {
        if (chunk.type === "thinking") {
          await new Promise((r) => setTimeout(r, chunk.delayMs));
          setThinkingLines((prev) => [...prev, chunk.text]);
        }
      }
      await new Promise((r) => setTimeout(r, 550));
      setThinkingVisible(false);
      const answer = chunks.find((c) => c.type === "answer");
      if (!answer || answer.type !== "answer") return;
      const shouldPhaseFive = answer.phaseFive || userTurnCount >= 3;
      appendMessage({
        id: uid("msg"),
        sessionId: activeSessionId,
        role: "assistant",
        text: answer.text,
        createdAt: Date.now(),
        summon: answer.summon,
        phaseFive: shouldPhaseFive,
      });
      if (shouldPhaseFive) {
        setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, title: "Action plan in progress" } : s)));
      }
    },
    [activeSessionId, appendMessage],
  );

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
    setWelcomeVisible(false);
    const userTurnCount =
      messages.filter((m) => m.sessionId === activeSessionId && m.role === "user").length + 1;
    await simulateAssistant(text, userTurnCount);
  }, [activeSessionId, appendMessage, composer, composerImage, messages, simulateAssistant]);

  const newSession = () => {
    const s = seedSession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setMessages((prev) => prev);
    setWelcomeVisible(true);
  };

  const renameSession = () => {
    if (!activeSession) return;
    const val = renameValue.trim().slice(0, 40);
    if (!val) return;
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, title: val } : s)));
    setRenameOpen(false);
  };

  const wipeSession = () => {
    if (!activeSession) return;
    const sid = activeSession.id;
    setMessages((prev) => prev.filter((m) => m.sessionId !== sid));
    const remaining = sessions.filter((s) => s.id !== sid);
    setSessions(() => remaining);
    if (!remaining.length) {
      clearLegacySnapshot();
      void clearSecureChatSnapshot();
      router.replace("/");
      return;
    }
    setActiveSessionId(remaining[0].id);
    setWipeOpen(false);
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

  if (!ready || !activeSession) return null;

  const sidebar = (
    <aside className="h-full w-full border-r border-white/10 bg-neutral-950/60 shadow-[0_0_40px_rgba(139,92,246,0.1)] backdrop-blur-2xl lg:w-72">
      <div className="flex h-full flex-col p-4">
        <div className="border-b border-white/10 pb-4">
          <Link href="/" className="text-2xl font-bold tracking-tight text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text">
            POJU
          </Link>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-on-surface-variant">Zen-Futurist Oracle</p>
          <p className="mt-2 text-xs text-text-dim">{activeCount} active sessions</p>
        </div>
        <button
          type="button"
          onClick={newSession}
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-on-primary shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-transform hover:scale-[1.02]"
        >
          <span>＋</span> New POJU {siteConfig.priceLabel}
        </button>
        <div className="my-4 h-px bg-white/10" />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {(Object.keys(groupedSessions) as Array<keyof typeof groupedSessions>).map((g) =>
            groupedSessions[g].length ? (
              <div key={g}>
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-text-dim">{g}</p>
                <div className="space-y-1.5">
                  {groupedSessions[g].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setMobileDrawer(false);
                      }}
                      className={`w-full rounded-lg border px-3 py-3 text-left text-xs transition-all hover:scale-[1.02] ${
                        s.id === activeSessionId
                          ? "border-violet-500/25 bg-violet-500/10 text-violet-200 ring-1 ring-inset ring-violet-500/20"
                          : "border-white/8 bg-black/20 text-text-secondary hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {s.id === activeSessionId ? <span className="h-2 w-2 rounded-full bg-purple-vivid" /> : null}
                        <span>{formatDate(s.createdAt)}</span>
                        <span>·</span>
                        <span className="truncate">{s.hidden ? "[Hidden by you]" : s.title}</span>
                      </div>
                      <div className="mt-1 flex gap-2 text-[11px] text-text-dim">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameValue(s.title);
                            setActiveSessionId(s.id);
                            setRenameOpen(true);
                          }}
                        >
                          ✎ Rename
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)));
                          }}
                        >
                          {s.hidden ? "Reveal" : "Hide"}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSessionId(s.id);
                            setWipeOpen(true);
                          }}
                        >
                          Wipe
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
        <div className="my-4 h-px bg-white/10" />
        <button className="text-left text-sm text-on-surface-variant hover:text-primary" onClick={() => router.push("/archive")}>
          The Archive
        </button>
        <div className="my-4 h-px bg-white/10" />
        <button className="text-left text-sm text-on-surface-variant hover:text-primary" onClick={() => setDrawer("syncro")}>
          Syncro →
        </button>
        <button className="mt-2 text-left text-sm text-on-surface-variant hover:text-primary" onClick={() => setDrawer("oracle")}>
          Oracle →
        </button>
      </div>
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

      <div className="aura-bg flex h-full">
        <div className="hidden lg:block">{sidebar}</div>

        <section className="relative flex min-w-0 flex-1 flex-col">
          <div className="px-4 pt-3 md:px-6">
            <ArchiveReturnBanner />
          </div>
          <div className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/40 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                <div>
                  <p className="truncate text-lg font-medium text-on-surface">POJU Session</p>
                  <p className="text-xs text-on-surface-variant">
                    Started {formatDate(activeSession.createdAt)} · {activeSession.status === "active" ? "Active" : "Archived"}
                  </p>
                </div>
              </div>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileDrawer(true)}
                  className="rounded-md border border-white/10 px-2 py-1 text-xs text-text-secondary lg:hidden"
                >
                  Sessions
                </button>
                <button type="button" onClick={() => setRightMenuOpen((v) => !v)} className="rounded-full p-2 text-neutral-500 hover:bg-violet-500/10 hover:text-neutral-200">≡</button>
                {rightMenuOpen ? (
                  <div className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-white/12 bg-bg-layer-1 p-2 text-sm text-text-secondary shadow-xl">
                    <button className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5" onClick={() => setPdfOpen(true)}>
                      ✦ Save this reading as PDF
                    </button>
                    <button className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5" onClick={() => setDrawer("syncro")}>
                      ✦ Summon Syncro
                    </button>
                    <button className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5" onClick={() => setDrawer("oracle")}>
                      ✦ Summon Oracle
                    </button>
                    <button
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5"
                      onClick={() => {
                        setRenameValue(activeSession.title);
                        setRenameOpen(true);
                      }}
                    >
                      ✦ Rename this session
                    </button>
                    <button
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5"
                      onClick={archiveActiveSession}
                    >
                      ✦ Archive this session
                    </button>
                    <button className="w-full rounded-md px-3 py-2 text-left text-red-300 hover:bg-red-500/10" onClick={() => setWipeOpen(true)}>
                      ✦ End & Wipe this session
                    </button>
                    <div className="my-1 h-px bg-white/10" />
                    <button className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5">
                      Settings
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div ref={scrollerRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 pb-36">
            {welcomeVisible && !activeMessages.length ? (
              <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 border-t-white/20 bg-[rgba(30,30,34,0.6)] p-8 text-center text-text-secondary backdrop-blur-xl">
                <p className="text-lg font-semibold text-on-surface">Welcome to the POJU-破局</p>
                <p className="mt-3">Tell me what&apos;s holding you back — career, family, love, money, health, any crossroads.</p>
                <p className="mt-4">
                  The more specific, the better. Places, timing, people, what you&apos;ve tried, what you fear.
                </p>
                <p className="mt-4">Two thousand years of Eastern wisdom can answer you, but it needs to see the real you first.</p>
                <p className="mt-4">──</p>
                <p className="mt-4">Once you finish, I&apos;ll begin the reading. Everything you say stays on this device only.</p>
                <p className="mt-3 text-xs text-text-dim">Type below to begin, or tap the microphone to speak.</p>
              </div>
            ) : null}

            {activeMessages.map((m) => (
              <article key={m.id} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.role === "user"
                      ? "rounded-tr-sm bg-gradient-to-br from-violet-500 to-[#6d3bd7] text-white shadow-[0_4px_20px_rgba(139,92,246,0.2)]"
                      : "rounded-tl-sm border border-primary/20 border-t-white/20 bg-[rgba(30,30,34,0.6)] text-on-surface backdrop-blur-xl"
                  }`}
                >
                  {m.imageDataUrl ? <img src={m.imageDataUrl} alt="attachment" className="mb-2 max-h-48 rounded-lg" /> : null}
                  <p className="whitespace-pre-wrap text-[15px] leading-7">{m.text}</p>
                  {m.role === "assistant" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-outline-variant/30 pt-3 text-xs text-text-dim">
                      <button className="hover:text-text-primary" onClick={() => copyMsg(m)}>
                        {copiedId === m.id ? "✓ Copied" : "📋 Copy"}
                      </button>
                      <button className="hover:text-text-primary" onClick={() => toggleRead(m)}>
                        {ttsPlayingId === m.id ? "⏹ Stop" : "🔊 Read Aloud"}
                      </button>
                    </div>
                  ) : null}
                  {m.phaseFive ? (
                    <div className="mt-3 border-t border-purple-vivid/20 pt-3 text-sm">
                      <p className="text-text-dim">This is your reading so far.</p>
                      <button className="mt-1 text-purple-vivid underline underline-offset-4" onClick={() => setPdfOpen(true)}>
                        ✦ Save this reading as PDF
                      </button>
                    </div>
                  ) : null}
                  {m.summon ? (
                    <div className="mt-3 border-t border-purple-vivid/20 pt-3 text-sm">
                      <button className="text-purple-vivid underline underline-offset-4" onClick={() => setDrawer(m.summon || null)}>
                        ✦ {m.summon === "syncro" ? "Summon Syncro" : "Summon Oracle"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}

            {thinkingVisible ? (
              <article className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-primary/20 border-t-white/20 bg-[rgba(30,30,34,0.6)] px-4 py-3 text-text-accent backdrop-blur-xl">
                  {thinkingLines.map((line) => (
                    <p key={line} className="text-sm leading-7">
                      {line}
                    </p>
                  ))}
                </div>
              </article>
            ) : null}
          </div>

          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background via-background/90 to-transparent p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {composerImage ? (
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs">
                <img src={composerImage.dataUrl} alt={composerImage.name} className="h-9 w-9 rounded object-cover" />
                <span className="max-w-40 truncate text-text-secondary">{composerImage.name}</span>
                <button onClick={() => setComposerImage(null)} className="text-text-dim hover:text-text-primary">
                  ×
                </button>
              </div>
            ) : null}
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-full border border-white/10 border-t-white/20 bg-[rgba(30,30,34,0.6)] p-2 pr-3 backdrop-blur-xl">
              <button
                className="rounded-full p-2 text-on-surface-variant hover:text-primary"
                onClick={() => fileRef.current?.click()}
              >
                📎
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
                className={`rounded-full p-2 ${recognizing ? "text-red-300" : "text-on-surface-variant hover:text-primary"}`}
                onClick={toggleSpeech}
              >
                🎤
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
                className="max-h-40 min-h-[44px] flex-1 resize-y bg-transparent px-2 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none"
              />
              <button
                onClick={() => void onSend()}
                disabled={!composer.trim() && !composerImage}
                className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send →
              </button>
            </div>
          </div>
        </section>
      </div>

      {mobileDrawer ? (
        <div className="fixed inset-0 z-[120] bg-black/70 lg:hidden">
          <div className="h-full w-[86%] max-w-sm bg-bg-deep">{sidebar}</div>
          <button className="absolute right-4 top-4 rounded-md border border-white/10 px-3 py-1" onClick={() => setMobileDrawer(false)}>
            Close
          </button>
        </div>
      ) : null}

      {drawer ? (
        <div className="fixed inset-0 z-[130] bg-black/70 p-2 sm:p-4">
          <div className="mx-auto h-[90dvh] max-w-4xl rounded-2xl border border-white/12 bg-bg-layer-1 p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-text-primary">Summon {drawer === "syncro" ? "Syncro" : "Oracle"}</p>
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
                        : "Oracle sign received: I now have a symbolic signal to refine your next action.",
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
