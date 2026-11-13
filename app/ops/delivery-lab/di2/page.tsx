"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { handleUserMessage } from "@/lib/poju/agent";
import {
  createPOJUSession,
  loadPOJUSession,
  savePOJUSession,
} from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";
import { listStoredProfilesForSessionPrep } from "@/lib/profile/stored-profiles-service";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import { runDecisionReportForSession } from "@/lib/poju/decision-intake/decision-report-client";
import { sessionEligibleForFinalConfirm } from "@/lib/poju/decision-intake/confirm-and-freeze";
import { projectAdaptiveQuestionForUi } from "@/lib/poju/decision-intake/ui-projection";

type Stage = { label: string; detail: string };

function latestAssistant(session: POJUSessionState | null): string {
  return [...(session?.messages ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? "";
}

function getStages(session: POJUSessionState | null): Stage[] {
  if (!session) return [];
  const readiness = session.decision_understanding?.readiness;
  const receipts = session.dc_freeze_receipts ?? [];
  const profileReceipts = session.dc_profile_receipts ?? [];
  const jobs = session.freeze_bound_report_jobs ?? [];
  const latestJob = jobs.at(-1);
  return [
    { label: "Fresh Session", detail: session.session_id },
    { label: "Blueprint", detail: session.decision_blueprint?.blueprint_id ?? (session.decision_blueprint ? "initialized" : "waiting") },
    { label: "Decision Context", detail: session.decision_context ? `${session.decision_context.context_id} · v${session.decision_context.version} · ${session.decision_context.reality_facts.length} facts` : "not initialized" },
    { label: "Adaptive Question", detail: session.adaptive_ask_plan?.question_text ?? "waiting" },
    { label: "Answer Interpretation", detail: session.last_answer_event?.event_id ?? "no interpreted answer yet" },
    { label: "Understanding / Readiness", detail: readiness ? `${readiness.verdict} · can_ask=${readiness.can_ask}` : "waiting" },
    { label: "Freeze Receipt", detail: receipts.at(-1)?.freeze_id ?? "not frozen" },
    { label: "Profile Receipt", detail: profileReceipts.at(-1)?.profile_id ?? "not registered" },
    { label: "Personal Analysis", detail: `${session.personal_analysis_records?.length ?? 0} record(s)` },
    { label: "Report Job", detail: latestJob ? `${latestJob.job_id} · ${latestJob.status}` : session.pending_decision_report_job_id ?? "not started" },
  ];
}

export default function Di2DeliveryLabPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [profileId, setProfileId] = useState("");
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const probe = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/login", { credentials: "include" });
      setAuthed(response.ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  const restore = useCallback(async (id: string) => {
    const loaded = await loadPOJUSession(id.trim());
    if (!loaded) throw new Error("本浏览器 IndexedDB 中没有该 Session，或当前用户无权读取。");
    setSession(loaded);
    setSessionId(loaded.session_id);
    setQuestion(loaded.original_question);
    setNotice("Session 已从本机 IndexedDB 恢复；恢复不会自动启动模型或报告任务。");
    return loaded;
  }, []);

  useEffect(() => { void probe(); }, [probe]);

  useEffect(() => {
    if (!authed) return;
    void listStoredProfilesForSessionPrep().then((items) => {
      setProfiles(items);
      if (items.length === 1) setProfileId(items[0].profile_id);
    }).catch((e) => setError(e instanceof Error ? e.message : "无法读取本地档案"));
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const queryId = new URLSearchParams(window.location.search).get("session_id");
    if (!queryId) return;
    void restore(queryId).catch((e) => setError(e instanceof Error ? e.message : "恢复 Session 失败"));
  }, [authed, restore]);

  const stages = useMemo(() => getStages(session), [session]);
  const canConfirm = Boolean(session && sessionEligibleForFinalConfirm(session, "确认"));
  const hasFreeze = Boolean(session?.decision_context && session.dc_freeze_receipts?.some((r) =>
    r.session_id === session.session_id && r.context_id === session.decision_context?.context_id &&
    r.context_version === session.decision_context?.version && r.context_hash === session.decision_context?.content_hash));

  async function onCreate(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!profileId) throw new Error("先选择一个本地档案；档案 ID 会绑定到 Freeze Profile Receipt。");
      if (question.trim().length < 3) throw new Error("请填写真实决策问题。");
      const id = await createPOJUSession({
        payment_id: `ops-lab:${crypto.randomUUID()}`,
        original_question: question.trim(),
        selected_stored_profile_id: profileId,
      });
      const created = await loadPOJUSession(id);
      if (!created) throw new Error("新 Session 已创建，但本地重新读取失败。");
      setSession(created); setSessionId(id);
      window.history.replaceState(null, "", `/ops/delivery-lab/di2?session_id=${encodeURIComponent(id)}`);
      setNotice("全新 POJU Session 已创建。下一步会通过正式 handleUserMessage 发送首轮陈述并调用生产模型接口。");
    } catch (e) { setError(e instanceof Error ? e.message : "Session 创建失败"); }
    finally { setBusy(false); }
  }

  async function submitMessage(text: string) {
    if (!session || !text.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await handleUserMessage({ session, userMessage: text.trim(), locale: "zh" });
      await savePOJUSession(next);
      setSession(next); setAnswer("");
      setNotice("handleUserMessage 已返回并持久化当前 Session。");
    } catch (e) { setError(e instanceof Error ? e.message : "消息处理失败"); }
    finally { setBusy(false); }
  }

  async function onAnswer(e: FormEvent) {
    e.preventDefault();
    await submitMessage(answer);
  }

  async function onReport() {
    if (!session) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await runDecisionReportForSession(session, "zh");
      await savePOJUSession(next);
      setSession(next);
      setNotice("M5 正式报告客户端已返回。Session 中的 job、analysis 和报告镜像已刷新。");
    } catch (e) { setError(e instanceof Error ? e.message : "报告任务失败"); }
    finally { setBusy(false); }
  }

  if (authed === null) return <main className="min-h-screen bg-[#0b0e10] p-8 text-white">Checking Ops access…</main>;
  if (!authed) return <main className="min-h-screen bg-[#0b0e10] p-8 text-white"><p>需要先登录 Ops。</p><Link className="underline" href="/ops">打开 Ops 登录</Link></main>;

  return <main className="min-h-screen bg-[#0b0e10] px-4 py-8 text-white md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/ops/delivery-lab" className="text-sm text-cyan-300 underline">← Delivery Lab</Link><h1 className="mt-2 text-3xl font-semibold">DI2 Lifecycle Lab</h1><p className="mt-1 text-sm text-white/65">生产 Session、生产交互、生产 Freeze 与 M5 报告客户端。模型和报告调用只会由你点击后触发。</p></div>
        <span className="rounded border border-amber-400/40 px-3 py-2 text-xs text-amber-200">Production model / report calls · manual only</span>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-medium">创建新 Session</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">决策问题<textarea className="mt-1 min-h-28 w-full rounded border border-white/15 bg-black/20 p-3" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="描述你真实要做的决定" required /></label>
          <div className="space-y-3">
            <label className="block text-sm">绑定的本地档案<select className="mt-1 w-full rounded border border-white/15 bg-[#14191c] p-3" value={profileId} onChange={(e) => setProfileId(e.target.value)} required><option value="">选择档案…</option>{profiles.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.display_name} · {p.profile_id} · {p.has_base_analysis ? "有分析资料" : "无分析资料"}</option>)}</select></label>
            <p className="text-xs text-white/55">档案来自当前浏览器本地存储；正式 Freeze 仍会通过服务端校验 Profile Receipt。</p>
            <button disabled={busy} className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium disabled:opacity-50">创建 Fresh Session</button>
          </div>
        </form>
        <div className="mt-5 border-t border-white/10 pt-4">
          <label className="block text-sm">恢复已有 Session ID<input className="mt-1 w-full rounded border border-white/15 bg-black/20 p-3 font-mono text-sm" value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="IndexedDB 中的 Session ID" /></label>
          <button disabled={busy || !sessionId.trim()} onClick={() => void restore(sessionId).catch((e) => setError(e instanceof Error ? e.message : "恢复失败"))} className="mt-2 rounded border border-white/20 px-3 py-2 text-sm disabled:opacity-50">从 IndexedDB 恢复</button>
        </div>
      </section>

      {error && <div role="alert" className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-100">{notice}</div>}

      {session && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-medium">当前交互</h2><p className="mt-1 break-all font-mono text-xs text-white/55">{session.session_id}</p></div>{session.messages.length === 0 ? <button disabled={busy} onClick={() => void submitMessage(session.original_question)} className="rounded border border-cyan-300/40 px-3 py-2 text-sm disabled:opacity-50">开始首轮调查</button> : <span className="text-xs text-white/55">已恢复当前轮次；提交回答即可继续生产问答流程。</span>}</div>
          <div className="max-h-[38rem] space-y-3 overflow-auto rounded border border-white/10 bg-black/20 p-3">
            {session.messages.map((m, i) => <article key={`${m.timestamp}-${i}`} className={`rounded p-3 text-sm ${m.role === "assistant" ? "bg-cyan-950/35" : m.role === "user" ? "bg-white/[0.06]" : "bg-amber-950/20"}`}><div className="mb-1 text-[11px] uppercase tracking-wide text-white/45">{m.role}</div><div className="whitespace-pre-wrap">{m.content}</div></article>)}
            {!session.messages.length && <p className="p-3 text-sm text-white/50">新 Session 尚未发起首轮消息。</p>}
          </div>
          <form onSubmit={onAnswer} className="space-y-2"><label className="block text-sm">你的回答<textarea className="min-h-24 w-full rounded border border-white/15 bg-black/20 p-3" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={session.adaptive_ask_plan?.question_text ?? "首轮调查开始后，当前问题会显示在这里。"} /></label><div className="flex flex-wrap gap-2"><button disabled={busy || !answer.trim()} className="rounded bg-white/15 px-4 py-2 text-sm disabled:opacity-50">提交回答</button>{canConfirm && <button type="button" disabled={busy} onClick={() => void submitMessage("确认")} className="rounded bg-emerald-700 px-4 py-2 text-sm disabled:opacity-50">明确确认并 Freeze</button>}</div></form>
          <p className="text-xs text-white/55">确认按钮仅在生产 Readiness 已停止提问且允许最终确认时显示。不能手动改 DC 或 Freeze 状态。</p>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-medium">阶段与权威状态</h2><ol className="mt-3 space-y-2">{stages.map((s, i) => <li key={s.label} className="grid grid-cols-[1.6rem_9.5rem_1fr] gap-2 border-b border-white/5 pb-2 text-sm"><span className="text-white/35">{String(i + 1).padStart(2, "0")}</span><strong className="font-medium">{s.label}</strong><span className="break-all text-white/65">{s.detail}</span></li>)}</ol><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy || !hasFreeze} onClick={() => void onReport()} className="rounded bg-violet-700 px-4 py-2 text-sm disabled:opacity-40">{session.pending_decision_report_job_id ? "恢复 / 查看报告 Job" : "启动 M5 报告任务"}</button><span className="self-center text-xs text-white/50">使用正式交付授权与扣费规则；若需有效 pass，服务端会按生产逻辑要求。</span></div></section>
          {session.freeze_bound_report_jobs?.some((job) => job.source === "decision_intake_v2") && <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-medium">八页报告交付</h2><div className="mt-3 space-y-3">{session.freeze_bound_report_jobs.filter((job) => job.source === "decision_intake_v2").flatMap((job) => job.pages.map((page) => ({ job, page }))).map(({ job, page }) => <article key={`${job.job_id}-${page.pageId}`} className="rounded border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-white/55"><strong>Page {page.pageId}</strong><span>{page.status} · {page.applicability ?? "applies"} · job {job.job_id}</span></div><div className="mt-2 whitespace-pre-wrap text-sm">{page.content || page.error || "等待此页生成"}</div></article>)}</div></section>}
          <details open className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><summary className="cursor-pointer text-lg font-medium">可审查的生产状态快照</summary><pre className="mt-3 max-h-[36rem] overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-3 text-[11px] leading-relaxed text-white/75">{JSON.stringify({ ui_projection: projectAdaptiveQuestionForUi(session), answer_interpretation: session.last_answer_event ?? null, decision_context: session.decision_context ?? null, blueprint: session.decision_blueprint ?? null, understanding: session.decision_understanding ?? null, adaptive_plan: session.adaptive_ask_plan ?? null, freeze_receipts: session.dc_freeze_receipts ?? [], profile_receipts: session.dc_profile_receipts ?? [], personal_analysis: session.personal_analysis_records ?? [], report_jobs: session.freeze_bound_report_jobs ?? [], report_messages: session.messages.filter((m) => m.meta?.kind === "report" || Boolean(m.meta?.report_text)), }, null, 2)}</pre></details>
        </aside>
      </div>}
      <p className="text-xs text-white/40">LAB 的浏览器本地 IndexedDB 与服务端冻结/报告存储各自有边界。正式 M5 API 可能产生实际 pass 消耗；本页不提供绕过扣费的测试开关。</p>
    </div>
  </main>;
}
