"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThesisInspectPanel } from "../_components/ThesisInspectPanel";

type LabStepDef = {
  step_key: string;
  label: string;
  page?: string;
  kind: string;
  uses_llm: boolean;
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
};

type LabView = {
  lab_id: string;
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
  const [loadError, setLoadError] = useState<string | null>(null);

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

  async function postAction(path: "run" | "approve" | "rerun") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/${path}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage_id: selected }),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        lab?: LabView;
        attempt?: LabAttempt;
      };
      if (data.lab) setLab(data.lab);
      if (!res.ok || !data.ok) {
        // Gate fail already lives on attempt.failed_rule — avoid duplicate red banner.
        const gateFail = data.attempt?.gate_verdict?.failed_rule;
        const msg = data.error ?? `HTTP ${res.status}`;
        if (!gateFail || msg !== gateFail) {
          setError(msg);
        }
      }
      if (path === "run" && data.lab) {
        const a = data.lab.steps[selected]?.attempts ?? [];
        setAttemptIdx(a.length - 1);
      }
      if (path === "approve" && data.lab?.cursor_step) {
        setSelectedKey(data.lab.cursor_step);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setBusy(false);
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
            <p className="mr-2 text-sm font-medium text-white">
              {lab.step_defs.find((d) => d.step_key === selected)?.label ?? selected}
            </p>
            <button
              type="button"
              disabled={busy || !canRun}
              onClick={() => void postAction("run")}
              className="rounded-md bg-[#f2ca50] px-3 py-1.5 text-sm font-medium text-[#0b0f12] disabled:opacity-40"
            >
              {busy ? "运行中…" : "运行本步"}
            </button>
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
                      #{a.attempt_number} {a.gate_verdict.passed ? "pass" : "fail"}
                    </option>
                  ))}
                </select>
              </label>
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
            </p>
          ) : (
            <div className="grid min-h-0 flex-1 gap-2 p-3 lg:grid-cols-2">
              <div className="flex min-h-[12rem] flex-col rounded-md border border-white/10 bg-[#101417]">
                <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                  Input
                </h2>
                <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {pretty(attempt.input_payload)}
                </pre>
              </div>
              {selected === "thesis.gen" ? (
                <div className="flex min-h-[12rem] flex-col rounded-md border border-[#f2ca50]/25 bg-[#101417] lg:row-span-1">
                  <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#f2ca50]">
                    Thesis · 六维可读（classical_basis / absent / depth）
                  </h2>
                  <ThesisInspectPanel raw={attempt.raw_model_output} />
                </div>
              ) : (
                <div className="flex min-h-[12rem] flex-col rounded-md border border-white/10 bg-[#101417]">
                  <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                    Raw model output
                  </h2>
                  <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {pretty(attempt.raw_model_output)}
                  </pre>
                </div>
              )}
              {selected === "thesis.gen" ? (
                <details className="rounded-md border border-white/10 bg-[#101417] lg:col-span-2">
                  <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                    Raw thesis JSON（折叠）
                  </summary>
                  <pre className="max-h-64 overflow-auto border-t border-white/10 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {pretty(attempt.raw_model_output)}
                  </pre>
                </details>
              ) : null}
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
                          : "text-sm text-red-300"
                      }
                    >
                      gate: {attempt.gate_verdict.passed ? "PASSED" : "FAILED"}
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
