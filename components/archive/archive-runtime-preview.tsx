"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildMockArchiveEntries, shouldShowArchiveMockData } from "@/lib/archive/mock-archive-entries";
import { ARCHIVE_RUNTIME_KEY, ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import type { ArchiveEntry, ArchiveProductKind } from "@/lib/archive/types";
import { loadSecureChatSnapshot } from "@/lib/chat/secure-storage";
import {
  getOracleArchiveEntryById,
  type OracleArchiveEntry,
} from "@/lib/oracle/saveToArchive";
import { getOracleSignById, type OracleSignRecord } from "@/lib/oracle/storage";
const SYNCRO_ARCHIVE_KEY = "pojulife_syncro_archive_v1";
type Source = "runtime" | "mock";
type FilterKey = "all" | ArchiveProductKind;
type MixedEntry = ArchiveEntry & { source: Source };
type EntryDetail =
  | { kind: "oracle"; sign: OracleSignRecord }
  | { kind: "oracle-full"; entry: OracleArchiveEntry }
  | {
      kind: "syncro";
      capture: {
        id: string;
        direction: string;
        rating: string;
        best: string;
        avoid: string;
        name: string;
      };
    }
  | {
      kind: "poju";
      session: {
        id: string;
        title: string;
        status: "active" | "suspended" | "resolved" | "archived";
        createdAt: number;
        messageCount: number;
      };
    }
  | { kind: "poju"; note: string };

function dayLabel(ts: number): "Today" | "Yesterday" | "Earlier" {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (x === today) return "Today";
  if (x === yesterday) return "Yesterday";
  return "Earlier";
}

function archiveKindLabel(kind: ArchiveProductKind): string {
  switch (kind) {
    case "oracle":
      return "Glyph";
    case "poju":
      return "POJU";
    case "syncro":
      return "Syncro";
    default:
      return kind;
  }
}

function formatSavedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ArchiveRuntimePreview() {
  const router = useRouter();
  const [runtimeEntries, setRuntimeEntries] = useState<ArchiveEntry[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedEntry, setSelectedEntry] = useState<MixedEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MixedEntry | null>(null);

  useEffect(() => {
    const loadRuntime = () => {
      try {
        const raw = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
        if (!raw) {
          setRuntimeEntries([]);
          return;
        }
        setRuntimeEntries(JSON.parse(raw) as ArchiveEntry[]);
      } catch {
        setRuntimeEntries([]);
      }
    };
    loadRuntime();
    window.addEventListener(ARCHIVE_UPDATED_EVENT, loadRuntime);
    return () => window.removeEventListener(ARCHIVE_UPDATED_EVENT, loadRuntime);
  }, []);

  const removeRuntimeEntry = (id: string) => {
    setRuntimeEntries((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try {
        localStorage.setItem(ARCHIVE_RUNTIME_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const confirmRemoveRuntimeEntry = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    removeRuntimeEntry(id);
    setSelectedEntry((cur) => (cur?.id === id ? null : cur));
    setDeleteTarget(null);
  };

  const previewEntries = useMemo(() => {
    const merged: MixedEntry[] = runtimeEntries.map((x) => ({ ...x, source: "runtime" }));
    if (shouldShowArchiveMockData()) {
      merged.push(...buildMockArchiveEntries().map((x) => ({ ...x, source: "mock" as const })));
    }
    return merged
      .filter((x) => (filter === "all" ? true : x.kind === filter))
      .filter((x) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${x.title} ${x.subtitle ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 24);
  }, [runtimeEntries, query, filter]);

  const grouped = useMemo(() => {
    const buckets: Record<"Today" | "Yesterday" | "Earlier", MixedEntry[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    previewEntries.forEach((e) => {
      buckets[dayLabel(e.createdAt)].push(e);
    });
    return buckets;
  }, [previewEntries]);

  const openEntry = (entry: MixedEntry) => {
    const params = new URLSearchParams({
      from: "archive",
      entry: entry.id,
      kind: entry.kind,
    });
    if (entry.kind === "poju") {
      router.push(`/chat?${params.toString()}`);
      return;
    }
    if (entry.kind === "oracle") {
      if (entry.oracleVariant === "full_reading") {
        setSelectedEntry(entry);
        return;
      }
      router.push(`/glyph/stage-1?${params.toString()}`);
      return;
    }
    router.push(`/syncro?${params.toString()}`);
  };

  useEffect(() => {
    if (!selectedEntry) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    if (selectedEntry.source !== "runtime" || !selectedEntry.refId) {
      setDetail(
        selectedEntry.kind === "poju"
          ? { kind: "poju", note: "Session detail is available after opening in chat." }
          : null,
      );
      return;
    }

    let stop = false;
    const load = async () => {
      setDetailLoading(true);
      try {
        if (selectedEntry.kind === "oracle") {
          const ref = selectedEntry.refId as string;
          const sign = await getOracleSignById(ref);
          if (sign) {
            if (!stop) setDetail({ kind: "oracle", sign });
            return;
          }
          const full = await getOracleArchiveEntryById(ref);
          if (full) {
            if (!stop) setDetail({ kind: "oracle-full", entry: full });
            return;
          }
          if (!stop) setDetail(null);
          return;
        }
        if (selectedEntry.kind === "syncro") {
          const raw = localStorage.getItem(SYNCRO_ARCHIVE_KEY);
          const rows = raw
            ? (JSON.parse(raw) as Array<{
                id: string;
                direction: string;
                rating: string;
                best: string;
                avoid: string;
                name: string;
              }>)
            : [];
          const hit = rows.find((r) => r.id === selectedEntry.refId);
          if (!stop) setDetail(hit ? { kind: "syncro", capture: hit } : null);
          return;
        }
        if (selectedEntry.kind === "poju") {
          const snapshot = await loadSecureChatSnapshot();
          const sid = selectedEntry.refId as string;
          const session = snapshot?.sessions?.find((s) => s.id === sid);
          const messageCount = snapshot?.messages?.filter((m) => m.sessionId === sid).length ?? 0;
          if (!stop) {
            setDetail(
              session
                ? {
                    kind: "poju",
                    session: {
                      id: session.id,
                      title: session.title,
                      status: session.status,
                      createdAt: session.createdAt,
                      messageCount,
                    },
                  }
                : { kind: "poju", note: "Session detail not found in local snapshot." },
            );
          }
          return;
        }
      } catch {
        if (!stop) setDetail(null);
      } finally {
        if (!stop) setDetailLoading(false);
      }
    };
    void load();
    return () => {
      stop = true;
    };
  }, [selectedEntry]);

  if (previewEntries.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 border-l-2 border-[#d0bcff]/30 pl-2 font-['Inter'] text-[12px] font-medium uppercase tracking-[0.05em] text-[#958ea0]">
        Local data preview
      </h2>
      <div className="mb-4 space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your history..."
          className="w-full rounded-xl border border-[#494454]/30 bg-[#2c2832]/50 px-4 py-3 font-['Inter'] text-[14px] leading-[1.6] text-[#e7e0ed] placeholder:text-[#cbc3d7]/40"
        />
        <div className="flex flex-wrap gap-2">
          {([
            { key: "all", label: "All" },
            { key: "poju", label: "POJU" },
            { key: "syncro", label: "Syncro" },
            { key: "oracle", label: "Glyph" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={`rounded-full border px-4 py-1.5 text-[12px] uppercase tracking-[0.05em] ${
                filter === opt.key
                  ? "border-[#d0bcff]/30 bg-[#d0bcff]/12 text-[#d0bcff]"
                  : "border-[#494454]/20 bg-[#2c2832]/50 text-[#cbc3d7]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {(["Today", "Yesterday", "Earlier"] as const).map((section) => {
        const list = grouped[section];
        if (list.length === 0) return null;
        return (
          <div key={section} className="mb-6">
            <h3 className="mb-3 border-l-2 border-[#494454]/50 pl-2 font-['Inter'] text-[12px] font-medium uppercase tracking-[0.05em] text-[#958ea0]">
              {section}
            </h3>
            <div className="space-y-3">
              {list.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/10 bg-[rgba(30,30,34,0.5)] p-4 backdrop-blur-[16px]">
                  <p className="font-['Inter'] text-[11px] uppercase tracking-[0.06em] text-[#958ea0]">
                    {archiveKindLabel(entry.kind)}
                  </p>
                  <h4 className="mt-1 font-['Manrope'] text-[18px] font-semibold text-[#e7e0ed]">{entry.title}</h4>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[#958ea0]">Saved · {formatSavedAt(entry.createdAt)}</p>
                  {entry.subtitle ? (
                    <p className="mt-1 font-['Inter'] text-[14px] leading-[1.5] text-[#cbc3d7]/70">{entry.subtitle}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEntry(entry)}
                      className="rounded-lg border border-[#d0bcff]/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.05em] text-[#d0bcff]"
                    >
                      Open
                    </button>
                    {entry.source === "runtime" ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        className="rounded-lg border border-red-400/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.05em] text-red-300"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-[11px] uppercase tracking-[0.05em] text-[#958ea0]">Mock</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {selectedEntry ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1c1824] p-5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-[#958ea0]">
              {archiveKindLabel(selectedEntry.kind)}
            </p>
            <h4 className="mt-1 font-['Manrope'] text-[22px] font-semibold text-[#e7e0ed]">{selectedEntry.title}</h4>
            {selectedEntry.subtitle ? (
              <p className="mt-2 font-['Inter'] text-[15px] leading-[1.6] text-[#cbc3d7]/80">{selectedEntry.subtitle}</p>
            ) : null}
            <p className="mt-3 text-xs text-[#958ea0]">{new Date(selectedEntry.createdAt).toLocaleString()}</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-left">
              {detailLoading ? <p className="text-xs text-[#958ea0]">Loading details...</p> : null}
              {!detailLoading && detail?.kind === "oracle" ? (
                <div className="space-y-1 text-sm">
                  <p className="text-[#e7e0ed]">
                    Sign No. {detail.sign.signNo} · {detail.sign.levelName}
                  </p>
                  <p className="text-[#cbc3d7]/80">({detail.sign.levelSubtitle})</p>
                  <p className="text-[#cbc3d7]/75">For today: {detail.sign.forToday}</p>
                </div>
              ) : null}
              {!detailLoading && detail?.kind === "oracle-full" ? (
                <div className="max-h-[min(50vh,420px)] space-y-4 overflow-y-auto pr-1 text-sm">
                  {(() => {
                    const reading = detail.entry.full_reading as unknown as Record<string, unknown>;
                    const exploration = (reading.exploration ?? {}) as Record<string, unknown>;
                    return (
                      <>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Your pattern</p>
                    <p className="mt-1 whitespace-pre-wrap text-[#cbc3d7]/90">{String(reading.wind_category_blurb ?? "")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Classical voice</p>
                    <p className="mt-1 whitespace-pre-wrap text-[#cbc3d7]/90">{String(reading.classical_voice ?? "")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Meaning for question</p>
                    <p className="mt-1 whitespace-pre-wrap text-[#cbc3d7]/90">{String(reading.meaning_for_question ?? "")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Hidden tension</p>
                    <p className="mt-1 text-[#cbc3d7]/80">{String(reading.hidden_tension ?? "")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Your moment</p>
                    <p className="mt-1 text-[#cbc3d7]/80">{String(reading.your_moment ?? "")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Exploration</p>
                    <p className="mt-1 text-[#cbc3d7]/80">{String(exploration.text ?? "")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#d0bcff]/80">Reflection</p>
                    <p className="mt-1 text-[#cbc3d7]/80">{String(reading.reflection_question ?? "")}</p>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}
              {!detailLoading && detail?.kind === "syncro" ? (
                <div className="space-y-1 text-sm">
                  <p className="text-[#e7e0ed]">
                    {detail.capture.name} · Facing {detail.capture.direction} · {detail.capture.rating}
                  </p>
                  <p className="text-[#cbc3d7]/75">Best: {detail.capture.best}</p>
                  <p className="text-[#cbc3d7]/60">Avoid: {detail.capture.avoid}</p>
                </div>
              ) : null}
              {!detailLoading && detail?.kind === "poju" && "note" in detail ? (
                <p className="text-xs text-[#958ea0]">{detail.note}</p>
              ) : null}
              {!detailLoading && detail?.kind === "poju" && "session" in detail ? (
                <div className="space-y-1 text-sm">
                  <p className="text-[#e7e0ed]">{detail.session.title}</p>
                  <p className="text-[#cbc3d7]/80">
                    {detail.session.status === "archived" ? "Archived" : "Active"} · {detail.session.messageCount} messages
                  </p>
                  <p className="text-[#958ea0]">{new Date(detail.session.createdAt).toLocaleString()}</p>
                </div>
              ) : null}
              {!detailLoading && !detail ? <p className="text-xs text-[#958ea0]">No linked detail found for this entry.</p> : null}
            </div>
            <div className="mt-5 flex justify-end">
              {!(selectedEntry.kind === "oracle" && selectedEntry.oracleVariant === "full_reading") ? (
                <button
                  type="button"
                  onClick={() => {
                    openEntry(selectedEntry);
                    setSelectedEntry(null);
                  }}
                  className="mr-2 rounded-lg border border-[#d0bcff]/25 px-4 py-2 text-xs uppercase tracking-[0.05em] text-[#d0bcff]"
                >
                  Open
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="rounded-lg border border-[#494454] px-4 py-2 text-xs uppercase tracking-[0.05em] text-[#e7e0ed]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1824] p-5 shadow-xl">
            <h3 className="font-['Manrope'] text-lg font-semibold text-[#e7e0ed]">Delete this entry?</h3>
            <p className="mt-3 font-['Inter'] text-[14px] leading-relaxed text-[#cbc3d7]/85">
              This will permanently remove it from your local Archive. You cannot undo this action.
            </p>
            {deleteTarget.title ? (
              <p className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-['Inter'] text-[13px] text-[#e7e0ed]/90">
                {deleteTarget.title}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#494454] px-4 py-2 text-xs uppercase tracking-[0.05em] text-[#e7e0ed]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveRuntimeEntry}
                className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-2 text-xs uppercase tracking-[0.05em] text-red-200"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

