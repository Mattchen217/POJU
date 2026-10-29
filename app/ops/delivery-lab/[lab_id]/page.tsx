"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThesisInspectPanel } from "../_components/ThesisInspectPanel";
import { LabCallTracePanel } from "../_components/LabCallTracePanel";
import {
  LabAssembleFaceShelf,
  LabFacePreview,
} from "../_components/LabFacePreview";
import {
  LabGateQualityChecklist,
  type QualityReviewState,
} from "../_components/LabGateQualityChecklist";
import {
  LabPipelinePanel,
  type LabPipelineView,
} from "../_components/LabPipelinePanel";
import { shouldAutoRefreshLockedDelivery } from "@/lib/llm/pro/delivery/lab/pipeline-reconcile";
import {
  BOOK_ASSEMBLE_STEP_KEY,
  isCompanionEntryUnlocked,
  isCompanionStepListLocked,
} from "@/lib/llm/pro/delivery/lab/companion-entry-lock";
import { withTransientNetworkRetry } from "@/lib/client/transient-network-retry";
import { labPipelineBadge } from "@/lib/llm/pro/delivery/lab/pipeline-stamp";
import { labLooksLikeLegacyTenPaper } from "@/lib/llm/pro/delivery/lab/types-v3";

type LabStepDef = {
  step_key: string;
  label: string;
  page?: string;
  faceId?: string;
  faceDisposition?: "primary" | "folded";
  kind: string;
  uses_llm: boolean;
  accept?: string;
  topic_gated?: boolean;
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
  quality_review?: QualityReviewState & { updated_at?: string };
};

type CompanionArtView = {
  delivery_day_key?: string;
  timezone?: string;
  sealed_at?: string;
  brief?: unknown;
  liuri_days?: number;
  batch_status?: string;
  batch_gate?: {
    passed?: boolean;
    failed_rule?: string;
    detail?: string;
    checked_at?: string;
    generated_count?: number;
  } | null;
  output_locale?: string;
  days?: Array<{
    day_index: number;
    date_key: string;
    has_cards?: boolean;
    generated_at?: string | null;
    cards?: unknown | null;
    meta?: unknown;
  }>;
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
  artifacts: {
    companion?: CompanionArtView;
    pages?: Record<string, { page_schema?: unknown }>;
    by_page?: Record<string, { page_schema?: unknown }>;
    assemble_faces?: Array<{
      faceId: string;
      title?: string;
      dualTrack?: string;
      page_schema?: unknown | null;
    }>;
    assemble_preview?: string;
    topic_gate_07?: {
      topic?: string | null;
      applies?: boolean;
      reason?: string;
    };
    book_judgment_pack?: unknown;
  };
  book_judgment_pack_enabled?: boolean;
  book_judgment_trace?: {
    shot_mode: string;
    unit_counts: {
      destiny: number;
      science: number;
      convergence: number;
      total: number;
    };
    by_face_coverage: Record<string, number>;
    face_matrix?: Array<{
      faceId: string;
      destiny: number;
      science: number;
      convergence: number;
      total: number;
      missing_destiny: boolean;
      missing_science: boolean;
      under_density: boolean;
      segment_coverage: number;
      segment_needed: number;
    }>;
    zfpOmitted: boolean;
    pattern_hits_used: string[];
    pattern_hits_unused?: string[];
    science_tags_used: string[];
    quota_total_min?: number;
    under_density?: boolean;
  } | null;
} & LabPipelineView;

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Artifact keys owned by the selected step kind (本步); rest → lab-global. */
const PEEK_STEP_OWNED_KEYS: Record<string, readonly string[]> = {
  bootstrap: [],
  thesis: ["thesis"],
  prealloc: ["prealloc"],
  book_judgment: ["book_judgment_pack"],
  gate_book_judgment: ["book_judgment_pack"],
  topic_gate: ["topic_gate_07"],
};

/**
 * Peek always splits 本步 / lab-global so book_judgment_pack is never a bare
 * top-level sibling of thesis/prealloc on Bootstrap.
 */
function splitArtifactsPeek(
  artifacts: unknown,
  stepKind: string | null,
): {
  本步: Record<string, unknown>;
  "lab-global": Record<string, unknown>;
} {
  const arts =
    artifacts && typeof artifacts === "object"
      ? { ...(artifacts as Record<string, unknown>) }
      : {};
  const owned = new Set(PEEK_STEP_OWNED_KEYS[stepKind ?? ""] ?? []);
  /** Pack is lab-global except when inspecting the pack / pack-gate step. */
  const packIsStepLocal =
    stepKind === "book_judgment" || stepKind === "gate_book_judgment";
  const local: Record<string, unknown> = {};
  const global: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(arts)) {
    if (key === "book_judgment_pack" && !packIsStepLocal) {
      global["book_judgment_pack"] = {
        _scope: "lab-global",
        present: value != null,
        ...(value && typeof value === "object"
          ? {
              shot_mode: (value as { shot_mode?: string }).shot_mode,
              units_n: Array.isArray((value as { units?: unknown }).units)
                ? (value as { units: unknown[] }).units.length
                : undefined,
            }
          : {}),
      };
      continue;
    }
    if (owned.has(key)) local[key] = value;
    else global[key] = value;
  }

  if (stepKind === "bootstrap") {
    local._note = "Bootstrap 不写 artifacts；题面/指纹见本步 Input";
  }

  return { 本步: local, "lab-global": global };
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
  /** Companion 双日提醒起点 day_index（0–29）；运行时出 N 与 N+1。 */
  const [companionDayIndex, setCompanionDayIndex] = useState(0);
  const [qualityReview, setQualityReview] = useState<QualityReviewState>({
    checks: {},
    notes: "",
  });
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
    const loc = (data.lab.source?.locale || "zh").toLowerCase();
    if (loc.startsWith("en")) setPolishLocale("en");
    else if (loc.startsWith("fr")) setPolishLocale("fr");
    else if (loc.startsWith("es")) setPolishLocale("es");
    else setPolishLocale("zh");
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

  useEffect(() => {
    const qr = attempt?.quality_review;
    setQualityReview({
      checks: (qr?.checks as QualityReviewState["checks"]) ?? {},
      notes: qr?.notes ?? "",
    });
  }, [attempt?.attempt_number, attempt?.quality_review, selected]);

  const cursorKey = lab?.cursor_step ?? null;
  const selectedIdx = useMemo(() => {
    if (!lab || !selected) return -1;
    return lab.step_defs.findIndex((d) => d.step_key === selected);
  }, [lab, selected]);

  const selectedKind =
    lab?.step_defs.find((d) => d.step_key === selected)?.kind ?? null;
  const isPolishStep = selectedKind === "body_polish";
  const isEvidenceSoftStep = selectedKind === "evidence_soft";
  const isLocaleStep = isPolishStep || isEvidenceSoftStep;
  const isGateStep =
    selectedKind === "gate" || selectedKind === "gate_book_judgment";
  const isBookJudgmentGateStep = selectedKind === "gate_book_judgment";
  const isBookJudgmentStep =
    selectedKind === "book_judgment" || isBookJudgmentGateStep;
  const isAssembleStep = selectedKind === "assemble";
  const isTopicGateStep = selectedKind === "topic_gate";
  const isFaceSliceStep = selectedKind === "face_slice";
  const isBootstrapStep = selectedKind === "bootstrap";
  const isNonLlmInspect =
    isTopicGateStep ||
    isFaceSliceStep ||
    selectedKind === "prealloc" ||
    isBookJudgmentGateStep ||
    isBootstrapStep;
  const isCompanionSeal = selectedKind === "companion_seal";
  const isCompanionDaily = selectedKind === "companion_daily";
  const isCompanionBatchPair = selectedKind === "companion_batch_pair";
  const isCompanionBatchGate = selectedKind === "companion_batch_gate";
  const isCompanionStep =
    isCompanionSeal ||
    isCompanionDaily ||
    isCompanionBatchPair ||
    isCompanionBatchGate;
  const isCompanionLocaleStep =
    isCompanionDaily || isCompanionBatchPair || isCompanionSeal;
  const selectedStepDef = lab?.step_defs.find((d) => d.step_key === selected);
  const polishPageKey = selectedStepDef?.page ?? null;
  const selectedFaceId = selectedStepDef?.faceId ?? polishPageKey ?? null;
  const facePreviewSchema =
    (selectedFaceId &&
      lab?.artifacts?.by_page?.[selectedFaceId]?.page_schema) ||
    (attempt?.raw_model_output &&
    typeof attempt.raw_model_output === "object" &&
    attempt.raw_model_output !== null &&
    "page" in (attempt.raw_model_output as object)
      ? attempt.raw_model_output
      : null);

  const companionArt = lab?.artifacts?.companion;
  const companionP1P3Ready = Boolean(
    (lab?.artifacts?.by_page?.["01"]?.page_schema &&
      lab?.artifacts?.by_page?.["05"]?.page_schema) ||
      (lab?.artifacts?.by_page?.direct_answer?.page_schema &&
        lab?.artifacts?.by_page?.science_action?.page_schema),
  );
  const legacyTenPaper = Boolean(
    lab && labLooksLikeLegacyTenPaper({ steps: lab.steps }),
  );
  const companionSealReady = Boolean(companionArt?.brief);
  const assembleStatus = lab?.steps?.[BOOK_ASSEMBLE_STEP_KEY]?.status ?? null;
  const assembleStepIndex =
    lab?.step_defs?.findIndex((d) => d.step_key === BOOK_ASSEMBLE_STEP_KEY) ?? -1;
  const companionEntryUnlocked = isCompanionEntryUnlocked({
    delivery_steps_locked:
      lab?.mode === "full_pipeline" && Boolean(lab.delivery_steps_locked),
    assemble_status: assembleStatus,
    assemble_in_approved_order: Boolean(
      lab?.approved_order?.includes(BOOK_ASSEMBLE_STEP_KEY),
    ),
    cursor_index: lab?.cursor_index,
    assemble_step_index: assembleStepIndex >= 0 ? assembleStepIndex : undefined,
  });

  const deliveryLocked =
    lab?.mode === "full_pipeline" && Boolean(lab.delivery_steps_locked);

  // Stage4 Case B: job finished server-side but UI still locked (pending pointer gone).
  // Keep calling lab GET (server reconcile) until delivery unlocks — avoid ops force-unlock.
  useEffect(() => {
    if (
      !lab_id ||
      !shouldAutoRefreshLockedDelivery({
        delivery_steps_locked: Boolean(deliveryLocked),
        has_pending_job: Boolean(lab?.pipeline_pending_job),
      })
    ) {
      return;
    }
    const t = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [lab_id, deliveryLocked, lab?.pipeline_pending_job, refresh]);

  /**
   * 包闸人审与 cursor 解耦：下游卡在 02.evidence_soft 时，
   * 只要已抵达过包步（selectedIdx <= cursor），仍可对本步点「通过」/重跑。
   */
  const bookPackHumanReviewFree =
    isBookJudgmentStep && selectedIdx >= 0 && selectedIdx <= (lab?.cursor_index ?? -1);
  const canRun =
    lab &&
    !deliveryLocked &&
    selected &&
    selectedIdx >= 0 &&
    rec?.status !== "running" &&
    (isCompanionStep
      ? companionEntryUnlocked &&
        companionP1P3Ready &&
        (isCompanionSeal || companionSealReady)
      : selectedIdx <= lab.cursor_index);
  const canApprove =
    lab &&
    !deliveryLocked &&
    attempt &&
    attempt.gate_verdict.passed &&
    !attempt.error &&
    rec?.status !== "approved" &&
    (isCompanionStep
      ? companionEntryUnlocked
      : bookPackHumanReviewFree || selected === cursorKey);
  const approveBlockReason = !lab
    ? "无 Lab"
    : deliveryLocked
      ? "交付步仍锁（pipeline 未解锁 / phase 未 ready）"
      : !attempt
        ? "请先运行本步"
        : !attempt.gate_verdict.passed
          ? `gate 未过${attempt.gate_verdict.failed_rule ? ` · ${attempt.gate_verdict.failed_rule}` : ""}`
          : attempt.error
            ? `attempt.error=${attempt.error}`
            : rec?.status === "approved"
              ? "已通过"
              : !isCompanionStep &&
                  !bookPackHumanReviewFree &&
                  selected !== cursorKey
                ? `非当前 cursor（cursor=${cursorKey ?? "?"}）`
                : isCompanionStep && !companionEntryUnlocked
                  ? "Companion 入口未解锁"
                  : null;
  const canRerunPrep =
    lab &&
    !deliveryLocked &&
    selected &&
    selectedIdx >= 0 &&
    (isCompanionStep
      ? companionEntryUnlocked && companionP1P3Ready
      : selectedIdx <= lab.cursor_index);

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
      rule === "soft_dispatch_continue" ||
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

  /** Lab write chunk wall ≈ 285s + route maxDuration 300s; abort hung fetches. */
  const LAB_RUN_CLIENT_TIMEOUT_MS = 320_000;

  function companionPairHasCards(
    view: LabView | undefined,
    dayIndex: number,
  ): boolean {
    const days = view?.artifacts?.companion?.days ?? [];
    const a = days.find((d) => d.day_index === dayIndex);
    const b =
      dayIndex < 29 ? days.find((d) => d.day_index === dayIndex + 1) : null;
    const hasA = Boolean(a?.cards ?? a?.has_cards);
    if (dayIndex >= 29) return hasA;
    const hasB = Boolean(b?.cards ?? b?.has_cards);
    return hasA && hasB;
  }

  async function unlockCompanionAfterTimeout(stageId: string): Promise<LabView | null> {
    try {
      const unlock = await fetch(
        `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/rerun`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage_id: stageId }),
        },
      );
      const unlockJson = (await unlock.json().catch(() => null)) as {
        lab?: LabView;
      } | null;
      if (unlockJson?.lab) {
        setLab(unlockJson.lab);
        return unlockJson.lab;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function postRun(
    body: Record<string, unknown>,
    outerSignal?: AbortSignal | null,
  ) {
    /**
     * Case C: ERR_CONNECTION_CLOSED / Failed to fetch on Companion /run.
     * Retry the same POST only while no response body was received — local
     * hop / companionDayIndex / lab React state stay outside this helper.
     */
    return withTransientNetworkRetry(
      async (attempt) => {
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
            `服务器返回非 JSON（HTTP ${res.status}）：${snip || "(empty)"}`,
          );
        }
        if (attempt > 1) {
          setDispatchNote(null);
        }
        return { res, data, rawText };
      },
      {
        signal: outerSignal ?? null,
        onRetry: ({ attempt, maxAttempts, delayMs }) => {
          setDispatchNote(
            `网络中断，自动重试第 ${attempt + 1}/${maxAttempts} 次（${delayMs}ms）…`,
          );
        },
      },
    );
  }

  async function postAction(
    path: "run" | "approve" | "rerun",
    opts?: { skip_polish?: boolean; skip_body?: boolean },
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
        const selectedDefForAction = lab?.step_defs.find(
          (d) => d.step_key === selected,
        );
        const clearCompanionPair =
          path === "rerun" &&
          (selectedDefForAction?.kind === "companion_daily" ||
            selectedDefForAction?.kind === "companion_batch_pair");
        const res = await fetch(
          `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/${path}`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage_id: selected,
              ...(path === "approve" &&
              (selectedDefForAction?.kind === "gate" ||
                selectedDefForAction?.kind === "gate_book_judgment")
                ? { quality_review: qualityReview }
                : {}),
              /** 人手准备重跑：清空当前选中双日；504 自动解锁不走这里。 */
              ...(clearCompanionPair
                ? {
                    clear_companion_pair: true,
                    day_index: companionDayIndex,
                  }
                : {}),
            }),
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
        if (path === "approve" && data.ok) {
          if (selected === "companion.seal") {
            setSelectedKey("companion.daily");
          } else if (selected === "companion.batch_pair") {
            const filled =
              data.lab?.artifacts?.companion?.days?.filter(
                (d: { has_cards?: boolean; cards?: unknown }) =>
                  Boolean(d.has_cards || d.cards),
              ).length ?? 0;
            if (filled >= 30) setSelectedKey("companion.batch_gate");
          } else if (!isCompanionStep && data.lab?.cursor_step) {
            setSelectedKey(data.lab.cursor_step);
          }
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
      const isCompanionDailyRun = selectedDef?.kind === "companion_daily";
      const isCompanionBatchPairRun =
        selectedDef?.kind === "companion_batch_pair";
      const isCompanionSealRun = selectedDef?.kind === "companion_seal";
      const polishRunBody =
        isBodyPolish || isEvidenceSoft
          ? {
              stage_id: selected,
              polish_locale: polishLocale,
              ...(isBodyPolish && opts?.skip_polish ? { skip_polish: true } : {}),
            }
          : isCompanionDailyRun
            ? {
                stage_id: selected,
                day_index: companionDayIndex,
                polish_locale: polishLocale,
              }
            : isCompanionBatchPairRun
              ? {
                  stage_id: selected,
                  day_index: companionDayIndex,
                  polish_locale: polishLocale,
                }
              : isCompanionSealRun
                ? { stage_id: selected, polish_locale: polishLocale }
                : {
                    stage_id: selected,
                    ...(opts?.skip_body ? { skip_body: true } : {}),
                  };

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
       * Lab only auto-continues provider_escape (supply). Quality retry is forbidden
       * in Lab — same soFar continue allowed once for escape only.
       */
      let sameSoFarContinuesLeft = 1;
      let pendingRetryKind: "escape" | "quality" | null = null;
      while (autoContinue) {
        if (myGen !== runGenerationRef.current || sessionAc.signal.aborted) {
          setDispatchNote("续跑已中止");
          return;
        }
        autoContinue = false;
        hop += 1;
        if (hop === 1) {
          setDispatchNote("正在写第 1 枪（主枪 · 独立 ~285s）…");
        } else if (pendingRetryKind === "escape") {
          setDispatchNote(
            `供应侧重试 · 第 ${hop} 枪（新 invoke · 独立 ~285s；Lab 仅供应失败可自动续 1 次）…`,
          );
        } else {
          setDispatchNote(
            `正在请求第 ${hop} 枪（每枪独立 ~285s；Lab 质量闸不过不自动续）…`,
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
            // Auto-unlock via /rerun so「运行」不灰死；companion 日稿已改为不清墙。
            const refreshed = await unlockCompanionAfterTimeout(selected);
            if (
              (isCompanionDailyRun || isCompanionBatchPairRun) &&
              companionPairHasCards(refreshed ?? undefined, companionDayIndex)
            ) {
              setError(null);
              setDispatchNote(
                "HTTP 超时，但双日稿已落库（早期写回）。请直接看右侧日卡 / 下方 JSON。",
              );
            } else {
              setError(
                `${msg}。已自动解锁本步（不清已有陪伴日稿）。可直接再点「运行」。`,
              );
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
            data.attempt?.gate_verdict?.failed_rule === "mark_dispatch_continue" ||
            data.attempt?.gate_verdict?.failed_rule === "soft_dispatch_continue");

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
            // Lab must not auto quality-retry — treat as hard stop if server still emits it.
            setError(
              `${detail ?? "验收未过"}（Lab 禁止质量自动重试 · 请看 Call trace / 输出 dump 后手点准备重跑）`,
            );
            return;
          } else if (out?.provider_escape === true && out?.chunks_total === 1) {
            pendingRetryKind = "escape";
            setDispatchNote(
              `${detail ?? "供应侧失败"} → 立刻供应侧重试（新 invoke · 独立 ~285s）…`,
            );
          } else {
            setDispatchNote(
              detail
                ? `${detail} → 立刻续跑第 ${next}/${total} 块…`
                : `已完成一块 → 立刻续跑第 ${next}/${total} 块（每块独立 ~285s）…`,
            );
          }
          autoContinue = true;
          continue;
        }

        if (!res.ok || !data.ok) {
          const gateFail = data.attempt?.gate_verdict?.failed_rule;
          const msg = data.error ?? `HTTP ${res.status}`;
          if (res.status === 504) {
            // 超时后前端会自动 POST /rerun 解锁（你没点「准备重跑」也会走这里）。
            const refreshed = await unlockCompanionAfterTimeout(selected);
            if (
              (isCompanionDailyRun || isCompanionBatchPairRun) &&
              companionPairHasCards(refreshed ?? undefined, companionDayIndex)
            ) {
              setError(null);
              setDispatchNote(
                "HTTP 超时，但双日稿已落库（早期写回）。请直接看右侧日卡 / 下方 JSON。",
              );
            } else {
              setError(
                `本步超时（HTTP 504）。已自动解锁本步（不清已有陪伴日稿）。可直接再点「运行」。`,
              );
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
            lab.pipeline === "decision_shelf" || lab.pipeline === "v3_three_step"
              ? "bg-[#9cf0ff]/15 text-[#9cf0ff]"
              : "bg-white/10 text-[#a1a1aa]",
          ].join(" ")}
        >
          {labPipelineBadge(lab.pipeline)}
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

      {lab.mode === "full_pipeline" ? (
        <div className="border-b border-white/10 px-4 py-3">
          <LabPipelinePanel
            lab_id={lab_id}
            view={lab}
            locale={lab.source.locale}
            onLabUpdate={(next) => setLab(next as LabView)}
          />
        </div>
      ) : null}

      {legacyTenPaper ? (
        <div className="border-b border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
          此 Lab 仍含旧 10 纸步键（decision_brief / personal_decision_patterns 等）。请新建 Lab
          （decision_shelf · face 合同）再测；本会话可能混乱，勿当新版证据。
        </div>
      ) : null}

      {deliveryLocked ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          <p className="flex-1">
            交付步骤已锁定：先跑完上方 Stage1–3（Synthesis 成功后自动解锁）。若服务端已完成仍灰，点右侧解锁。
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const res = await fetch(
                    `/api/ops/delivery-lab/${encodeURIComponent(lab_id)}/gate`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "unlock_delivery" }),
                    },
                  );
                  const data = (await res.json()) as {
                    ok?: boolean;
                    error?: string;
                    lab?: LabView;
                  };
                  if (!res.ok || !data.ok || !data.lab) {
                    setError(data.error ?? `HTTP ${res.status}`);
                    return;
                  }
                  setLab(data.lab);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "unlock_failed");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="shrink-0 rounded border border-amber-200/40 bg-amber-500/20 px-2.5 py-1 font-medium text-amber-50 hover:bg-amber-500/30 disabled:opacity-40"
          >
            强制解锁交付
          </button>
        </div>
      ) : null}

      <div
        className={[
          "flex min-h-0 flex-1 flex-col lg:flex-row",
          deliveryLocked ? "pointer-events-none opacity-40" : "",
        ].join(" ")}
      >
        {/* Step list */}
        <aside className="max-h-[40vh] w-full overflow-y-auto border-b border-white/10 lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
          {lab.book_judgment_pack_enabled !== false ? (
            <div className="border-b border-white/10 px-2 py-2 text-[10px] leading-4 text-[#a1a1aa]">
              <p className="font-medium text-[#9cf0ff]/90">BookJudgmentPack</p>
              {lab.book_judgment_trace ? (
                <div className="mt-1 space-y-1 font-mono text-[9px] text-[#d6d3d1]">
                  <p>
                    shot={lab.book_judgment_trace.shot_mode} · n=
                    {lab.book_judgment_trace.unit_counts.total}
                    {lab.book_judgment_trace.quota_total_min != null
                      ? `/${lab.book_judgment_trace.quota_total_min}`
                      : ""}
                    {lab.book_judgment_trace.under_density ? " · 过稀" : ""} · d=
                    {lab.book_judgment_trace.unit_counts.destiny} s=
                    {lab.book_judgment_trace.unit_counts.science} c=
                    {lab.book_judgment_trace.unit_counts.convergence}
                  </p>
                  {lab.book_judgment_trace.face_matrix?.length ? (
                    <p
                      className="leading-3 text-[#a1a1aa]"
                      title="每脸 exclusive track 计数（d+s+c=该脸 unit 数；与 JSON unit.track 一致；勿跨脸相加）"
                    >
                      {lab.book_judgment_trace.face_matrix
                        .map((r) => {
                          const bad =
                            r.missing_destiny ||
                            r.missing_science ||
                            r.under_density
                              ? "!"
                              : "";
                          return `${r.faceId}${bad}(${r.destiny}/${r.science}/${r.convergence}=${r.total})`;
                        })
                        .join(" ")}
                    </p>
                  ) : null}
                  <p>
                    patternHits=
                    {lab.book_judgment_trace.pattern_hits_used.length
                      ? lab.book_judgment_trace.pattern_hits_used
                          .slice(0, 3)
                          .join(",")
                      : "∅"}
                    {lab.book_judgment_trace.pattern_hits_unused?.length
                      ? ` · unused=${lab.book_judgment_trace.pattern_hits_unused
                          .slice(0, 2)
                          .join(",")}`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-1">待跑 book.judgment · 无 per-page judgment</p>
              )}
            </div>
          ) : (
            <div className="border-b border-white/10 px-2 py-2 text-[10px] text-amber-200/80">
              BOOK_JUDGMENT_PACK=0 · 旧 per-page judgment
            </div>
          )}
          <ul className="p-2">
            {lab.step_defs.map((d, i) => {
              const st = lab.steps[d.step_key]?.status ?? "idle";
              const isCompanionDef =
                d.kind === "companion_seal" ||
                d.kind === "companion_daily" ||
                d.kind === "companion_batch_pair" ||
                d.kind === "companion_batch_gate";
              const locked = isCompanionDef
                ? isCompanionStepListLocked({
                    delivery_steps_locked: deliveryLocked,
                    assemble_status: assembleStatus,
                    assemble_in_approved_order: Boolean(
                      lab.approved_order?.includes(BOOK_ASSEMBLE_STEP_KEY),
                    ),
                    cursor_index: lab.cursor_index,
                    assemble_step_index:
                      assembleStepIndex >= 0 ? assembleStepIndex : undefined,
                    kind: d.kind,
                    companion_seal_ready: companionSealReady,
                  })
                : deliveryLocked || i > lab.cursor_index;
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
                      isCompanionDef && !locked ? "border border-[#f2ca50]/20" : "",
                    ].join(" ")}
                  >
                    <span className="mr-1 tabular-nums text-[#71717a]">{i + 1}.</span>
                    {d.faceId ? (
                      <span
                        className="mr-1 rounded bg-[#9cf0ff]/10 px-1 font-mono text-[9px] text-[#9cf0ff]"
                        title={`face ${d.faceId}${d.topic_gated ? " · topic-gated" : ""}`}
                      >
                        {d.faceId}
                      </span>
                    ) : null}
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
                    : isCompanionDaily
                      ? companionDayIndex >= 29
                        ? `运行 Day 30/30 · ${polishLocale}`
                        : `运行 Day ${companionDayIndex + 1}+${companionDayIndex + 2}/30 · ${polishLocale}`
                      : isCompanionBatchPair
                        ? `填一对 · ${polishLocale}`
                        : isCompanionBatchGate
                          ? "跑满窗整体闸"
                          : isCompanionSeal
                            ? `封版 Brief+流日 · ${polishLocale}`
                            : "运行本步"}
            </button>
            {isLocaleStep || isCompanionLocaleStep ? (
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
            {selected === "03.content.body" ? (
              <button
                type="button"
                disabled={busy || !canRun}
                onClick={() => void postAction("run", { skip_body: true })}
                className="rounded-md border border-amber-400/50 px-3 py-1.5 text-sm text-amber-200 disabled:opacity-40"
                title="附录对照句可 Skip：以 03.slice 检视为准"
              >
                跳过对照句
              </button>
            ) : null}
            {isCompanionDaily || isCompanionBatchPair ? (
              <label className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                {isCompanionBatchPair
                  ? "from day"
                  : companionDayIndex >= 29
                    ? "day (仅末日)"
                    : `day (出 ${companionDayIndex + 1}+${companionDayIndex + 2})`}
                <select
                  className="rounded border border-white/15 bg-[#101417] px-1.5 py-1 text-sm text-white"
                  value={companionDayIndex}
                  disabled={busy}
                  onChange={(e) => setCompanionDayIndex(Number(e.target.value))}
                >
                  {Array.from({ length: 30 }, (_, i) => {
                    const dayMeta = companionArt?.days?.[i];
                    const pairHint =
                      isCompanionDaily && i < 29 ? ` →${i + 2}` : "";
                    const label = dayMeta?.date_key
                      ? `${i + 1}${pairHint} · ${dayMeta.date_key}`
                      : `${i + 1}${pairHint}`;
                    return (
                      <option key={i} value={i}>
                        {label}
                        {dayMeta?.has_cards || dayMeta?.cards ? " · 有稿" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
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
              title={
                canApprove
                  ? isCompanionStep
                    ? "Companion 侧轨：gate 过即可人审通过（不推进交付主链 cursor）"
                    : isBookJudgmentGateStep
                      ? "批断包机检过即可通过（勾选可选）"
                      : "通过并解锁下一步"
                  : approveBlockReason ?? "不可通过"
              }
            >
              {isCompanionStep
                ? "本步通过（人审）"
                : isBookJudgmentGateStep
                  ? "本步通过（解锁正文）"
                  : "本步通过（解锁下一步）"}
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
                  : isCompanionSeal
                    ? " 侧轨：Assemble 通过后解锁；仍需 P1+P3 正文才能封版（不挡交付主链 cursor）。抽 Brief + 本地 30 日流日 pack；locale=输出语言。"
                    : isCompanionDaily
                      ? " 先 seal。选 day + locale 跑单日（测多语母语可读）；Call trace 含喂料/提示词/推理/输出。"
                      : isCompanionBatchPair
                        ? " 从 from day 起填下一对未填日（1枪1天×最多2）。可重复直到 30/30。"
                        : isCompanionBatchGate
                          ? " 须 30/30 有稿。机检邻日近复 / evidence 工程量 / 过薄。过闸=生产可滴灌。"
                          : ""}
              {isCompanionStep && !companionEntryUnlocked
                ? " 须先通过 Assemble（book.assemble）后才能进 Companion。"
                : isCompanionStep && !companionP1P3Ready
                  ? " 当前缺 P1 或 P3 page_schema，先跑完对应正文步。"
                  : ""}
            </p>
          ) : (
            <div className="grid min-h-0 flex-1 gap-2 p-3 lg:grid-cols-2">
              {isCompanionStep && companionArt ? (
                <div className="flex min-h-[8rem] flex-col rounded-md border border-[#f2ca50]/25 bg-[#101417] lg:col-span-2">
                  <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#f2ca50]">
                    Companion · {companionArt.delivery_day_key} 起 · {companionArt.timezone} ·{" "}
                    {companionArt.liuri_days ?? 0} 日包 · locale=
                    {companionArt.output_locale ?? polishLocale} · batch=
                    {companionArt.batch_status ?? "pending"}
                    {companionArt.batch_gate
                      ? ` · gate=${companionArt.batch_gate.passed ? "pass" : "fail"}`
                      : ""}
                  </h2>
                  {companionArt.batch_gate?.detail ? (
                    <p className="border-b border-white/10 px-3 py-1.5 text-[11px] text-[#a1a1aa]">
                      闸：{companionArt.batch_gate.detail}
                      {companionArt.batch_gate.failed_rule
                        ? ` · ${companionArt.batch_gate.failed_rule}`
                        : ""}
                    </p>
                  ) : null}
                  <div className="grid gap-2 p-3 lg:grid-cols-2">
                    <pre className="max-h-48 overflow-auto font-mono text-[10px] leading-snug whitespace-pre-wrap text-[#a1a1aa]">
                      {pretty(companionArt.brief).slice(0, 2_400)}
                      {pretty(companionArt.brief).length > 2_400 ? "…" : ""}
                    </pre>
                    <div className="grid max-h-48 grid-cols-5 gap-1 overflow-auto sm:grid-cols-6">
                      {(companionArt.days ?? []).map((d) => {
                        const has = Boolean(d.has_cards || d.cards);
                        const active = d.day_index === companionDayIndex;
                        return (
                          <button
                            key={d.day_index}
                            type="button"
                            onClick={() => setCompanionDayIndex(d.day_index)}
                            className={[
                              "rounded border px-1 py-1 text-[10px]",
                              has
                                ? "border-[#f2ca50]/50 text-[#f2ca50]"
                                : "border-white/10 text-[#71717a]",
                              active ? "bg-white/10 ring-1 ring-[#9cf0ff]/40" : "",
                            ].join(" ")}
                            title={d.date_key}
                          >
                            {d.day_index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(isCompanionDaily || isCompanionBatchPair) &&
                  companionArt.days?.[companionDayIndex]?.cards ? (
                    <pre className="max-h-56 overflow-auto border-t border-white/10 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {pretty(companionArt.days[companionDayIndex]!.cards)}
                    </pre>
                  ) : null}
                  {isCompanionBatchGate && attempt?.raw_model_output ? (
                    <pre className="max-h-56 overflow-auto border-t border-white/10 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {pretty(attempt.raw_model_output)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
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
              ) : isNonLlmInspect || isAssembleStep ? (
                <div className="grid gap-2 lg:col-span-2 lg:grid-cols-2">
                  <div className="flex min-h-[12rem] flex-col rounded-md border border-white/10 bg-[#101417]">
                    <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#71717a]">
                      Input
                    </h2>
                    <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {pretty(attempt.input_payload)}
                    </pre>
                  </div>
                  <div className="flex min-h-[12rem] flex-col rounded-md border border-[#9cf0ff]/25 bg-[#101417]">
                    <h2 className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-[#9cf0ff]">
                      Result
                    </h2>
                    <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {pretty(attempt.raw_model_output ?? attempt.output_to_next_stage)}
                    </pre>
                  </div>
                </div>
              ) : (
                <LabCallTracePanel
                  call_trace={attempt.call_trace}
                  fallback_input={attempt.input_payload}
                  fallback_raw={attempt.raw_model_output}
                />
              )}
              {isGateStep ? (
                <div className="lg:col-span-2">
                  <LabGateQualityChecklist
                    faceId={
                      isBookJudgmentGateStep
                        ? "book"
                        : (selectedFaceId ?? undefined)
                    }
                    formatPassed={Boolean(attempt.gate_verdict.passed)}
                    formatDetail={
                      isBookJudgmentGateStep
                        ? `${attempt.gate_verdict.detail ?? ""} · 勾选可选，机检过即可点「本步通过」`
                        : attempt.gate_verdict.detail
                    }
                    value={qualityReview}
                    disabled={rec?.status === "approved"}
                    onChange={setQualityReview}
                  />
                </div>
              ) : null}
              {isAssembleStep ? (
                <div className="lg:col-span-2">
                  <LabAssembleFaceShelf
                    faces={
                      lab.artifacts.assemble_faces ??
                      (
                        attempt.raw_model_output as {
                          faces?: Array<{
                            faceId: string;
                            title?: string;
                            dualTrack?: string;
                            page_schema?: unknown | null;
                          }>;
                        } | null
                      )?.faces ??
                      []
                    }
                    locale={lab.source.locale || "zh"}
                  />
                </div>
              ) : null}
              {!isAssembleStep &&
              selectedFaceId &&
              (selectedKind === "content_body" ||
                selectedKind === "gate" ||
                selectedKind === "body_polish") ? (
                <div className="lg:col-span-2">
                  <LabFacePreview
                    faceId={selectedFaceId}
                    page_schema={facePreviewSchema}
                    locale={lab.source.locale || "zh"}
                  />
                </div>
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
              {pretty(splitArtifactsPeek(lab.artifacts, selectedKind))}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
