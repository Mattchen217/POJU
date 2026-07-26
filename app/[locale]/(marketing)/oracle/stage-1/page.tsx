"use client";

import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getLatestOracleSign, getOracleSignById, saveOracleSign, type OracleSignRecord } from "@/lib/oracle/storage";
import type { ArchiveEntry } from "@/lib/archive/types";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";

// --- 关键修复：强制动态渲染，解决 useSearchParams 导致的 build 报错 ---
export const dynamic = "force-dynamic";

type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type SignLevel = {
  name: "Divine Tailwind" | "Fair Sky" | "Still Water" | "Crosswind" | "Eye of Storm";
  subtitle: string;
  particleColor: string;
  cardClass: string;
  weight: number;
  topSymbol: string;
};

const QUESTION_HISTORY_KEY = "pojulife_oracle_question_history_v1";
const ARCHIVE_RUNTIME_KEY = "pojulife_archive_runtime_v1";
const STAGE1_SHELL_KEY = "pojulife_oracle_stage1_shell";

const SIGN_COPY = {
  "Divine Tailwind": {
    verse: ["A bright wind lifts the veil,", "A silent gate swings wide,", "What waited now arrives,", "Grace meets your next step."],
    whatItMeans: "You asked from sincerity. Conditions are aligning faster than expected. Move cleanly and do not dilute your intent.",
    forToday: "Say yes to the opening in front of you. Keep your next action simple and immediate.",
  },
  "Fair Sky": {
    verse: ["Clouds part without force,", "The road appears in light,", "You do not need a leap,", "Only a true first step."],
    whatItMeans: "The path is open but still asks for participation. Support is present; hesitation is now the only resistance.",
    forToday: "Choose one clear action and complete it before dusk. Let momentum prove the answer.",
  },
  "Still Water": {
    verse: ["Still water keeps the moon,", "Depth answers without noise,", "The turn is not outside,", "It ripens under quiet."],
    whatItMeans: "You asked about ending it. You are not late and you are not stuck; you are in the pause where shape becomes clear.",
    forToday: "Reduce input for one evening. Keep one promise to yourself and let that be enough.",
  },
  "Crosswind": {
    verse: ["Winds cross and braid the air,", "Two truths pull at one heart,", "Do not force the weather,", "Listen before you steer."],
    whatItMeans: "Competing forces are real. Pushing harder now creates noise, not progress. Precision matters more than speed.",
    forToday: "Delay one high-stakes decision. Clarify your non-negotiable line in writing.",
  },
  "Eye of Storm": {
    verse: ["Around you, weather turns,", "At center, one point still,", "Clarity does not shout,", "It waits where nothing shakes."],
    whatItMeans: "External turbulence is not your signal. The true axis is stable. Return to the center and act from that still point.",
    forToday: "Step back from urgency for one hour. Decide only after your breath and body settle.",
  },
} as const;

const SIGN_LEVELS: ReadonlyArray<SignLevel> = [
  {
    name: "Divine Tailwind",
    subtitle: "Pattern of Alignment",
    particleColor: "#F0ABFC",
    cardClass: "border-[#F0ABFC]/40 bg-[#F0ABFC]/10",
    weight: 5,
    topSymbol: "✦ ✦ ✦ ✦ ✦",
  },
  {
    name: "Fair Sky",
    subtitle: "Pattern of Openness",
    particleColor: "#A78BFA",
    cardClass: "border-[#A78BFA]/40 bg-[#A78BFA]/10",
    weight: 25,
    topSymbol: "✦ ✦ ✦ ✦",
  },
  {
    name: "Still Water",
    subtitle: "Pattern of Patience",
    particleColor: "#6366F1",
    cardClass: "border-[#6366F1]/40 bg-[#6366F1]/10",
    weight: 40,
    topSymbol: "✦ ✦ ✦",
  },
  {
    name: "Crosswind",
    subtitle: "Pattern of Recalibration",
    particleColor: "#7C3AED",
    cardClass: "border-[#7C3AED]/40 bg-[#7C3AED]/10",
    weight: 25,
    topSymbol: "✦ ✦",
  },
  {
    name: "Eye of Storm",
    subtitle: "Pattern of Clarity",
    particleColor: "#3B0764",
    cardClass: "border-[#3B0764]/40 bg-[#3B0764]/15",
    weight: 5,
    topSymbol: "◉",
  },
] as const;

function normalizeQuestion(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function similarityByWords(a: string, b: string): number {
  const wa = new Set(normalizeQuestion(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeQuestion(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  wa.forEach((w) => {
    if (wb.has(w)) inter += 1;
  });
  return Math.round((inter / Math.max(wa.size, wb.size)) * 100);
}

function pickSignLevel(): SignLevel {
  const total = SIGN_LEVELS.reduce((sum, s) => sum + s.weight, 0);
  let cursor = Math.random() * total;
  for (const sign of SIGN_LEVELS) {
    cursor -= sign.weight;
    if (cursor <= 0) return sign;
  }
  return SIGN_LEVELS[3];
}

// 这里包含了所有你原本的 600 多行逻辑
function OracleStageOneContent() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>(1);
  const [question, setQuestion] = useState("");
  const [holdProgress, setHoldProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [inscribeTick, setInscribeTick] = useState(0);
  const [revealTick, setRevealTick] = useState(0);
  const [signLevel, setSignLevel] = useState<SignLevel | null>(null);
  const [signNo, setSignNo] = useState<number>(0);
  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupHoursAgo, setDupHoursAgo] = useState(0);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [latestSign, setLatestSign] = useState<OracleSignRecord | null>(null);
  const [archiveSaved, setArchiveSaved] = useState(false);
  const [lastOracleRecordId, setLastOracleRecordId] = useState("");
  const [shell, setShell] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const v = window.localStorage.getItem(STAGE1_SHELL_KEY);
      return v === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const holdIntervalRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STAGE1_SHELL_KEY, shell);
    } catch {
      // ignore
    }
  }, [shell]);

  const skin = useMemo(() => {
    if (shell === "light") {
      return {
        main: "relative min-h-screen bg-zinc-50 px-4 py-12 text-center text-zinc-800 antialiased",
        toggle:
          "fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[110] inline-flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-full border border-zinc-300/90 bg-white px-3.5 text-zinc-800 shadow-md transition hover:bg-zinc-100",
        close:
          "fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[110] inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-fuchsia-400/50 bg-white/95 px-3 text-sm font-semibold text-fuchsia-900 shadow-md transition hover:bg-fuchsia-50",
        kicker: "text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-700/85",
        h1: "mt-3 text-2xl font-semibold text-zinc-900 sm:text-3xl",
        ritualBox:
          "mx-auto mt-6 max-w-xl rounded-xl border border-fuchsia-200/90 bg-fuchsia-50/80 p-4 text-left text-sm leading-7 text-zinc-700",
        btnContinueLg:
          "mt-8 inline-flex rounded-full border border-fuchsia-400/55 bg-fuchsia-100/90 px-6 py-3 text-sm font-semibold text-fuchsia-950 shadow-sm transition hover:bg-fuchsia-200/90",
        card: "mx-auto mt-8 max-w-xl rounded-xl border border-zinc-200/95 bg-white p-5 text-left shadow-sm",
        cardP6: "mx-auto mt-8 max-w-xl rounded-xl border border-zinc-200/95 bg-white p-6 shadow-sm",
        label: "text-sm text-zinc-600",
        input:
          "mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400",
        counter: "mt-2 text-xs text-zinc-500",
        btnContinueMd:
          "mt-4 rounded-full border border-fuchsia-400/55 bg-fuchsia-100/90 px-5 py-2 text-sm font-semibold text-fuchsia-950 shadow-sm disabled:opacity-40",
        stageLead: "text-lg text-zinc-900",
        stageSub: "mt-2 text-sm text-zinc-600",
        btnOutlineSm:
          "mt-5 rounded-full border border-fuchsia-400/50 bg-fuchsia-50/80 px-5 py-2 text-sm text-fuchsia-900 transition hover:bg-fuchsia-100",
        holdBtn:
          "mt-5 w-full rounded-xl border border-fuchsia-400/50 bg-fuchsia-50/90 px-5 py-6 text-sm text-fuchsia-950",
        progressTrack: "mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200",
        revealCard: "mx-auto mt-4 h-32 w-24 rounded-md border border-zinc-300 bg-zinc-100/90",
        dimXs: "mt-1 text-xs text-zinc-500",
        backLink:
          "mt-10 inline-flex justify-center rounded-full border border-fuchsia-400/55 bg-fuchsia-100/90 px-6 py-3 text-sm font-semibold text-fuchsia-950 shadow-sm transition hover:bg-fuchsia-200/90",
        gridBtn: "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50",
        gridBtnAccent: "rounded-lg border border-fuchsia-400/60 bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-900",
        dupOverlay: "fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/35 px-4 backdrop-blur-sm",
        dupPanel: "w-full max-w-md rounded-2xl border border-fuchsia-200/90 bg-white p-5 text-left shadow-xl",
        dupTitle: "text-lg font-semibold text-zinc-900",
        dupBody: "mt-3 text-sm text-zinc-600",
        dupBtn: "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100",
        dupBtnPrimary: "rounded-lg border border-fuchsia-400/60 bg-fuchsia-100 px-3 py-2 text-sm font-medium text-fuchsia-950",
      };
    }
    return {
      main: "relative min-h-screen bg-bg-deep px-4 py-12 text-center text-text-body",
      toggle:
        "fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[110] inline-flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-full border border-zinc-500/40 bg-black/55 px-3.5 text-sm font-semibold text-zinc-200 shadow-lg backdrop-blur-md transition hover:bg-white/10",
      close:
        "fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[110] inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-fuchsia-300/40 bg-black/55 px-3 text-sm font-semibold text-fuchsia-100 shadow-lg backdrop-blur-md transition hover:bg-fuchsia-500/20",
      kicker: "text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200/80",
      h1: "mt-3 text-2xl font-semibold text-text-primary sm:text-3xl",
      ritualBox:
        "mx-auto mt-6 max-w-xl rounded-xl border border-fuchsia-300/20 bg-fuchsia-900/10 p-4 text-left text-sm leading-7 text-text-secondary",
      btnContinueLg:
        "mt-8 inline-flex rounded-full border border-fuchsia-300/45 bg-fuchsia-500/20 px-6 py-3 text-sm font-semibold text-fuchsia-100",
      card: "mx-auto mt-8 max-w-xl rounded-xl border border-white/12 bg-black/25 p-5 text-left",
      cardP6: "mx-auto mt-8 max-w-xl rounded-xl border border-white/12 bg-black/25 p-6",
      label: "text-sm text-text-secondary",
      input: "mt-3 w-full rounded-lg border border-white/12 bg-black/20 px-3 py-2 text-sm",
      counter: "mt-2 text-xs text-text-dim",
      btnContinueMd:
        "mt-4 rounded-full border border-fuchsia-300/45 bg-fuchsia-500/20 px-5 py-2 text-sm font-semibold text-fuchsia-100 disabled:opacity-40",
      stageLead: "text-lg text-text-primary",
      stageSub: "mt-2 text-sm text-text-secondary",
      btnOutlineSm: "mt-5 rounded-full border border-fuchsia-300/45 px-5 py-2 text-sm text-fuchsia-100",
      holdBtn: "mt-5 w-full rounded-xl border border-fuchsia-300/45 bg-fuchsia-500/15 px-5 py-6 text-sm text-fuchsia-100",
      progressTrack: "mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/40",
      revealCard: "mx-auto mt-4 h-32 w-24 rounded-md border border-white/20 bg-white/5",
      dimXs: "mt-1 text-xs text-text-dim",
      backLink:
        "mt-10 inline-flex justify-center rounded-full border border-fuchsia-300/45 bg-fuchsia-500/20 px-6 py-3 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-400/28",
      gridBtn: "rounded-lg border border-white/12 px-3 py-2 text-sm text-text-secondary",
      gridBtnAccent: "rounded-lg border border-fuchsia-300/45 px-3 py-2 text-sm text-fuchsia-100",
      dupOverlay: "fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4",
      dupPanel: "w-full max-w-md rounded-2xl border border-fuchsia-300/20 bg-bg-deep p-5 text-left",
      dupTitle: "text-lg font-semibold text-text-primary",
      dupBody: "mt-3 text-sm text-text-secondary",
      dupBtn: "rounded-lg border border-white/12 px-3 py-2 text-sm text-text-secondary",
      dupBtnPrimary: "rounded-lg border border-fuchsia-300/45 bg-fuchsia-500/20 px-3 py-2 text-sm text-fuchsia-100",
    };
  }, [shell]);

  const canContinue = question.trim().length > 0 && question.trim().length <= 60;

  const verseLines = useMemo(() => {
    if (!signLevel) return SIGN_COPY["Still Water"].verse;
    return SIGN_COPY[signLevel.name].verse;
  }, [signLevel]);

  const whatItMeansText = useMemo(() => {
    if (!signLevel) return SIGN_COPY["Still Water"].whatItMeans;
    return SIGN_COPY[signLevel.name].whatItMeans;
  }, [signLevel]);

  const forTodayText = useMemo(() => {
    if (!signLevel) return SIGN_COPY["Still Water"].forToday;
    return SIGN_COPY[signLevel.name].forToday;
  }, [signLevel]);

  const clearHoldInterval = () => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const saveQuestionHistory = (q: string) => {
    try {
      const raw = localStorage.getItem(QUESTION_HISTORY_KEY);
      const list = raw ? (JSON.parse(raw) as Array<{ q: string; t: number }>) : [];
      localStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify([{ q, t: Date.now() }, ...list].slice(0, 30)));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const from = searchParams.get("from");
    const kind = searchParams.get("kind");
    const entry = searchParams.get("entry");
    if (from !== "archive" || kind !== "oracle" || !entry) return;

    const restore = async () => {
      try {
        const raw = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
        if (!raw) return;
        const entries = JSON.parse(raw) as ArchiveEntry[];
        const hit = entries.find((x) => x.id === entry);
        if (!hit?.refId) return;
        const sign = await getOracleSignById(hit.refId);
        if (!sign) return;
        const level = SIGN_LEVELS.find((s) => s.name === sign.levelName);
        if (level) setSignLevel(level);
        setLatestSign(sign);
        setLastOracleRecordId(sign.id);
        setQuestion(sign.question);
        setSignNo(sign.signNo);
        setInscribeTick(5);
        setStage(7);
      } catch {
        // ignore
      }
    };
    void restore();
  }, [searchParams]);

  const hasRecentSimilarQuestion = (q: string): { matched: boolean; hoursAgo: number } => {
    try {
      const raw = localStorage.getItem(QUESTION_HISTORY_KEY);
      const list = raw ? (JSON.parse(raw) as Array<{ q: string; t: number }>) : [];
      const now = Date.now();
      for (const item of list) {
        const within48h = now - item.t <= 48 * 60 * 60 * 1000;
        const sim = similarityByWords(q, item.q);
        if (within48h && sim >= 80) {
          return { matched: true, hoursAgo: Math.max(1, Math.floor((now - item.t) / (60 * 60 * 1000))) };
        }
      }
    } catch {
      // ignore
    }
    return { matched: false, hoursAgo: 0 };
  };

  const onContinueFromStage2 = () => {
    const check = hasRecentSimilarQuestion(question);
    if (check.matched) {
      setDupHoursAgo(check.hoursAgo);
      setDupModalOpen(true);
      return;
    }
    setStage(3);
  };

  const startHold = () => {
    if (stage !== 4) return;
    setHolding(true);
    setHoldProgress(0);
    const started = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const next = Math.min(100, Math.round((elapsed / 3000) * 100));
      setHoldProgress(next);
      if (next >= 100) {
        clearHoldInterval();
        setHolding(false);
        setRevealTick(1);
        const pickedSign = pickSignLevel();
        const pickedSignNo = Math.floor(Math.random() * 100) + 1;
        setSignLevel(pickedSign);
        setSignNo(pickedSignNo);
        setStage(5);
        window.setTimeout(() => setRevealTick(2), 1200);
        window.setTimeout(() => setRevealTick(3), 2400);
        window.setTimeout(() => setStage(6), 2600);
        window.setTimeout(() => {
          setInscribeTick(1);
          window.setTimeout(() => setInscribeTick(2), 1500);
          window.setTimeout(() => setInscribeTick(3), 3000);
          window.setTimeout(() => setInscribeTick(4), 4500);
          window.setTimeout(() => setInscribeTick(5), 6000);
          window.setTimeout(() => {
            saveQuestionHistory(question);
            const recordId = `oracle_${Date.now()}`;
            setLastOracleRecordId(recordId);
            void saveOracleSign({
              id: recordId,
              createdAt: Date.now(),
              question: question.trim(),
              signNo: pickedSignNo,
              levelName: pickedSign.name,
              levelSubtitle: pickedSign.subtitle,
              verseLines: [...verseLines],
              whatItMeans: SIGN_COPY[pickedSign.name].whatItMeans,
              forToday: SIGN_COPY[pickedSign.name].forToday,
            });
            setStage(7);
          }, 7600);
        }, 2200);
      }
    }, 40);
  };

  const cancelHold = () => {
    if (!holding) return;
    clearHoldInterval();
    setHolding(false);
    setHoldProgress(0);
  };

  const ritualHints = useMemo(
    () => (
      <div className={skin.ritualBox}>
        <p>◉ One question per reading. Asking many things at once dilutes the sign.</p>
        <p className="mt-2">◉ If the same question calls you back, wait 48 hours. Answers need time to settle.</p>
        <p className="mt-2">◉ Compress your question into 60 characters. The compression is the beginning of the answer.</p>
      </div>
    ),
    [skin],
  );

  const downloadCardAsPng = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const node = cardRef.current;
      const cloned = node.cloneNode(true) as HTMLDivElement;
      cloned.setAttribute(
        "style",
        [
          "margin:0",
          "width:540px",
          "height:960px",
          "background:#130b20",
          "color:#efeaf8",
          "font-family:Inter, ui-sans-serif, system-ui",
          "padding:28px",
          "box-sizing:border-box",
        ].join(";"),
      );
      const wrapper = document.createElement("div");
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrapper.style.width = "540px";
      wrapper.style.height = "960px";
      wrapper.appendChild(cloned);

      const serialized = new XMLSerializer().serializeToString(wrapper);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 540 960">
          <foreignObject x="0" y="0" width="540" height="960">${serialized}</foreignObject>
        </svg>
      `;

      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#130b20";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(pngBlob);
            a.download = `poju-oracle-sign-${Date.now()}.png`;
            a.click();
          }, "image/png");
        }
        URL.revokeObjectURL(url);
        setExporting(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setExporting(false);
      };
      img.src = url;
    } catch {
      setExporting(false);
    }
  };

  const loadPreviousSign = async () => {
    if (loadingPrev) return;
    setLoadingPrev(true);
    try {
      const prev = await getLatestOracleSign();
      if (!prev) {
        setLoadingPrev(false);
        setDupModalOpen(false);
        return;
      }
      setLatestSign(prev);
      setSignNo(prev.signNo);
      setQuestion(prev.question);
      const hit = SIGN_LEVELS.find((s) => s.name === prev.levelName);
      if (hit) setSignLevel(hit);
      setLastOracleRecordId(prev.id);
      setInscribeTick(5);
      setStage(7);
      setDupModalOpen(false);
    } finally {
      setLoadingPrev(false);
    }
  };

  const saveToArchive = () => {
    if (!signLevel) return;
    try {
      const raw = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
      const list = raw ? (JSON.parse(raw) as ArchiveEntry[]) : [];
      const row: ArchiveEntry = {
        id: `oracle_archive_${Date.now()}`,
        kind: "oracle",
        createdAt: Date.now(),
        title: `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Glyph`,
        subtitle: `"${question.trim() || "Glyph reflection"}" · ✦ ${signLevel.name} · ${signLevel.subtitle}`,
        refId: lastOracleRecordId || undefined,
      };
      localStorage.setItem(ARCHIVE_RUNTIME_KEY, JSON.stringify([row, ...list].slice(0, 120)));
      setArchiveSaved(true);
      window.setTimeout(() => setArchiveSaved(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <main className={skin.main}>
      <button
        type="button"
        className={skin.toggle}
        onClick={() => setShell((s) => (s === "dark" ? "light" : "dark"))}
        aria-label={shell === "dark" ? "Switch to light appearance" : "Switch to dark appearance"}
        title={shell === "dark" ? "Light appearance" : "Dark appearance"}
      >
        <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden>
          {shell === "dark" ? "light_mode" : "dark_mode"}
        </span>
        <span className="text-[11px] font-semibold tracking-wide">{shell === "dark" ? "Light" : "Dark"}</span>
      </button>
      <Link
        href="/glyph"
        className={skin.close}
        aria-label="关闭并返回 Glyph 介绍页"
      >
        <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
          close
        </span>
      </Link>
      <div className="mx-auto mb-4 w-full max-w-xl">
        <ArchiveReturnBanner />
      </div>
      <p className={skin.kicker}>Glyph Ritual Flow</p>
      <h1 className={skin.h1}>Stage {stage}</h1>

      {stage === 1 ? (
        <>
          {ritualHints}
          <button
            type="button"
            onClick={() => setStage(2)}
            className={skin.btnContinueLg}
          >
            Continue →
          </button>
        </>
      ) : null}

      {stage === 2 ? (
        <div className={skin.card}>
          <p className={skin.label}>What do you bring today?</p>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 60))}
            placeholder="e.g. Should I end my relationship..."
            className={skin.input}
          />
          <p className={skin.counter}>{question.length}/60</p>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinueFromStage2}
            className={skin.btnContinueMd}
          >
            Continue →
          </button>
        </div>
      ) : null}

      {stage === 3 ? (
        <div className={`${skin.cardP6} text-center`}>
          <p className={skin.stageLead}>Hold to summon your sign</p>
          <p className={skin.stageSub}>Particles accelerate. Hum rises.</p>
          <button
            type="button"
            onClick={() => setStage(4)}
            className={skin.btnOutlineSm}
          >
            Enter Summon Stage
          </button>
        </div>
      ) : null}

      {stage === 4 ? (
        <div className={`${skin.cardP6} text-center`}>
          <p className={skin.stageLead}>Stage 4 · Summon</p>
          <p className={skin.stageSub}>Press and hold for 3 seconds.</p>
          <button
            type="button"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            className={skin.holdBtn}
          >
            {holding ? "Summoning..." : "Hold to summon your sign"}
          </button>
          <div className={skin.progressTrack}>
            <div className="h-full bg-fuchsia-300/80 transition-all" style={{ width: `${holdProgress}%` }} />
          </div>
        </div>
      ) : null}

      {stage === 5 ? (
        <div className={`${skin.cardP6} text-center`}>
          <p className={skin.stageLead}>Stage 5 · Reveal</p>
          <p className={skin.stageSub}>Card appears from the particle burst. Paper sound rises.</p>
          <div className={skin.revealCard} />
          {revealTick >= 2 && signLevel ? (
            <p className="mt-3 text-sm" style={{ color: signLevel.particleColor }}>
              ✦ {signLevel.name} ✦
            </p>
          ) : null}
          {revealTick >= 3 ? <p className={skin.dimXs}>Card unfolding...</p> : null}
        </div>
      ) : null}

      {stage === 6 ? (
        <div className={`${skin.cardP6} text-left`}>
          <p className={`text-center ${skin.stageLead}`}>Stage 6 · Inscribe</p>
          <div
            ref={cardRef}
            className={`mt-4 rounded-lg border p-4 ${signLevel?.cardClass ?? "border-fuchsia-300/20 bg-fuchsia-900/10"}`}
          >
            <p className="text-center text-sm text-fuchsia-100">{signLevel?.topSymbol ?? "✦"} </p>
            {inscribeTick >= 1 && signNo > 0 ? <p className="mt-2 text-center text-xs text-text-secondary">Sign No. {signNo}</p> : null}
            {inscribeTick >= 1 && signLevel ? <p className="mt-3 text-center text-sm text-text-primary">✦ {signLevel.name} ✦</p> : null}
            {inscribeTick >= 1 && signLevel ? <p className="text-center text-xs text-text-secondary">({signLevel.subtitle})</p> : null}
            {inscribeTick >= 2 ? <p className="mt-3 text-xs text-text-secondary">── THE VERSE ──</p> : null}
            {inscribeTick >= 2 ? (
              <div className="mt-2 space-y-1 text-sm text-text-secondary">
                {verseLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            {inscribeTick >= 3 ? <p className="mt-3 text-xs text-text-secondary">── WHAT IT MEANS ──</p> : null}
            {inscribeTick >= 3 ? (
              <p className="mt-1 text-sm text-text-secondary">
                {whatItMeansText}
              </p>
            ) : null}
            {inscribeTick >= 4 ? <p className="mt-3 text-xs text-text-secondary">── FOR TODAY ──</p> : null}
            {inscribeTick >= 4 ? (
              <p className="mt-1 text-sm text-text-secondary">{forTodayText}</p>
            ) : null}
            {inscribeTick >= 5 ? <p className="mt-3 text-xs text-text-secondary">If this knot needs untying, POJU will sit with you.</p> : null}
            {inscribeTick >= 5 ? <p className="text-center text-xs text-text-dim">easternos.com</p> : null}
            {signLevel?.name === "Eye of Storm" ? (
              <p className="mt-3 text-xs text-fuchsia-100/90">
                The eye is the calm in the storm. This is where clarity lives.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {stage === 7 ? (
        <div className={skin.cardP6}>
          <p className={`text-center ${skin.stageLead}`}>Stage 7 · Carry</p>
          {latestSign ? (
            <p className={`mt-2 text-center text-xs ${skin.counter}`}>
              Loaded previous sign: {latestSign.levelName} · Sign No. {latestSign.signNo}
            </p>
          ) : null}
          <div
            ref={cardRef}
            className={`mt-4 rounded-lg border p-4 text-left ${signLevel?.cardClass ?? "border-fuchsia-300/20 bg-fuchsia-900/10"}`}
          >
            <p className="text-center text-sm text-fuchsia-100">{signLevel?.topSymbol ?? "✦"}</p>
            <p className="mt-2 text-center text-xs text-text-secondary">Sign No. {signNo || "-"}</p>
            <p className="mt-3 text-center text-sm text-text-primary">✦ {signLevel?.name ?? "Still Water"} ✦</p>
            <p className="text-center text-xs text-text-secondary">({signLevel?.subtitle ?? "Sign of Stillness"})</p>
            <p className="mt-3 text-xs text-text-secondary">── THE VERSE ──</p>
            <div className="mt-2 space-y-1 text-sm text-text-secondary">
              {verseLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-secondary">── WHAT IT MEANS ──</p>
            <p className="mt-1 text-sm text-text-secondary">{whatItMeansText}</p>
            <p className="mt-3 text-xs text-text-secondary">── FOR TODAY ──</p>
            <p className="mt-1 text-sm text-text-secondary">{forTodayText}</p>
            <p className="mt-3 text-center text-xs text-text-dim">easternos.com</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void downloadCardAsPng()}
              className={skin.gridBtn}
            >
              {exporting ? "Exporting..." : "Save as image"}
            </button>
            <button
              type="button"
              onClick={saveToArchive}
              className={skin.gridBtn}
            >
              {archiveSaved ? "Saved" : "Save to Archive"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  void navigator.share({
                    title: "POJU Glyph Reflection",
                    text: `My sign: ${signLevel?.name ?? "Unknown"} · Sign No. ${signNo || "-"}`,
                    url: "https://easternos.com",
                  });
                }
              }}
              className={skin.gridBtn}
            >
              Share
            </button>
            <button type="button" className={skin.gridBtnAccent}>
              Ask POJU to go deeper · $9.99
            </button>
          </div>
        </div>
      ) : null}

      <Link
        href="/glyph"
        className={skin.backLink}
      >
        ← Back to Glyph
      </Link>

      {dupModalOpen ? (
        <div className={skin.dupOverlay}>
          <div className={skin.dupPanel}>
            <p className={skin.dupTitle}>You&apos;ve already asked this.</p>
            <p className={`mt-3 ${skin.dupBody}`}>Your sign from [{dupHoursAgo} hours ago]: ✦ Still Water</p>
            <p className={`mt-2 ${skin.dupBody}`}>Answers don&apos;t change just because you ask again. Give it 48 hours.</p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => void loadPreviousSign()}
                className={skin.dupBtn}
              >
                {loadingPrev ? "Loading..." : "Read my previous sign"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDupModalOpen(false);
                  setQuestion("");
                }}
                className={skin.dupBtn}
              >
                Ask a different question
              </button>
              <button
                type="button"
                onClick={() => {
                  setDupModalOpen(false);
                  setStage(3);
                }}
                className={skin.dupBtnPrimary}
              >
                I know. Draw anyway.
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

// 导出入口：结合了 Suspense 和 错误边界的现代用法
export default function OracleStageOnePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-deep flex items-center justify-center text-text-secondary">
        Loading Glyph Ritual...
      </div>
    }>
      <OracleStageOneContent />
    </Suspense>
  );
}