"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThesisInspectPanel } from "../_components/ThesisInspectPanel";
import { LabCallTracePanel } from "../_components/LabCallTracePanel";

type LabStepDef = {
  step_key: string;
  label: string;
  page?: string;
  kind: string;
  uses_llm: boolean;
  accept?: string;
};

type LabCallTrace = {
  phase?: string;
  system?: string;
  user?: string;
  user_feed?: string;
  reasoning?: string | null;
  reasoning_details?: unknown;
  raw_text?: string | null;
  parsed?: unknown;
  meta?: Record<string, unknown>;
};

type LabAttempt = {
  attempt_number: number;
  timestamp: string;
  duration_ms: number;
  generation_id?: string | null;
  tokens_used?: number;
  input_payload: unknown;
  raw_model_output: unknown;
  processing_actions: Array<{ action: string; detail?: string }>;
  gate_verdict: { passed: boolean; failed_rule?: string; detail?: string };
  output_to_next_stage: unknown;
  error?: string;
  call_trace?: LabCallTrace;
};

type LabView = {
  lab_id: string;
  pipeline?: string;
  cursor_index: number;
  cursor_step: string | null;
  approved_order: string[];
  steps: Record<
    string,
    {
      step_key: string;
      status: string;
      attempts: LabAttempt[];
      approved_attempt?: number;
    }
  >;
  step_defs: LabStepDef[];
  source: {
    locale: string;
    original_question: string;
    structured_present: boolean;
    base_analysis_present: boolean;
  };
  artifacts: unknown;
};

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

export default function DeliveryLabConsolePage() {
  const params = useParams();
  const lab_id = String(params.lab_id ?? "");
  const [lab, setLab] = useState<LabView | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [attemptIdx, setAttemptIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchNote, setDispatchNote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** body_polish 目标语言（一次一语）。 */
  const [polishLocale, setPolishLocale] = useState<"zh" | "en" | "fr" | "es">("zh");
  /** Bump to cancel in-flight write auto-continue (准备重跑 / 新一次运行). */
  const runGenerationRef = useRef(0);
  const runAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/ops/delivery-lab/${encodeURIComponent(lab_id)}`, {
      credentials: "include",
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; lab?: LabView };
    if (!res.ok || !data.ok || !data.lab) {
      setLoadError(data.error ?? `HTTP ${res.status}`);
      if (res.status === 401) setLoadError("unauthorized — 先 /ops 登录");
      return;
    }
    setLab(data.lab);
    setSelectedKey((prev) => prev ?? data.lab!.cursor_step ?? data.lab!.step_defs[0]?.step_key ?? null);
  }, [lab_id]);

  useEffect(() => {
    if (lab_id) void refresh();
  }, [lab_id, refresh]);

  const selected = selectedKey;
  const rec = selected && lab ? lab.steps[selected] : null;
  const attempts = rec?.attempts ?? [];
  const attempt =
    attempts.length === 0
      ? null
      : attempts[attemptIdx >= 0 && attemptIdx < attempts.length ? attemptIdx : attempts.length - 1]!;

  useEffect(() => {
    setAttemptIdx(-1);
  }, [selected]);

  const cursorKey = lab?.cursor_step ?? null;
  const selectedIdx = useMemo(() => {
    if (!lab || !selected) return -1;
    return lab.step_defs.findIndex((d) => d.step_key === selected);
  }, [lab, selected]);

  const canRun =
    lab &&
    selected &&
    selectedIdx >= 0 &&
    selectedIdx <= lab.cursor_index &&
    rec?.status !== "running";
  const canApprove =
    lab &&
    selected === cursorKey &&
    attempt &&
    attempt.gate_verdict.passed &&
    !attempt.error &&
    rec?.status !== "approved";
  const canRerunPrep = lab && selected && selectedIdx >= 0 && selectedIdx <= lab.cursor_index;

  const selectedKind =
    lab?.step_defs.find((d) => d.step_key === selected)?.kind ?? null;
  const isPolishStep = selectedKind === "body_polish";
  const isEvidenceSoftStep = selectedKind === "evidence_soft";
  const isLocaleStep = isPolishStep || isEvidenceSoftStep;
  const polishPageKey =
    lab?.step_defs.find((d) => d.step_key === selected)?.page ?? null;

  const polishLocaleDrafts = useMemo(() => {
    if (!lab || !polishPageKey || !isPolishStep) return null;
    const arts = lab.artifacts as {
      pages?: Record<
        string,
        {
          page_schema_by_locale?: Partial<
            Record<"zh" | "en" | "fr" | "es", unknown>
          >;
          polish_locale?: string;
          polish_skipped?: boolean;
          page_schema?: unknown;
          page_schema_pre_polish?: unknown;
        }
      >;
    };
    const pageArt = arts.pages?.[polishPageKey];
    if (!pageArt) return null;
    return pageArt;
  }, [lab, polishPageKey, isPolishStep]);

  function isDispatchContinue(a: LabAttempt | null | undefined): boolean {
    const rule = a?.gate_verdict?.failed_rule;
    return (
      rule === "write_dispatch_continue" ||
      rule === "fill_dispatch_continue" ||
      rule === "mark_dispatch_continue" ||
      rule === "mark_dispatch_fanout" ||
      rule === "mark_chunk_stored"
    );
  }

  function attemptLabel(a: LabAttempt): string {
    if (a.gate_verdict.passed) return "pass";
    if (isDispatchContinue(a)) return "续跑";
    return "fail";
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Lab write chunk wall ≈ 270s + route maxDuration 300s; abort hung fetches. */
  const LAB_RUN_CLIENT_TIMEOUT_MS = 320_000;

  async function postRun(
    body: Record<string, unknown>,
    outerSignal?: AbortSignal | null,
  ) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), LAB_RUN_CLIENT_TIMEOUT_MS);
    const onOuterAbort = () => ac.abort();
    if (outerSignal) {
      if (outerSignal.aborted) ac.abort();
      else outerSignal.addEventListener("abort", onOuterAbort, { once: true });
    }
    let res: Response;
    let rawText: string;
    try {
      res = await fetch(
        `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/run`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ac.signal,
        },
      );
      rawText = await res.text();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error(
          outerSignal?.aborted
            ? "续跑已中止（准备重跑或新一次运行）。"
            : `本块客户端超时（>${LAB_RUN_CLIENT_TIMEOUT_MS / 1000}s）。点「准备重跑」后继续。`,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener("abort", onOuterAbort);
    }
    let data: {
      ok?: boolean;
      error?: string;
      lab?: LabView;
      attempt?: LabAttempt;
    } = {};
    try {
      data = rawText ? (JSON.parse(rawText) as typeof data) : {};
    } catch {
      const snip = rawText.replace(/\s+/g, " ").slice(0, 120);
      throw new Error(
        `服务器返回非 JSON（HTTP ${res.status}）: ${snip || "(empty)"}`,
      );
    }
    return { res, data, rawText };
  }

  async function postAction(
    path: "run" | "approve" | "rerun",
    opts?: { skip_polish?: boolean },
  ) {
    if (!selected) return;

    // 准备重跑 / 新运行：打断浏览器里还在转的 while 续跑（否则清缓存后仍会狂打第 0 块）。
    if (path === "rerun" || path === "run") {
      runAbortRef.current?.abort();
      runAbortRef.current = null;
      runGenerationRef.current += 1;
    }

    setBusy(true);
    setError(null);
    setDispatchNote(null);
    try {
      // approve / rerun — single POST
      if (path !== "run") {
        const res = await fetch(
          `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/${path}`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage_id: selected }),
          },
        );
        const rawText = await res.text();
        let data: { ok?: boolean; error?: string; lab?: LabView } = {};
        try {
          data = rawText ? (JSON.parse(rawText) as typeof data) : {};
        } catch {
          setError(`服务器返回非 JSON（HTTP ${res.status}）`);
          return;
        }
        if (data.lab) setLab(data.lab);
        if (path === "approve" && data.lab?.cursor_step) {
          setSelectedKey(data.lab.cursor_step);
        }
        if (!res.ok || !data.ok) setError(data.error ?? `HTTP ${res.status}`);
        else setError(null);
        return;
      }

      const myGen = runGenerationRef.current;
      const sessionAc = new AbortController();
      runAbortRef.current = sessionAc;

      const selectedDef = lab?.step_defs.find((d) => d.step_key === selected);
      const isMark = selectedDef?.kind === "mark";
      const isBodyPolish = selectedDef?.kind === "body_polish";
      const isEvidenceSoft = selectedDef?.kind === "evidence_soft";
      const polishRunBody =
        isBodyPolish || isEvidenceSoft
          ? {
              stage_id: selected,
              polish_locale: polishLocale,
              ...(isBodyPolish && opts?.skip_polish ? { skip_polish: true } : {}),
            }
          : { stage_id: selected };

      // Mark: one click → plan → stagger-parallel chunks → merge.
      if (isMark) {
        setDispatchNote("mark：规划分块…");
        const plan = await postRun(
          { stage_id: selected, mark_op: "plan" },
          sessionAc.signal,
        );
        if (plan.data.lab) {
          setLab(plan.data.lab);
          const a = plan.data.lab.steps[selected]?.attempts ?? [];
          setAttemptIdx(a.length - 1);
        }
        const out = plan.data.attempt?.output_to_next_stage as
          | { fanout?: boolean; chunks_total?: number }
          | undefined;
        const fanout =
          plan.data.ok &&
          plan.data.attempt?.gate_verdict?.failed_rule === "mark_dispatch_fanout" &&
          out?.fanout &&
          (out.chunks_total ?? 0) > 1;

        if (fanout) {
          const n = out!.chunks_total!;
          setDispatchNote(`mark：齐飞 ${n} 块（间隔 ~1s）…`);
          const chunkResults = await Promise.all(
            Array.from({ length: n }, (_, i) =>
              (async () => {
                if (i > 0) await sleep(i * 1000);
                return postRun(
                  {
                    stage_id: selected,
                    mark_op: "chunk",
                    mark_chunk: i,
                  },
                  sessionAc.signal,
                );
              })(),
            ),
          );
          const failed = chunkResults.find((c) => !c.data.ok);
          if (failed) {
            setError(failed.data.error ?? "mark_chunk_failed");
            if (failed.data.attempt) {
              setAttemptIdx(-1);
            }
            return;
          }
          setDispatchNote(`mark：合并 ${n} 块…`);
          const merged = await postRun(
            { stage_id: selected, mark_op: "merge" },
            sessionAc.signal,
          );
          if (merged.data.lab) {
            setLab(merged.data.lab);
            const a = merged.data.lab.steps[selected]?.attempts ?? [];
            setAttemptIdx(a.length - 1);
          }
          if (!merged.res.ok || !merged.data.ok) {
            setError(
              merged.data.attempt?.gate_verdict?.detail ??
                merged.data.error ??
                `HTTP ${merged.res.status}`,
            );
          } else {
            setError(null);
            setDispatchNote(null);
          }
          return;
        }

        if (!plan.res.ok || !plan.data.ok) {
          const gateFail = plan.data.attempt?.gate_verdict?.failed_rule;
          const msg = plan.data.error ?? `HTTP ${plan.res.status}`;
          if (!gateFail || msg !== gateFail) setError(msg);
          else if (plan.data.attempt?.gate_verdict?.detail) {
            setError(plan.data.attempt.gate_verdict.detail);
          }
        } else {
          setError(null);
          setDispatchNote(null);
        }
        return;
      }

      // Write / other: serial auto-continue across soft-wall hops.
      let autoContinue = true;
      let hop = 0;
      let lastSoFar = -1;
      /**
       * Same soFar is OK for Lab single-chunk retries: provider_escape + acceptance
       * 1+1 (two continues at soFar=0). A third same-soFar continue = loop → abort.
       */
      let sameSoFarContinuesLeft = 2;
      let pendingRetryKind: "escape" | "quality" | null = null;
      while (autoContinue) {
        if (myGen !== runGenerationRef.current || sessionAc.signal.aborted) {
          setDispatchNote("续跑已中止");
          return;
        }
        autoContinue = false;
        hop += 1;
        if (hop === 1) {
          setDispatchNote("正在写第 1 枪（主枪 · 独立 ~270s）…");
        } else if (pendingRetryKind === "escape") {
          setDispatchNote(
            `供应侧重试 · 第 ${hop} 枪（新 invoke · 独立 ~270s；本步最多主枪+供应重试+验收纠错共3枪）…`,
          );
        } else if (pendingRetryKind === "quality") {
          setDispatchNote(
            `验收纠错重试 · 第 ${hop} 枪（新 invoke · 独立 ~270s；本步最多主枪+供应重试+验收纠错共3枪）…`,
          );
        } else {
          setDispatchNote(
            `正在请求第 ${hop} 枪（每枪独立 ~270s；本步最多3枪）…`,
          );
        }
        pendingRetryKind = null;
        let res: Response;
        let data: {
          ok?: boolean;
          error?: string;
          lab?: LabView;
          attempt?: LabAttempt;
        };
        try {
          const out = await postRun(polishRunBody, sessionAc.signal);
          res = out.res;
          data = out.data;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "request_failed";
          if (/中止|准备重跑/.test(msg)) {
            setError(null);
            setDispatchNote(msg);
            return;
          }
          if (/504|timed out|Timeout|客户端超时/i.test(msg)) {
            setError(`${msg}。若「运行」灰掉请点「准备重跑」。`);
            try {
              const unlock = await fetch(
                `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/rerun`,
                {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ stage_id: selected }),
                },
              );
              const unlockJson = (await unlock.json().catch(() => null)) as {
                lab?: LabView;
              } | null;
              if (unlockJson?.lab) setLab(unlockJson.lab);
            } catch {
              /* ignore */
            }
          } else {
            setError(msg);
          }
          return;
        }

        if (data.lab) {
          setLab(data.lab);
          const a = data.lab.steps[selected]?.attempts ?? [];
          setAttemptIdx(a.length - 1);
        }

        const continueDispatch =
          data.ok &&
          (data.attempt?.gate_verdict?.failed_rule === "write_dispatch_continue" ||
            data.attempt?.gate_verdict?.failed_rule === "fill_dispatch_continue" ||
            data.attempt?.gate_verdict?.failed_rule === "mark_dispatch_continue");

        if (continueDispatch) {
          const out = data.attempt?.output_to_next_stage as
            | {
                next_chunk?: number;
                chunks_total?: number;
                write_units_so_far?: unknown[];
                fill_partial?: { next_chunk?: number };
                provider_escape?: boolean;
                quality_retry?: boolean;
              }
            | undefined;
          const soFar = Array.isArray(out?.write_units_so_far)
            ? out!.write_units_so_far!.length
            : typeof out?.next_chunk === "number"
              ? out.next_chunk
              : typeof out?.fill_partial?.next_chunk === "number"
                ? out.fill_partial.next_chunk
                : -1;
          // Guard: same soFar twice = rewrite loop — BUT provider-escape + acceptance
          // 1+1 intentionally keep soFar unchanged (up to 2 continues at soFar=0).
          if (soFar >= 0 && soFar === lastSoFar) {
            const escaping =
              out?.provider_escape === true || out?.quality_retry === true;
            if (!escaping || sameSoFarContinuesLeft <= 0) {
              setError(
                `续跑未前进（仍停在 ${soFar} 块已写）。已中止以免重复扣费。请硬刷新后点「准备重跑」再「运行」。`,
              );
              return;
            }
            sameSoFarContinuesLeft -= 1;
          }
          lastSoFar = soFar;
          const next = (out?.next_chunk ?? hop) + 1;
          const total = out?.chunks_total ?? "?";
          const detail = data.attempt?.gate_verdict?.detail;
          if (out?.quality_retry === true && out?.chunks_total === 1) {
            pendingRetryKind = "quality";
            setDispatchNote(
              `${detail ?? "验收未过"} → 立刻验收纠错重试（已接到模型输出但闸未过；新 invoke · 封顶1+1）…`,
            );
          } else if (out?.provider_escape === true && out?.chunks_total === 1) {
            pendingRetryKind = "escape";
            setDispatchNote(
              `${detail ?? "供应侧失败"} → 立刻供应侧重试（新 invoke · 独立 ~270s）…`,
            );
          } else {
            setDispatchNote(
              detail
                ? `${detail} → 立刻续跑第 ${next}/${total} 块…`
                : `已完成一块 → 立刻续跑第 ${next}/${total} 块（每块独立 ~270s）…`,
            );
          }
          autoContinue = true;
          continue;
        }

        if (!res.ok || !data.ok) {
          const gateFail = data.attempt?.gate_verdict?.failed_rule;
          const msg = data.error ?? `HTTP ${res.status}`;
          if (res.status === 504) {
            setError(`本步超时（HTTP 504）。若仍灰掉请点「准备重跑」。`);
            try {
              const unlock = await fetch(
                `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/rerun`,
                {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ stage_id: selected }),
                },
              );
              const unlockJson = (await unlock.json().catch(() => null)) as {
                lab?: LabView;
              } | null;
              if (unlockJson?.lab) setLab(unlockJson.lab);
            } catch {
              /* ignore */
            }
          } else if (!gateFail || msg !== gateFail) {
            setError(msg);
          } else if (data.attempt?.gate_verdict?.detail) {
            setError(data.attempt.gate_verdict.detail);
          }
        } else {
          setError(null);
          setDispatchNote(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setBusy(false);
      if (runAbortRef.current && !runAbortRef.current.signal.aborted) {
        /* keep for next cancel */
      }
    }
  }

  function downloadStepJson() {
    if (!selected || !attempt) return;
    const blob = new Blob([pretty({ step_key: selected, attempt })], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lab_id}_${selected}_a${attempt.attempt_number}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#0b0f12] p-8 text-[#e4e4e7]">
        <p className="text-red-300">{loadError}</p>
        <Link href="/ops/delivery-lab" className="mt-4 inline-block text-[#f2ca50]">
          ← 新建 Lab
        </Link>
      </main>
    );
  }

  if (!lab) {
    return (
      <main className="min-h-screen bg-[#0b0f12] p-8 text-[#71717a]">Loading lab…</main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0f12] text-[#e4e4e7]">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href="/ops/delivery-lab" className="text-sm text-[#f2ca50]">
          ← Labs
        </Link>
        <h1 className="font-primary text-lg font-semibold text-white">Delivery Lab</h1>
        <span className="font-mono text-xs text-[#71717a]">{lab.lab_id}</span>
        <span
          className={[
            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            lab.pipeline === "v3_three_step"
              ? "bg-[#9cf0ff]/15 text-[#9cf0ff]"
              : "bg-white/10 text-[#a1a1aa]",
          ].join(" ")}
        >
          {lab.pipeline === "v3_three_step" ? "v3 · 三步" : "legacy"}
        </span>
        <span className="text-xs text-[#a1a1aa]">locale={lab.source.locale}</span>
        <span className="text-xs text-[#a1a1aa]">
          structured={lab.source.structured_present ? "yes" : "NO"}
        </span>
        {attempt ? (
          <>
            <span className="text-xs text-[#a1a1aa]">{attempt.duration_ms}ms</span>
            {attempt.generation_id ? (
              <span className="max-w-[12rem] truncate font-mono text-xs text-[#71717a]">
                {attempt.generation_id}
              </span>
            ) : null}
            <button
              type="button"
              onClick={downloadStepJson}
              className="rounded border border-white/15 px-2 py-1 text-xs hover:border-[#f2ca50]/50"
            >
              导出本步 JSON
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto rounded border border-white/15 px-2 py-1 text-xs"
        >
          Refresh
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Step list */}
        <aside className="max-h-[40vh] w-full overflow-y-auto border-b border-white/10 lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
          <ul className="p-2">
            {lab.step_defs.map((d, i) => {
              const st = lab.steps[d.step_key]?.status ?? "idle";
              const locked = i > lab.cursor_index;
              const isCursor = d.step_key === cursorKey;
              const isSel = d.step_key === selected;
              return (
                <li key={d.step_key}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setSelectedKey(d.step_key)}
                    className={[
                      "mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs",
                      locked ? "cursor-not-allowed opacity-35" : "hover:bg-white/5",
                      isSel ? "bg-white/10 ring-1 ring-[#f2ca50]/40" : "",
                      isCursor && !isSel ? "border border-[#9cf0ff]/30" : "",
                    ].join(" ")}
                  >
                    <span className="mr-1 tabular-nums text-[#71717a]">{i + 1}.</span>
                    {st === "approved" ? "✓ " : st === "failed" ? "✗ " : st === "stale" ? "↻ " : ""}
                    {d.label}
                    {d.uses_llm ? (
                      <span className="ml-1 text-[10px] text-[#f2ca50]/80">LLM</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Actions + detail */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="mr-2 min-w-0 flex-1">
              <p className="text-sm font-medium text-white">
                {lab.step_defs.find((d) => d.step_key === selected)?.label ?? selected}
              </p>
              {lab.step_defs.find((d) => d.step_key === selected)?.accept ? (
                <p className="mt-1 max-w-3xl text-xs leading-5 text-[#d6d3d1]">
                  本步合格：{lab.step_defs.find((d) => d.step_key === selected)?.accept}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy || !canRun}
              onClick={() => void postAction("run")}
              className="rounded-md bg-[#f2ca50] px-3 py-1.5 text-sm font-medium text-[#0b0f12] disabled:opacity-40"
            >
              {busy
                ? "运行中…"
                : isPolishStep
                  ? `运行润色 · ${polishLocale}`
                  : isEvidenceSoftStep
                    ? `运行软译 · ${polishLocale}`
                    : "运行本步"}
            </button>
            {isLocaleStep ? (
              <>
                <label className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                  locale
                  <select
                    className="rounded border border-white/15 bg-[#101417] px-1.5 py-1 text-sm text-white"
                    value={polishLocale}
                    disabled={busy}
                    onChange={(e) =>
                      setPolishLocale(
                        e.target.value as "zh" | "en" | "fr" | "es",
                      )
                    }
                  >
                    <option value="zh">zh · 中译中</option>
                    <option value="en">en</option>
                    <option value="fr">fr</option>
                    <option value="es">es</option>
                  </select>
                </label>
                {isPolishStep ? (
                  <button
                    type="button"
                    disabled={busy || !canRun}
                    onClick={() => void postAction("run", { skip_polish: true })}
                    className="rounded-md border border-amber-400/50 px-3 py-1.5 text-sm text-amber-200 disabled:opacity-40"
                    title="跳过润色：对冻结正文跑 full 表面闸；过才可解锁下一步"
                  >
                    跳过润色
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              disabled={busy || !canRerunPrep}
              onClick={() => void postAction("rerun")}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              准备重跑
            </button>
            <button
              type="button"
              disabled={busy || !canApprove}
              onClick={() => void postAction("approve")}
              className="rounded-md border border-[#9cf0ff]/50 px-3 py-1.5 text-sm text-[#9cf0ff] disabled:opacity-40"
              title="gate 未过不可通过"
            >
              本步通过（解锁下一步）
            </button>
            {attempts.length > 1 ? (
              <label className="ml-2 text-xs text-[#a1a1aa]">
                attempt{" "}
                <select
                  className="rounded border border-white/15 bg-[#101417] px-1"
                  value={attemptIdx < 0 ? attempts.length - 1 : attemptIdx}
                  onChange={(e) => setAttemptIdx(Number(e.target.value))}
                >
                  {attempts.map((a, i) => (
                    <option key={a.attempt_number} value={i}>
                      #{a.attempt_number} {attemptLabel(a)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {dispatchNote ? (
              <span className="w-full text-sm text-[#9cf0ff]" role="status">
                {dispatchNote}
              </span>
            ) : null}
            {error ? (
              <span className="w-full text-sm text-red-300" role="alert">
                {error}
              </span>
            ) : null}
          </div>

          {!attempt ? (
            <p className="p-6 text-sm text-[#71717a]">
              尚未运行。点「运行本步」才会调用模型（若本步 uses_llm）。
              {isPolishStep
                ? " 润色可选 zh/en/fr/es 一语；或「跳过润色」（将对正文跑 full 表面闸）。"
                : isEvidenceSoftStep
                  ? " 依据软译可选 zh/en/fr/es 一语（金字多语 SSOT + 该语白话连接）。"
                  : ""}
            </p>
          ) : (
            <div className="grid min-h-0 flex-1 gap-2 p-3 lg:grid-cols-2">
              {isPolishStep && polishLocaleDrafts ? (
                <div className="flex min-h-[8rem] flex-col rounded-md border border-[#f2ca50]/25 bg-[#101417] lg:col-span-2">
                  <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#f2ca50]">
                    润色多语对照 · 当前{" "}
                    {polishLocaleDrafts.polish_skipped
                      ? "已 Skip"
                      : polishLocaleDrafts.polish_locale ?? polishLocale}
                  </h2>
                  <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(["zh", "en", "fr", "es"] as const).map((loc) => {
                      const draft = polishLocaleDrafts.page_schema_by_locale?.[loc];
                      return (
                        <button
                          key={loc}
                          type="button"
                          disabled={!draft}
                          onClick={() => setPolishLocale(loc)}
                          className={[
                            "rounded border px-2 py-2 text-left text-xs",
                            draft
                              ? loc === (polishLocaleDrafts.polish_locale ?? polishLocale)
                                ? "border-[#f2ca50]/60 bg-white/5"
                                : "border-white/15 hover:bg-white/5"
                              : "border-white/5 opacity-40",
                          ].join(" ")}
                        >
                          <span className="font-medium text-white">{loc}</span>
                          <span className="ml-1 text-[#71717a]">
                            {draft ? "有稿" : "无"}
                          </span>
                          {draft ? (
                            <pre className="mt-1 max-h-24 overflow-auto font-mono text-[10px] leading-snug text-[#a1a1aa] whitespace-pre-wrap">
                              {pretty(draft).slice(0, 480)}
                              {pretty(draft).length > 480 ? "…" : ""}
                            </pre>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {polishLocaleDrafts.polish_skipped ? (
                    <p className="border-t border-white/10 px-3 py-2 text-xs text-amber-200/90">
                      已跳过润色 · 下游 soft 使用冻结正文（full 表面闸已过）
                    </p>
                  ) : null}
                </div>
              ) : null}
              {selected === "thesis.gen" ? (
                <>
                  <div className="flex min-h-[12rem] flex-col rounded-md border border-white/10 bg-[#101417]">
                    <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                      Input
                    </h2>
                    <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {pretty(attempt.input_payload)}
                    </pre>
                  </div>
                  <div className="flex min-h-[12rem] flex-col rounded-md border border-[#f2ca50]/25 bg-[#101417]">
                    <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#f2ca50]">
                      Thesis · 六维可读（classical_basis / absent / depth）
                    </h2>
                    <ThesisInspectPanel raw={attempt.raw_model_output} />
                  </div>
                  <details className="rounded-md border border-white/10 bg-[#101417] lg:col-span-2">
                    <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                      Raw thesis JSON（折叠）
                    </summary>
                    <pre className="max-h-64 overflow-auto border-t border-white/10 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {pretty(attempt.raw_model_output)}
                    </pre>
                  </details>
                </>
              ) : (
                <LabCallTracePanel
                  call_trace={attempt.call_trace}
                  fallback_input={attempt.input_payload}
                  fallback_raw={attempt.raw_model_output}
                />
              )}
              <div className="flex min-h-[10rem] flex-col rounded-md border border-white/10 bg-[#101417] lg:col-span-2">
                <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                  Gate · processing · output_to_next
                </h2>
                <div className="grid gap-3 p-3 lg:grid-cols-3">
                  <div>
                    <p
                      className={
                        attempt.gate_verdict.passed
                          ? "text-sm text-emerald-400"
                          : isDispatchContinue(attempt)
                            ? "text-sm text-[#9cf0ff]"
                            : "text-sm text-red-300"
                      }
                    >
                      gate:{" "}
                      {attempt.gate_verdict.passed
                        ? "PASSED"
                        : isDispatchContinue(attempt)
                          ? "CONTINUE（分发中 · 非失败）"
                          : "FAILED"}
                      {attempt.gate_verdict.failed_rule
                        ? ` · ${attempt.gate_verdict.failed_rule}`
                        : ""}
                    </p>
                    {attempt.gate_verdict.detail ? (
                      <p className="mt-1 text-xs text-[#a1a1aa]">{attempt.gate_verdict.detail}</p>
                    ) : null}
                    {attempt.error &&
                    attempt.error !== attempt.gate_verdict.failed_rule ? (
                      <p className="mt-1 text-xs text-red-300">{attempt.error}</p>
                    ) : null}
                  </div>
                  <pre className="overflow-auto font-mono text-[11px] whitespace-pre-wrap">
                    {pretty(attempt.processing_actions)}
                  </pre>
                  <pre className="max-h-64 overflow-auto font-mono text-[11px] whitespace-pre-wrap">
                    {pretty(attempt.output_to_next_stage)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <details className="border-t border-white/10 px-4 py-2 text-xs text-[#71717a]">
            <summary className="cursor-pointer">Question / artifacts peek</summary>
            <p className="mt-2 text-sm text-[#e4e4e7]">{lab.source.original_question}</p>
            <pre className="mt-2 max-h-40 overflow-auto font-mono text-[10px]">
              {pretty(lab.artifacts)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
