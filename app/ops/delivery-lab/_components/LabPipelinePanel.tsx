"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateProfile } from "@/lib/calculations/profile";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { matchDyadGateAction } from "@/lib/poju/dyad-compat";
import type { BirthInfo } from "@/lib/profile/types";
import { LabCallTracePanel } from "./LabCallTracePanel";
import { LabOpsBirthForm } from "./LabOpsBirthForm";

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

type PipelineAttempt = {
  attempt_number: number;
  timestamp: string;
  duration_ms: number;
  call_trace?: LabCallTrace;
  error?: string;
  raw_model_output?: unknown;
  input_payload?: unknown;
};

type PipelineTurn = {
  turn_id: string;
  phase: string;
  kind: string;
  attempts: PipelineAttempt[];
  gate?: { action: string; detail?: string };
  user_input?: string;
};

type ChatMsg = {
  role: string;
  content: string;
  timestamp?: string;
  options?: string[];
  meta?: {
    understanding_gate_pending?: boolean;
    dyad_gate_pending?: boolean;
    current_state?: string;
  };
};

export type LabPipelineView = {
  mode?: string;
  pipeline_cursor?: string;
  pipeline_next_hint?: string;
  pipeline_delivery_unlocked?: boolean;
  delivery_steps_locked?: boolean;
  pipeline_pending_job?: {
    job_id: string;
    stage: string;
  } | null;
  pipeline_turns?: PipelineTurn[];
  chat_session?: {
    messages: ChatMsg[];
    options?: string[];
    agent_phase?: string | null;
    pivot_chart_path?: string | null;
    dyad_offer_status?: string;
    has_breakthrough_core?: boolean;
  } | null;
};

type Props = {
  lab_id: string;
  view: LabPipelineView;
  onLabUpdate: (lab: unknown) => void;
  /** Lab source locale — used for dyad chip matching / partner chart language. */
  locale?: string;
};

export function LabPipelinePanel({
  lab_id,
  view,
  onLabUpdate,
  locale = "zh",
}: Props) {
  const [draft, setDraft] = useState("");
  const [partnerJson, setPartnerJson] = useState("");
  const [showPartnerAdvanced, setShowPartnerAdvanced] = useState(false);
  const [partnerBirthReady, setPartnerBirthReady] = useState(false);
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const getPartnerBirthRef = useRef<(() => BirthInfo | null) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState(-1);

  const turns = view.pipeline_turns ?? [];
  const messages = view.chat_session?.messages ?? [];
  const options = view.chat_session?.options ?? [];
  const pending = view.pipeline_pending_job;

  const selectedTurn = useMemo(() => {
    if (!turns.length) return null;
    const id = selectedTurnId ?? turns[turns.length - 1]!.turn_id;
    return turns.find((t) => t.turn_id === id) ?? turns[turns.length - 1]!;
  }, [turns, selectedTurnId]);

  const selectedAttempt = useMemo(() => {
    if (!selectedTurn?.attempts.length) return null;
    const idx =
      selectedAttemptIdx >= 0 && selectedAttemptIdx < selectedTurn.attempts.length
        ? selectedAttemptIdx
        : selectedTurn.attempts.length - 1;
    return selectedTurn.attempts[idx]!;
  }, [selectedTurn, selectedAttemptIdx]);

  const selectedTrace = selectedAttempt?.call_trace ?? null;

  const applyLab = useCallback(
    (data: { ok?: boolean; error?: string; lab?: unknown }) => {
      if (!data.ok || !data.lab) {
        setError(data.error ?? "request_failed");
        return;
      }
      onLabUpdate(data.lab);
      setError(null);
    },
    [onLabUpdate],
  );

  async function postJson(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; lab?: unknown };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      applyLab(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    await postJson(`/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/chat`, {
      message,
    });
  }

  /** Production parity: dyad chips open birth form / skip — never send as free chat. */
  async function onOptionPick(opt: string) {
    const dyadAction = matchDyadGateAction(opt, locale);
    if (dyadAction === "skip_partner_bazi") {
      setPartnerFormOpen(false);
      await postJson(`/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`, {
        action: "dyad_skip",
      });
      return;
    }
    if (dyadAction === "collect_partner_bazi") {
      setPartnerFormOpen(true);
      setError(null);
      return;
    }
    await sendMessage(opt);
  }

  async function submitPartnerBirth() {
    const birth = getPartnerBirthRef.current?.() ?? null;
    if (!birth) {
      setError("请填完整对方：出生日期、时间、地点（搜索选城市）、性别");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const profile = await calculateProfile(birth);
      const local = buildStreamLocalDataFromProfile(profile, {
        output_language: locale.toLowerCase().startsWith("en") ? "en" : "zh",
      });
      if (!local.structured) {
        setError("对方排盘失败：未能生成 structured");
        return;
      }
      const res = await fetch(
        `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "dyad_collect",
            // Same shape as production stored profiles for Match matrix.
            partner_base_analysis: {
              user_profile: profile,
              base_analysis: { structured: local.structured },
            },
          }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string; lab?: unknown };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      applyLab(data);
      setPartnerFormOpen(false);
      setPartnerJson("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "partner_collect_failed");
    } finally {
      setBusy(false);
    }
  }

  async function pollJobs() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const path =
        pending.stage === "synthesis"
          ? `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/jobs/synthesis`
          : `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/jobs/segment2`;
      const res = await fetch(path, { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; error?: string; lab?: unknown };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      applyLab(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "poll_failed");
    } finally {
      setBusy(false);
    }
  }

  // Auto-poll while a job is pending.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      void pollJobs();
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.job_id, pending?.stage, lab_id]);

  const lastMsg = messages[messages.length - 1];
  const showUnderstanding =
    lastMsg?.meta?.understanding_gate_pending ||
    view.pipeline_cursor === "awaiting_understanding";
  const showDyad =
    lastMsg?.meta?.dyad_gate_pending ||
    view.chat_session?.dyad_offer_status === "offered";
  const showSynthesis = view.pipeline_cursor === "awaiting_confirmation";

  // Auto-open partner birth form when Stage-1 dyad gate appears (ops visibility).
  useEffect(() => {
    if (showDyad) setPartnerFormOpen(true);
    else setPartnerFormOpen(false);
  }, [showDyad]);

  return (
    <section className="mb-8 rounded-md border border-[#f2ca50]/30 bg-[#101417] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-[#f2ca50]">全流程 Pipeline · Stage1–3</h2>
          <p className="mt-1 text-xs text-[#a1a1aa]">
            {view.pipeline_next_hint ?? view.pipeline_cursor ?? "—"}
          </p>
          <p className="mt-1 font-mono text-[10px] text-[#71717a]">
            cursor={view.pipeline_cursor} · path={view.chat_session?.pivot_chart_path ?? "unset"} ·
            phase={view.chat_session?.agent_phase ?? "—"}
            {pending ? ` · job=${pending.stage}:${pending.job_id}` : ""}
            {view.pipeline_delivery_unlocked ? " · delivery unlocked" : " · delivery locked"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !turns.some((t) => t.kind === "chat")}
            onClick={() =>
              void postJson(
                `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/chat/rerun`,
              )
            }
            className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40"
          >
            重跑本轮
          </button>
          {pending ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void pollJobs()}
              className="rounded border border-[#f2ca50]/40 px-2 py-1 text-xs text-[#f2ca50]"
            >
              刷新 job
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex min-h-[320px] flex-col rounded border border-white/10 bg-[#0b0f12]">
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.length === 0 ? (
              <p className="text-xs text-[#71717a]">还没有消息。输入问题开始 Opening。</p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}-${m.timestamp ?? ""}`}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded bg-[#1a2330] px-2 py-1.5 text-[#e4e4e7]"
                      : m.role === "assistant"
                        ? "mr-6 rounded bg-[#142018] px-2 py-1.5 text-[#d4e4d8]"
                        : "rounded bg-white/5 px-2 py-1 text-[11px] text-[#a1a1aa]"
                  }
                >
                  <div className="mb-0.5 font-mono text-[10px] uppercase text-[#71717a]">
                    {m.role}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))
            )}
          </div>

          {options.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 py-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={busy || Boolean(pending)}
                  onClick={() => void onOptionPick(opt)}
                  className="rounded-full border border-[#f2ca50]/35 px-2.5 py-1 text-xs text-[#f2ca50] disabled:opacity-40"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : null}

          {(showUnderstanding || showDyad || showSynthesis) && (
            <div className="flex flex-wrap gap-2 border-t border-white/10 px-3 py-2">
              {showUnderstanding ? (
                <>
                  <button
                    type="button"
                    disabled={busy || Boolean(pending)}
                    onClick={() =>
                      void postJson(
                        `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`,
                        { action: "understanding_confirm" },
                      )
                    }
                    className="rounded bg-[#f2ca50] px-3 py-1 text-xs font-medium text-black disabled:opacity-40"
                  >
                    确认理解 → Call A
                  </button>
                  <button
                    type="button"
                    disabled={busy || Boolean(pending)}
                    onClick={() => void sendMessage("我想补充一点")}
                    className="rounded border border-white/20 px-3 py-1 text-xs disabled:opacity-40"
                  >
                    补充说明
                  </button>
                </>
              ) : null}
              {showDyad ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPartnerFormOpen(true);
                      setError(null);
                    }}
                    className="rounded bg-[#f2ca50] px-3 py-1 text-xs font-medium text-black disabled:opacity-40"
                  >
                    输入对方基础信息
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPartnerFormOpen(false);
                      void postJson(
                        `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`,
                        { action: "dyad_skip" },
                      );
                    }}
                    className="rounded border border-white/20 px-3 py-1 text-xs"
                  >
                    暂时不输入对方基础信息
                  </button>
                </>
              ) : null}
              {showSynthesis ? (
                <button
                  type="button"
                  disabled={busy || Boolean(pending)}
                  onClick={() =>
                    void postJson(
                      `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`,
                      { action: "synthesis_confirm" },
                    )
                  }
                  className="rounded bg-[#f2ca50] px-3 py-1 text-xs font-medium text-black disabled:opacity-40"
                >
                  确认汇总 → Synthesis
                </button>
              ) : null}
            </div>
          )}

          {showDyad && partnerFormOpen ? (
            <div className="border-t border-[#f2ca50]/25 bg-[#12181c] px-3 py-3">
              <p className="mb-2 text-xs text-[#e4e4e7]">
                补充对方的出生信息（与生产一致：排盘 → 合盘摘要 → path=dyad）
              </p>
              <LabOpsBirthForm
                idPrefix="lab-partner"
                getBirthInfoRef={getPartnerBirthRef}
                onReadyChange={setPartnerBirthReady}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !partnerBirthReady}
                  onClick={() => void submitPartnerBirth()}
                  className="rounded bg-[#f2ca50] px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
                >
                  {busy ? "排盘中…" : "提交对方八字并锁定 dyad"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPartnerFormOpen(false)}
                  className="rounded border border-white/20 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  收起表单
                </button>
              </div>
              <div className="mt-3 border-t border-white/10 pt-2">
                <button
                  type="button"
                  className="text-[11px] text-[#71717a] underline"
                  onClick={() => setShowPartnerAdvanced((v) => !v)}
                >
                  {showPartnerAdvanced ? "收起高级" : "高级：粘贴对方 base_analysis JSON"}
                </button>
                {showPartnerAdvanced ? (
                  <div className="mt-2">
                    <textarea
                      className="h-16 w-full rounded border border-white/10 bg-[#0b0f12] p-2 font-mono text-[10px]"
                      value={partnerJson}
                      onChange={(e) => setPartnerJson(e.target.value)}
                      placeholder="粘贴对方盘 JSON…"
                    />
                    <button
                      type="button"
                      disabled={busy || !partnerJson.trim()}
                      onClick={() => {
                        try {
                          const partner_base_analysis = JSON.parse(partnerJson);
                          void postJson(
                            `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`,
                            { action: "dyad_collect", partner_base_analysis },
                          );
                        } catch {
                          setError("partner JSON 解析失败");
                        }
                      }}
                      className="mt-1 rounded border border-[#f2ca50]/40 px-2 py-1 text-xs text-[#f2ca50] disabled:opacity-40"
                    >
                      用 JSON 收集对方盘
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 border-t border-white/10 p-2">
            <input
              className="flex-1 rounded border border-white/10 bg-[#0b0f12] px-2 py-1.5 text-sm"
              value={draft}
              disabled={busy || Boolean(pending)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(draft);
                }
              }}
              placeholder={pending ? "job 运行中…" : "输入消息…"}
            />
            <button
              type="button"
              disabled={busy || Boolean(pending) || !draft.trim()}
              onClick={() => void sendMessage(draft)}
              className="rounded bg-white/10 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              发送
            </button>
          </div>
        </div>

        <div className="min-h-[320px] rounded border border-white/10 bg-[#0b0f12] p-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {turns.map((t) => (
              <button
                key={t.turn_id}
                type="button"
                onClick={() => {
                  setSelectedTurnId(t.turn_id);
                  setSelectedAttemptIdx(-1);
                }}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                  selectedTurn?.turn_id === t.turn_id
                    ? "bg-[#f2ca50]/20 text-[#f2ca50]"
                    : "bg-white/5 text-[#a1a1aa]"
                }`}
              >
                {t.kind}/{t.phase}
                {t.attempts.length > 1 ? `×${t.attempts.length}` : ""}
              </button>
            ))}
          </div>
          {selectedTurn && selectedTurn.attempts.length > 1 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {selectedTurn.attempts.map((a, i) => (
                <button
                  key={`${selectedTurn.turn_id}-a${a.attempt_number}`}
                  type="button"
                  onClick={() => setSelectedAttemptIdx(i)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    selectedAttempt?.attempt_number === a.attempt_number
                      ? "bg-[#9cf0ff]/20 text-[#9cf0ff]"
                      : "bg-white/5 text-[#71717a]"
                  }`}
                >
                  {a.call_trace?.phase ?? `leg${a.attempt_number}`}
                </button>
              ))}
            </div>
          ) : null}
          {selectedTurn?.gate ? (
            <p className="mb-2 text-xs text-[#a1a1aa]">
              gate: {selectedTurn.gate.action}
              {selectedTurn.gate.detail ? ` · ${selectedTurn.gate.detail}` : ""}
            </p>
          ) : null}
          {selectedAttempt?.error ? (
            <p className="mb-2 text-xs text-red-300">{selectedAttempt.error}</p>
          ) : null}
          {selectedTrace ? (
            <LabCallTracePanel
              call_trace={selectedTrace}
              fallback_raw={selectedAttempt?.raw_model_output}
              fallback_input={selectedAttempt?.input_payload}
            />
          ) : (
            <p className="text-xs text-[#71717a]">
              选一轮查看完整 call_trace（喂料 / system / user / reasoning / 输出 / meta）。Call A
              可能有多腿（dims / spine / voice），点上方腿切换。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
