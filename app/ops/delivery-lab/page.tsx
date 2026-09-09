"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  importLocalProfileForLab,
  importLocalSessionForLab,
  listLocalDataForLab,
  type LabLocalProfileOption,
  type LabLocalScanMeta,
  type LabLocalSessionOption,
} from "@/lib/llm/pro/delivery/lab/import-local-session";

export default function DeliveryLabCreatePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [locale, setLocale] = useState("zh");
  const [question, setQuestion] = useState("");
  const [desired, setDesired] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [baseJson, setBaseJson] = useState("");
  const [coreJson, setCoreJson] = useState("");
  const [agendaJson, setAgendaJson] = useState("[]");
  const [sessions, setSessions] = useState<LabLocalSessionOption[]>([]);
  const [profiles, setProfiles] = useState<LabLocalProfileOption[]>([]);
  const [scanMeta, setScanMeta] = useState<LabLocalScanMeta | null>(null);
  const [pickedSession, setPickedSession] = useState("");
  const [pickedProfile, setPickedProfile] = useState("");

  const probe = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/login", { method: "GET", credentials: "include" });
      setAuthed(res.ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  const loadLocalLists = useCallback(async () => {
    try {
      const data = await listLocalDataForLab();
      setSessions(data.sessions);
      setProfiles(data.profiles);
      setScanMeta(data.meta);
      if (data.sessions.length === 0 && data.profiles.length === 0) {
        setImportNote(
          `本 origin 扫描：会话行=${data.meta.session_rows_total}，盘行=${data.meta.profile_rows_total}（有底座=${data.meta.profiles_with_base}）。` +
            ` owner=${data.meta.owner_key} · device=${data.meta.device_id} · ${data.meta.origin}` +
            (data.meta.session_rows_total === 0 && data.meta.profile_rows_total === 0
              ? " — IndexedDB 为空：可能是 www/裸域不一致、隐私模式、或聊天不在此域名。可在聊天页 Application→IndexedDB 看是否有 pojulife_v4。"
              : " — 有行但解密/过滤后无可导入项，点刷新或手贴 JSON。"),
        );
      } else {
        setImportNote(
          `已扫描 ${data.meta.origin}：会话 ${data.sessions.length}/${data.meta.session_rows_total}，盘 ${data.profiles.length}/${data.meta.profile_rows_total}。`,
        );
      }
    } catch (e) {
      setImportNote(
        e instanceof Error ? e.message : "读取本机 IndexedDB 失败（须在同一域名浏览器）",
      );
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    if (authed) void loadLocalLists();
  }, [authed, loadLocalLists]);

  async function onImportSession() {
    if (!pickedSession) return;
    setImportBusy(true);
    setError(null);
    setImportNote(null);
    try {
      const result = await importLocalSessionForLab(pickedSession);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      const p = result.payload;
      setLocale(p.locale);
      setSessionId(p.session_id);
      setQuestion(p.original_question);
      setDesired(p.desired_outcome);
      setBaseJson(JSON.stringify(p.base_analysis, null, 2));
      setCoreJson(
        p.breakthrough_core ? JSON.stringify(p.breakthrough_core, null, 2) : "",
      );
      setAgendaJson(JSON.stringify(p.covered_agenda, null, 2));
      setImportNote(
        p.warnings.length
          ? `已导入会话。注意：${p.warnings.join("；")}`
          : "已从本机会话导入问题 / 期望 / agenda / core / base_analysis。可点「创建 Lab」。",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "import_failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function onImportProfile() {
    if (!pickedProfile) return;
    setImportBusy(true);
    setError(null);
    setImportNote(null);
    try {
      const result = await importLocalProfileForLab(pickedProfile);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      const p = result.payload;
      setSessionId(p.session_id);
      setBaseJson(JSON.stringify(p.base_analysis, null, 2));
      if (!question.trim()) setQuestion("");
      setImportNote(
        `${p.warnings.join("；")} — 请填写 Original question 后再创建。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "import_failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let base_analysis: unknown;
      try {
        base_analysis = JSON.parse(baseJson);
      } catch {
        setError("base_analysis JSON 解析失败");
        return;
      }
      let breakthrough_core: unknown = null;
      if (coreJson.trim()) {
        try {
          breakthrough_core = JSON.parse(coreJson);
        } catch {
          setError("breakthrough_core JSON 解析失败");
          return;
        }
      }
      let covered_agenda: unknown = [];
      try {
        covered_agenda = JSON.parse(agendaJson || "[]");
      } catch {
        setError("covered_agenda JSON 解析失败");
        return;
      }

      const res = await fetch("/api/ops/delivery-lab/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          original_question: question,
          desired_outcome: desired || undefined,
          session_id: sessionId || undefined,
          base_analysis,
          breakthrough_core,
          covered_agenda,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        lab?: { lab_id: string };
      };
      if (!res.ok || !data.ok || !data.lab?.lab_id) {
        if (res.status === 401) {
          setAuthed(false);
          setError("未登录 — 请先到 /ops 登录");
          return;
        }
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/ops/delivery-lab/${data.lab.lab_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f12] px-4 py-10 text-[#e4e4e7]">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#71717a]">POJU · ops</p>
          <h1 className="mt-2 font-primary text-2xl font-semibold text-white">
            Delivery Lab · 逐步生成查验台
          </h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">
            点按钮才调模型。人工通过后才解锁下一步。不写用户正式 shelf。
          </p>
          <p className="mt-2 text-sm">
            <Link href="/ops" className="text-[#f2ca50] underline-offset-2 hover:underline">
              ← Ops 首页
            </Link>
          </p>
        </header>

        {authed === null ? (
          <p className="text-[#71717a]">Checking session…</p>
        ) : !authed ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            未登录。请先{" "}
            <Link href="/ops" className="text-[#f2ca50] underline">
              /ops 登录
            </Link>
            。
          </p>
        ) : (
          <form onSubmit={onCreate} className="space-y-4">
            <section className="rounded-md border border-[#f2ca50]/25 bg-[#101417] p-4">
              <h2 className="text-sm font-medium text-[#f2ca50]">从本机导入（推荐）</h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                八字与会话在浏览器 IndexedDB（库名 pojulife_v4），不在服务器。须
                <strong className="text-[#e4e4e7]"> 同一 origin </strong>
                （easternos.com 与 www.easternos.com 是两套库）。下面已扫描全部 owner/device，不再只看当前登录分区。
              </p>
              {scanMeta ? (
                <p className="mt-2 font-mono text-[10px] text-[#71717a]">
                  scan {scanMeta.origin} · sessions={scanMeta.session_rows_total} ·
                  profiles={scanMeta.profile_rows_total} · base={scanMeta.profiles_with_base} ·{" "}
                  {scanMeta.owner_key}
                </p>
              ) : null}

              <label className="mt-3 block text-sm">
                本地会话
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0b0f12] px-3 py-2 font-mono text-xs"
                  value={pickedSession}
                  onChange={(e) => setPickedSession(e.target.value)}
                >
                  <option value="">— 选择 session —</option>
                  {sessions.map((s) => (
                    <option key={s.session_id} value={s.session_id}>
                      {(s.original_question || "").slice(0, 36)} · {s.phase ?? "?"} · a=
                      {s.covered_agenda_count}
                      {s.has_breakthrough_core ? " · core" : ""}
                      {s.owner_mismatch ? " · ⚠owner" : ""} · {s.session_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={importBusy || !pickedSession}
                  onClick={() => void onImportSession()}
                  className="rounded-md bg-[#f2ca50] px-3 py-1.5 text-sm font-medium text-[#0b0f12] disabled:opacity-40"
                >
                  {importBusy ? "导入中…" : "导入此会话 → 填表"}
                </button>
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => void loadLocalLists()}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-sm"
                >
                  刷新列表
                </button>
              </div>

              <label className="mt-4 block text-sm">
                或仅选本地盘（无会话时）
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0b0f12] px-3 py-2 font-mono text-xs"
                  value={pickedProfile}
                  onChange={(e) => setPickedProfile(e.target.value)}
                >
                  <option value="">— 选择 profile —</option>
                  {profiles.map((p) => (
                    <option key={p.profile_id} value={p.profile_id}>
                      {p.display_name}
                      {p.has_structured ? " · structured" : " · 缺structured"}
                      {p.owner_mismatch ? " · ⚠owner" : ""} · {p.profile_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={importBusy || !pickedProfile}
                onClick={() => void onImportProfile()}
                className="mt-2 rounded-md border border-[#9cf0ff]/40 px-3 py-1.5 text-sm text-[#9cf0ff] disabled:opacity-40"
              >
                导入此盘 → base_analysis
              </button>

              {sessions.length === 0 && profiles.length === 0 ? (
                <p className="mt-3 text-xs text-[#71717a]">
                  本机暂无会话/盘。请先在本站走完开局+底座，或手动粘贴下方 JSON。
                </p>
              ) : null}
              {importNote ? (
                <p className="mt-3 text-xs text-[#9cf0ff]" role="status">
                  {importNote}
                </p>
              ) : null}
            </section>

            <label className="block text-sm">
              Locale
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Original question *
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 text-sm"
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Desired outcome
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 text-sm"
                value={desired}
                onChange={(e) => setDesired(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Session id
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-sm"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              base_analysis JSON *（须含 structured）
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                rows={10}
                value={baseJson}
                onChange={(e) => setBaseJson(e.target.value)}
                placeholder='{"structured":{...},"content":"..."}'
                required
              />
            </label>
            <label className="block text-sm">
              breakthrough_core JSON（可选，P3/P4 feed 更全）
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                rows={5}
                value={coreJson}
                onChange={(e) => setCoreJson(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              covered_agenda JSON
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                rows={4}
                value={agendaJson}
                onChange={(e) => setAgendaJson(e.target.value)}
              />
            </label>
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[#f2ca50] px-4 py-2.5 text-sm font-medium text-[#0b0f12] disabled:opacity-50"
            >
              {busy ? "Creating…" : "创建 Lab →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
