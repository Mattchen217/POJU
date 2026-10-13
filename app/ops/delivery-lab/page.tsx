"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import { LabOpsBirthForm } from "./_components/LabOpsBirthForm";
import { calculateProfile } from "@/lib/calculations/profile";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import type { BirthInfo } from "@/lib/profile/types";

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
  const [questionCategory, setQuestionCategory] = useState("");
  const [sessions, setSessions] = useState<LabLocalSessionOption[]>([]);
  const [profiles, setProfiles] = useState<LabLocalProfileOption[]>([]);
  const [scanMeta, setScanMeta] = useState<LabLocalScanMeta | null>(null);
  const [pickedSession, setPickedSession] = useState("");
  const [pickedProfile, setPickedProfile] = useState("");
  const [createMode, setCreateMode] = useState<"delivery_only" | "full_pipeline">(
    "full_pipeline",
  );
  const getBirthInfoRef = useRef<(() => BirthInfo | null) | null>(null);

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
    if (authed && createMode === "delivery_only") void loadLocalLists();
  }, [authed, createMode, loadLocalLists]);

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
      setQuestionCategory(p.question_category?.trim() ? p.question_category : "");
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
      setCoreJson("");
      setAgendaJson("[]");
      setQuestionCategory("");
      if (!question.trim()) setQuestion("");
      setDesired("");
      setImportNote(
        `${p.warnings.join("；")} — 请填写 Original question 后再创建。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "import_failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function createLab(body: Record<string, unknown>) {
    const res = await fetch("/api/ops/delivery-lab/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  }

  async function onCreateFullPipeline(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const birth = getBirthInfoRef.current?.() ?? null;
      if (!birth) {
        setError("请填完整：出生日期、时间、地点（搜索选城市）、性别");
        return;
      }
      const profile = await calculateProfile(birth);
      const local = buildStreamLocalDataFromProfile(profile, {
        output_language: locale.startsWith("en")
          ? "en"
          : "zh",
      });
      if (!local.structured) {
        setError("排盘失败：未能生成 structured");
        return;
      }
      await createLab({
        mode: "full_pipeline",
        locale,
        original_question: "(lab pipeline)",
        base_analysis: { structured: local.structured },
        breakthrough_core: null,
        covered_agenda: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateDeliveryOnly(e: FormEvent) {
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
      if (question.trim().length < 2) {
        setError("交付-only 需要 Original question");
        return;
      }
      await createLab({
        mode: "delivery_only",
        locale,
        original_question: question,
        desired_outcome: desired || undefined,
        session_id: sessionId || undefined,
        base_analysis,
        breakthrough_core,
        covered_agenda,
        question_category: questionCategory.trim() || null,
        selected_stored_profile_id: pickedProfile || null,
      });
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
            选模式 → 填必填项 → 创建 Lab。全流程在详情页聊天；交付-only 直接跑第 4 阶段。
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
          <>
            <section className="mb-4 rounded-md border border-white/10 bg-[#101417] p-4">
              <h2 className="text-sm font-medium text-white">创建模式</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateMode("full_pipeline")}
                  className={[
                    "rounded px-3 py-1.5 text-xs",
                    createMode === "full_pipeline"
                      ? "bg-[#f2ca50] text-black"
                      : "border border-white/20 text-[#a1a1aa]",
                  ].join(" ")}
                >
                  全流程测试 · Stage1–3 + 交付
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("delivery_only")}
                  className={[
                    "rounded px-3 py-1.5 text-xs",
                    createMode === "delivery_only"
                      ? "bg-[#f2ca50] text-black"
                      : "border border-white/20 text-[#a1a1aa]",
                  ].join(" ")}
                >
                  交付-only · 只测第 4 阶段 + 30 天提醒
                </button>
              </div>
            </section>

            {createMode === "full_pipeline" ? (
              <form onSubmit={onCreateFullPipeline} className="space-y-4">
                <section className="rounded-md border border-[#f2ca50]/30 bg-[#101417] p-4">
                  <h2 className="text-sm font-medium text-[#f2ca50]">主盘出生信息（必填）</h2>
                  <p className="mt-1 text-xs text-[#a1a1aa]">
                    填好后点创建：系统本地排盘生成 structured，再进详情页聊天。问题、agenda、breakthrough
                    都在聊天里产生，此处不用填。
                  </p>
                  <div className="mt-4">
                    <LabOpsBirthForm getBirthInfoRef={getBirthInfoRef} />
                  </div>
                </section>

                <label className="block text-sm">
                  输出语言
                  <select
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 text-sm"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    <option value="zh">中文 zh</option>
                    <option value="en">English en</option>
                    <option value="fr">Français fr</option>
                    <option value="es">Español es</option>
                  </select>
                </label>

                {error ? (
                  <p className="text-sm text-red-300" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-[#f2ca50] px-4 py-2.5 text-sm font-medium text-[#0b0f12] disabled:opacity-50"
                >
                  {busy ? "排盘并创建中…" : "创建全流程 Lab → 进入聊天测试"}
                </button>
              </form>
            ) : (
              <form onSubmit={onCreateDeliveryOnly} className="space-y-4">
                <section className="rounded-md border border-[#f2ca50]/25 bg-[#101417] p-4">
                  <h2 className="text-sm font-medium text-[#f2ca50]">从本机导入（推荐）</h2>
                  <p className="mt-1 text-xs text-[#a1a1aa]">
                    须与聊天同一 origin。导入会话可带上问题 / core / agenda / 盘。
                  </p>
                  {scanMeta ? (
                    <p className="mt-2 font-mono text-[10px] text-[#71717a]">
                      scan {scanMeta.origin} · sessions={scanMeta.session_rows_total} ·
                      profiles={scanMeta.profile_rows_total} · base={scanMeta.profiles_with_base}
                    </p>
                  ) : null}
                  {importNote ? (
                    <p className="mt-2 text-xs text-[#a1a1aa]">{importNote}</p>
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
                          {(s.original_question || "").slice(0, 36)} · {s.phase ?? "?"} ·{" "}
                          {s.session_id.slice(0, 8)}
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
                    本地档案（只导入盘）
                    <select
                      className="mt-1 w-full rounded-md border border-white/10 bg-[#0b0f12] px-3 py-2 font-mono text-xs"
                      value={pickedProfile}
                      onChange={(e) => setPickedProfile(e.target.value)}
                    >
                      <option value="">— 选择 profile —</option>
                      {profiles.map((p) => (
                        <option key={p.profile_id} value={p.profile_id}>
                          {p.display_name}
                          {p.has_structured ? "" : " · 无structured"}
                          {p.owner_mismatch ? " · ⚠owner" : ""} · {p.profile_id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={importBusy || !pickedProfile}
                    onClick={() => void onImportProfile()}
                    className="mt-2 rounded-md border border-[#f2ca50]/40 px-3 py-1.5 text-sm text-[#f2ca50] disabled:opacity-40"
                  >
                    导入此盘 → base_analysis
                  </button>
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
                    rows={4}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-sm">
                  Desired outcome
                  <textarea
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 text-sm"
                    rows={2}
                    value={desired}
                    onChange={(e) => setDesired(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  question_category（可选）
                  <input
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-sm"
                    value={questionCategory}
                    onChange={(e) => setQuestionCategory(e.target.value)}
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
                  base_analysis（必填 · structured）
                  <textarea
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                    rows={16}
                    value={baseJson}
                    onChange={(e) => setBaseJson(e.target.value)}
                    placeholder='{"structured":{...}}'
                    required
                  />
                </label>
                <label className="block text-sm">
                  breakthrough_core
                  <textarea
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                    rows={12}
                    value={coreJson}
                    onChange={(e) => setCoreJson(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  covered_agenda
                  <textarea
                    className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                    rows={8}
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
          </>
        )}
      </div>
    </main>
  );
}
