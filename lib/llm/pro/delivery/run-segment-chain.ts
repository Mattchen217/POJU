/**
 * P3 — one segment's full chain (Batch 3 order):
 *   start → deep assign → deep_assigned → write(/rewrite hop) → evidence_done
 *        → narrative compress fill → narrative_done
 *        → mark → mark_done → [body translate] → done
 * Legacy checkpoints (fill before evidence) are migrated in-place.
 * Progress is checkpointed between phases so soft-wall hops can resume mid-chain.
 */

import {
  DELIVERY_TRANSITION_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryTask } from "@/lib/llm/pro/delivery/delivery-tasks";
import { DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS, DELIVERY_MARK_TIMEOUT_MS, PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS, PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  deliveryEvidenceLeadLabel,
  deliveryEvidencePendingDetectRe,
  deliveryEvidencePendingPlaceholder,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import { runEvidenceTask } from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { runMarkDeliveryTask } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { translateDeliverySegments } from "@/lib/llm/pro/delivery/translate-delivery-segment";
import { encodeConnectiveEvidenceToTerms } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { countEvidenceCoverage } from "@/lib/llm/pro/delivery/expand-arguments-by-h3";
import { isSignalsCloseSealBodyIndex } from "@/lib/llm/pro/delivery/page-schema/render";
import {
  buildSegmentStructureMarkdown,
  encodePageScanMarkdown,
  encodeThirtyDayGanttMarkdown,
  localizePageScanCardLabels,
  localizeThirtyDayGanttLabels,
  type PageScanCardStruct,
  type ThirtyDayGanttStruct,
} from "@/lib/llm/pro/delivery/poju-struct-blocks";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import {
  translatePageScanCard,
  translateThirtyDayGantt,
} from "@/lib/llm/pro/delivery/translate-delivery-segment";
import { runPageSchemaFill } from "@/lib/llm/pro/delivery/page-schema/fill-call";
import {
  alignDeepEvidenceToPage,
  evidenceTreeFromAligned,
  runDeepEvidenceCall,
  runDeepEvidenceWritesFromAssignment,
  type DeepEvidencePlan,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { runDeepEvidenceAssignCall } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidencePromptOpts } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import {
  DELIVERY_PHASE_LLM_ATTEMPTS_MAX,
  isDeliverySoftWallRetryableFail,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { formatP5ActionBriefForPrompt } from "@/lib/llm/pro/delivery/page-schema/action-extractor";
import {
  encodePageSchemaFence,
  pageSchemaToArgumentTree,
} from "@/lib/llm/pro/delivery/page-schema/render";
import type {
  DeliveryPageData,
  P5ActionBrief,
  P5WeekSummary,
} from "@/lib/llm/pro/delivery/page-schema/types";

export type SegmentChainPhase =
  | "start"
  /** Anchors assigned; writes (or deferred rewrite) still needed. */
  | "deep_assigned"
  | "narrative_done"
  | "evidence_done"
  | "mark_done"
  | "done";

export type SegmentChainProgress = {
  key: DeliverySegmentKey;
  phase: SegmentChainPhase;
  narrative?: DeliveryArgumentTree;
  evidence?: DeliveryArgumentTree;
  marked?: DeliveryArgumentTree;
  /** Structured page slots (page_schema_v1) — primary path. */
  page_schema?: DeliveryPageData;
  /** Call0 assignment (path → anchors / moat) — resume writes without re-assign. */
  deep_evidence_assignment?: import("./page-schema/deep-evidence-assign").DeepEvidenceAssignment;
  /** Batch 3: locked deep-evidence plan (anchors + professional evidence). */
  deep_evidence_plan?: DeepEvidencePlan;
  /** Quality fail after first write — next deep_assigned hop rewrites only. */
  deep_rewrite_reason?: string;
  /**
   * Times we bounced merge → re-assign because locked anchors were too similar.
   * Cap 1 — write rewrite cannot fix chart_anchors.
   */
  deep_reassign_count?: number;
  /**
   * Times merge forced unique primaries in code (no LLM) then rewrote writes.
   * Cap 1 — last construction repair before hard fail.
   */
  deep_anchor_code_repair_count?: number;
  /** Model scan from narrative JSON (may be translated later). */
  scan?: PageScanCardStruct | null;
  /** Model thirty-day table from narrative JSON (may be translated later). */
  gantt?: ThirtyDayGanttStruct | null;
  tokens_used: number;
  /**
   * Soft-wall /continue hops for this segment (any phase).
   * Hard-stops at DELIVERY_SEGMENT_SOFT_HOP_MAX.
   */
  soft_hop_count?: number;
  /**
   * LLM admits spent per phase (1 primary + 1 retry max).
   */
  phase_llm_attempts?: Partial<Record<SegmentChainPhase, number>>;
  /**
   * Transport/timeout failures for this segment (mark/evidence/…).
   * Soft-retried until DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS, then job interrupts.
   */
  transport_fail_count?: number;
  /**
   * Times we soft-walled after page_schema fill failed while still on phase "start".
   * After FILL_YIELD_BEFORE_NARRATIVE, structured fill fails visibly (no narrative degrade).
   */
  fill_yield_count?: number;
};

/** Soft-wall fill failures at phase=start before refusing (no narrative degrade). */
/** Soft-wall fill failures before refusing (1 yield = the one retry hop). */
export const FILL_YIELD_BEFORE_NARRATIVE = 1;

function phaseLlmAttempts(
  progress: SegmentChainProgress,
  phase: SegmentChainPhase,
): number {
  return progress.phase_llm_attempts?.[phase] ?? 0;
}

function withPhaseLlmAttempt(
  progress: SegmentChainProgress,
  phase: SegmentChainPhase,
): SegmentChainProgress {
  const prev = phaseLlmAttempts(progress, phase);
  return {
    ...progress,
    phase_llm_attempts: {
      ...(progress.phase_llm_attempts ?? {}),
      [phase]: prev + 1,
    },
  };
}

function phaseBudgetExhausted(
  progress: SegmentChainProgress,
  phase: SegmentChainPhase,
): boolean {
  return phaseLlmAttempts(progress, phase) >= DELIVERY_PHASE_LLM_ATTEMPTS_MAX;
}

/** Keys that need a longer fill client abort (thinking + fat JSON). */
export const SEGMENT_HEAVY_FILL_KEYS = new Set<DeliverySegmentKey>([
  "direct_answer", // thick core_logic dual-track JSON
  "foundation", // 4–5 why_cards + essence thickness
  "science_action", // 3+3 angles fat JSON
  "metaphysics_action",
  "risk_guard",
  "signals_close", // identity + tonight + day7×4 fat JSON
]);

export type DeliverySegmentReady = {
  key: DeliverySegmentKey;
  heading: string;
  body_markdown: string;
  evidence_markdown: string;
  /**
   * Per-argument interleaved markdown (body → **依据:** → evidence → …).
   * Prefer this for progressive UI so layout matches final merge.
   */
  interleaved_markdown?: string;
  /** Structured slots for UI (optional; prose fallback if absent). */
  page_schema?: DeliveryPageData;
  evidence_ready: boolean;
  locale: string;
};

export type SegmentChainRunResult =
  | {
      ok: true;
      done: true;
      progress: SegmentChainProgress;
      ready: DeliverySegmentReady;
      tokens_used: number;
    }
  | {
      ok: true;
      done: false;
      progress: SegmentChainProgress;
      tokens_used: number;
      /** Soft-wall: caller should hop /continue before starting next phase. */
      yield_for_soft_wall: true;
    }
  | { ok: false; reason: string; tokens_used: number; progress: SegmentChainProgress };

/**
 * Minimum invoke budget (ms) to start another LLM phase in-process.
 * Below this → soft-wall yield to /continue (fresh 300s).
 *
 * Default 55s; override with DELIVERY_SEGMENT_MIN_INVOKE_MS for production calibration.
 * Heavy pages use SEGMENT_HEAVY_MIN_INVOKE_MS so they do not start with a starved timeout.
 */
export const SEGMENT_MIN_INVOKE_MS = (() => {
  const raw = Number.parseInt(process.env.DELIVERY_SEGMENT_MIN_INVOKE_MS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 55_000;
})();

/**
 * Admit window for metaphysics_action / risk_guard fills (thinking + fat context).
 * Must stay ≥ deep assign/write client ceiling so we soft-wall instead of
 * starting a 270s call with a starved remaining budget.
 */
export const SEGMENT_HEAVY_MIN_INVOKE_MS = PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS;

/**
 * Admit for any non-bootstrap page starting deep (assign+write budget).
 * Same window as heavy — avoid starting xhigh with a 55s starved budget.
 */
export const SEGMENT_DEEP_EVIDENCE_MIN_INVOKE_MS = SEGMENT_HEAVY_MIN_INVOKE_MS;

/** Write-only / rewrite hop after assignment is checkpointed. */
/** Deep-write admit: must match PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS, not fill's 120s. */
export const SEGMENT_DEEP_WRITE_MIN_INVOKE_MS = PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS;

/** Fill resume — client ceiling still up to 180s via phaseTimeout; admit allows packing. */
export const SEGMENT_FILL_MIN_INVOKE_MS = 120_000;

/** Mark resume — lighter than deep/fill; avoid empty hops after narrative_done. */
export const SEGMENT_MARK_MIN_INVOKE_MS = 90_000;

/**
 * Bootstrap (P1) may finish translate / last hop with a tighter floor so the
 * shelf unlocks instead of soft-walling with empty `require_preface` markdown.
 */
export const SEGMENT_BOOTSTRAP_MIN_INVOKE_MS = 40_000;

/** Remaining hard-deadline budget to pack another schema DAG wave in the same invoke. */
export const SCHEMA_WAVE_PACK_MIN_REMAINING_MS = 130_000;

/** @deprecated Light/medium fill tier removed — all fills are high. Kept empty for grep guards. */
export const SEGMENT_LIGHT_FILL_KEYS = new Set<DeliverySegmentKey>([]);

/** Compress / page fill — never below high (no medium). */
export function segmentFillThinkingEffort(
  _key: DeliverySegmentKey,
): "high" {
  return "high";
}

/**
 * Admit threshold for the next segment phase.
 * Deep start stays on PAGE_SCHEMA_DEEP_* ceiling; fill/mark/write-only use lower floors to cut hop tax.
 */
export function segmentAdmitMinMs(
  key: DeliverySegmentKey,
  phase: SegmentChainPhase = "start",
): number {
  if (key === "direct_answer") {
    if (phase === "evidence_done") return SEGMENT_FILL_MIN_INVOKE_MS;
    return SEGMENT_BOOTSTRAP_MIN_INVOKE_MS;
  }
  switch (phase) {
    case "deep_assigned":
      return SEGMENT_DEEP_WRITE_MIN_INVOKE_MS;
    case "evidence_done":
      return SEGMENT_FILL_MIN_INVOKE_MS;
    case "narrative_done":
      return SEGMENT_MARK_MIN_INVOKE_MS;
    case "mark_done":
      return SEGMENT_BOOTSTRAP_MIN_INVOKE_MS;
    case "start":
    case "done":
    default:
      return SEGMENT_DEEP_EVIDENCE_MIN_INVOKE_MS;
  }
}

/** Cap LLM client abort to remaining invoke budget (never below 30s). */
export function segmentPhaseTimeoutMs(
  ceilingMs: number,
  invokeHardDeadlineMs: number,
  invocationStartedAt: number,
): number {
  const remaining = invokeHardDeadlineMs - (Date.now() - invocationStartedAt);
  // Keep 12s for checkpoint + handoff after the LLM returns/aborts.
  return Math.min(ceilingMs, Math.max(30_000, remaining - 12_000));
}

/** @deprecated Soft-wall uses SEGMENT_MIN_INVOKE_MS; kept for reserveMsForFullSegmentChain. */
export function reserveMsForSegmentPhaseKey(
  phase: SegmentChainPhase,
  key: DeliverySegmentKey,
  locale: string,
): number {
  if (phase === "start") {
    // Deep evidence (or transition skip → fill soon)
    return SEGMENT_HEAVY_FILL_KEYS.has(key) ? SEGMENT_HEAVY_MIN_INVOKE_MS : SEGMENT_MIN_INVOKE_MS;
  }
  if (phase === "evidence_done") {
    // Narrative compress fill next
    return SEGMENT_HEAVY_FILL_KEYS.has(key) ? SEGMENT_HEAVY_MIN_INVOKE_MS : SEGMENT_MIN_INVOKE_MS;
  }
  if (phase === "narrative_done") {
    return DELIVERY_TRANSITION_KEYS.has(key) ? 0 : 120_000;
  }
  if (phase === "mark_done") {
    return locale.startsWith("zh") ? 0 : 90_000;
  }
  return 0;
}

/** Worst-case reserve for starting a brand-new segment chain in this invoke. */
export function reserveMsForFullSegmentChain(locale: string): number {
  // narrative + evidence + mark (+ body translate) — prefer hop over mid-chain kill
  const translate = locale.startsWith("zh") ? 0 : 90_000;
  return SEGMENT_MIN_INVOKE_MS + DELIVERY_MARK_TIMEOUT_MS + DELIVERY_MARK_TIMEOUT_MS + translate;
}

function sectionHeading(key: DeliverySegmentKey, locale: string): string {
  return deliverySectionHeading(key, locale);
}

function bodiesToMarkdown(args: Array<{ body: string }> | undefined): string {
  return (args ?? [])
    .map((a) => (a.body ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function evidenceToMarkdown(args: Array<{ evidence?: string }> | undefined): string {
  return (args ?? [])
    .map((a) => (a.evidence ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Match mergeDeliveryToMarkdown per-argument layout (+ Layer3 code structures). */
function interleavedSectionMarkdown(
  key: DeliverySegmentKey,
  locale: string,
  narrative: DeliveryArgumentTree,
  marked: DeliveryArgumentTree,
  breakthrough_core?: BreakthroughCore | null,
  scan?: PageScanCardStruct | null,
  gantt?: ThirtyDayGanttStruct | null,
  page_schema?: DeliveryPageData | null,
): string {
  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  const lead = deliveryEvidenceLeadLabel(locale);
  const pendingRe = deliveryEvidencePendingDetectRe();
  const pendingPlaceholder = deliveryEvidencePendingPlaceholder(locale);
  const bodyArgs = narrative[key] ?? [];
  const evArgs = marked[key] ?? [];
  const parts: string[] = [];
  if (page_schema) {
    parts.push(encodePageSchemaFence(page_schema));
  }
  if (scan && scan.items.length >= 2) {
    const scanMd = encodePageScanMarkdown(scan, locale);
    if (scanMd) parts.push(scanMd);
  }
  if (key === "thirty_day" && gantt && gantt.weeks.length >= 4) {
    const ganttMd = encodeThirtyDayGanttMarkdown(gantt, locale);
    if (ganttMd) parts.push(ganttMd);
  }
  const structureMd = buildSegmentStructureMarkdown(key, locale, breakthrough_core);
  if (structureMd) parts.push(structureMd);
  for (let i = 0; i < bodyArgs.length; i++) {
    const body = (bodyArgs[i]?.body ?? "").trim().replace(/\n{2,}/g, "\n");
    if (!body) continue;
    parts.push(body);
    if (isTransition) continue;
    // P6 金句 / 带走三样：仪式封印，不发依据槽、不报缺
    if (isSignalsCloseSealBodyIndex(key, bodyArgs.length, i)) continue;
    const evRaw = (evArgs[i]?.evidence ?? evArgs[i]?.body ?? "")
      .trim()
      .replace(/\s*\n+\s*/g, " ");
    const pending = !evRaw || pendingRe.test(evRaw);
    if (pending) {
      console.error("[delivery/interleave] content evidence missing", { key, index: i });
    }
    const ev = pending ? pendingPlaceholder : evRaw;
    parts.push(`${lead}\n${ev}`);
  }
  return parts.join("\n\n");
}

function buildReady(
  key: DeliverySegmentKey,
  locale: string,
  narrative: DeliveryArgumentTree,
  marked: DeliveryArgumentTree,
  breakthrough_core?: BreakthroughCore | null,
  scan?: PageScanCardStruct | null,
  gantt?: ThirtyDayGanttStruct | null,
  page_schema?: DeliveryPageData | null,
): DeliverySegmentReady {
  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  return {
    key,
    heading: sectionHeading(key, locale),
    body_markdown: bodiesToMarkdown(narrative[key]),
    evidence_markdown: isTransition ? "" : evidenceToMarkdown(marked[key]),
    interleaved_markdown: interleavedSectionMarkdown(
      key,
      locale,
      narrative,
      marked,
      breakthrough_core,
      scan,
      gantt,
      page_schema,
    ),
    page_schema: page_schema ?? undefined,
    evidence_ready: !isTransition,
    locale,
  };
}

/**
 * Advance one segment chain as far as soft-wall allows.
 * `shouldYield(phase)` returns true when the invoke must hop before that phase.
 */
export async function advanceSegmentChain(input: {
  task: DeliveryTask;
  finalize: DeliveryComputed;
  locale: string;
  original_question?: string | null;
  session_id?: string;
  signal?: AbortSignal;
  progress: SegmentChainProgress | null;
  /** Return true when invoke budget is too tight to start the given phase. */
  shouldYield: (phase: SegmentChainPhase) => boolean;
  invokeHardDeadlineMs: number;
  invocationStartedAt: number;
  breakthrough_core?: BreakthroughCore | null;
  /** Wave C+: Action Extractor brief (code-only). */
  action_brief?: P5ActionBrief | null;
  week_summary?: P5WeekSummary | null;
  primary_backup_hint?: string;
  dashboard_score_hints?: string;
  /** P4: question + desired outcome (not dual-track). */
  question_expectation?: string;
  /** P4: local pack / retune / multi-dim dump. */
  eastern_calc_slice?: string;
  /** P4 moat: ready P3 body excerpt for anti-echo. */
  p3_body_excerpt?: string;
  /** P5: risk-polarity local calc dump. */
  risk_calc_slice?: string;
  /** Per-page must_use slice (P1/P2/P3/P6 — P4/P5 use eastern/risk slices). */
  page_plan_slice?: string;
  /** Collecting hard facts for all page fills. */
  reality_constraints?: string;
  /** P2: numbered surface candidates for why_cards (quality-first feed). */
  foundation_surface_feed?: string;
  /** P3: angle/means candidate menu (quality-first feed). */
  science_means_feed?: string;
  /** P4: moat means candidate menu (quality-first feed). */
  metaphysics_moat_feed?: string;
  /** P5: fuse / RiskItem candidate menu (quality-first feed). */
  risk_fuse_feed?: string;
  /** P6: tonight/day7/identity candidate menu (quality-first feed). */
  close_ritual_feed?: string;
  /** Layer A: anchors from ready upstream pages (user prompt + soft sanitize). */
  prior_chart_anchors?: readonly string[];
  category_token_sets?: import("./page-schema/anchor-category-tally").CategoryTokenSets | null;
  /** Full structured inventory text for fill (complements sliced multi_dim). */
  structured_inventory?: string;
}): Promise<SegmentChainRunResult> {
  const key = input.task.paths[0];
  if (!key) {
    return {
      ok: false,
      reason: "segment_missing_key",
      tokens_used: 0,
      progress: { key: "direct_answer", phase: "start", tokens_used: 0 },
    };
  }

  let progress: SegmentChainProgress = input.progress ?? {
    key,
    phase: "start",
    tokens_used: 0,
  };
  if (progress.key !== key) {
    progress = { key, phase: "start", tokens_used: 0 };
  }

  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);

  const phaseTimeout = (ceilingMs: number) =>
    segmentPhaseTimeoutMs(ceilingMs, input.invokeHardDeadlineMs, input.invocationStartedAt);

  // --- Batch 3: start → deep evidence → evidence_done ---
  const buildDeepInput = () => {
    const seg = input.finalize[key];
    return {
      key,
      locale: input.locale,
      core_conclusion: seg?.core_conclusion ?? "",
      bazi_basis: seg?.bazi_basis,
      session_id: input.session_id,
      signal: input.signal,
      timeout_ms: phaseTimeout(PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS),
      page_plan_slice: input.page_plan_slice,
      eastern_calc_slice: input.eastern_calc_slice,
      risk_calc_slice: input.risk_calc_slice,
      question_expectation: input.question_expectation,
      primary_backup_hint: input.primary_backup_hint,
      reality_constraints: input.reality_constraints,
      foundation_surface_feed: input.foundation_surface_feed,
      science_means_feed: input.science_means_feed,
      metaphysics_moat_feed: input.metaphysics_moat_feed,
      risk_fuse_feed: input.risk_fuse_feed,
      close_ritual_feed: input.close_ritual_feed,
      structured_inventory: input.structured_inventory,
      prior_chart_anchors: input.prior_chart_anchors,
      category_token_sets: input.category_token_sets,
      action_brief_block: input.action_brief
        ? formatP5ActionBriefForPrompt(input.action_brief)
        : undefined,
    };
  };

  // --- start → assign checkpoint → deep_assigned | evidence_done (transition) ---
  if (progress.phase === "start") {
    if (input.shouldYield("start")) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }

    if (isTransition) {
      progress = {
        ...progress,
        phase: "evidence_done",
        evidence: {},
      };
    } else if (progress.deep_evidence_assignment) {
      progress = { ...progress, phase: "deep_assigned" };
    } else {
      if (phaseBudgetExhausted(progress, "start")) {
        return {
          ok: false,
          reason: `phase_budget_exhausted:${key}:start:attempts=${phaseLlmAttempts(progress, "start")}`,
          tokens_used: progress.tokens_used,
          progress,
        };
      }
      progress = withPhaseLlmAttempt(progress, "start");
      const deepInput = buildDeepInput();
      const assignTimeout = Math.min(
        deepInput.timeout_ms ?? PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
        PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
      );
      const promptOpts: DeepEvidencePromptOpts = {
        locale: deepInput.locale,
        core_conclusion: deepInput.core_conclusion,
        bazi_basis: deepInput.bazi_basis,
        page_plan_slice: deepInput.page_plan_slice,
        eastern_calc_slice: deepInput.eastern_calc_slice,
        risk_calc_slice: deepInput.risk_calc_slice,
        question_expectation: deepInput.question_expectation,
        primary_backup_hint: deepInput.primary_backup_hint,
        reality_constraints: deepInput.reality_constraints,
        foundation_surface_feed: deepInput.foundation_surface_feed,
        science_means_feed: deepInput.science_means_feed,
        metaphysics_moat_feed: deepInput.metaphysics_moat_feed,
        risk_fuse_feed: deepInput.risk_fuse_feed,
        close_ritual_feed: deepInput.close_ritual_feed,
        structured_inventory: deepInput.structured_inventory,
        prior_chart_anchors: deepInput.prior_chart_anchors,
        category_token_sets: deepInput.category_token_sets,
        action_brief_block: deepInput.action_brief_block,
      };
      const assigned = await runDeepEvidenceAssignCall({
        key,
        opts: promptOpts,
        session_id: input.session_id,
        signal: input.signal,
        timeout_ms: assignTimeout,
      });
      if (!assigned.ok) {
        const deep = await runDeepEvidenceCall(deepInput);
        const spent = assigned.tokens_used + deep.tokens_used;
        if (!deep.ok) {
          const priorYields = progress.fill_yield_count ?? 0;
          if (
            isDeliverySoftWallRetryableFail(deep.reason) &&
            input.shouldYield("start") &&
            priorYields < FILL_YIELD_BEFORE_NARRATIVE
          ) {
            return {
              ok: true,
              done: false,
              progress: {
                ...progress,
                fill_yield_count: priorYields + 1,
                tokens_used: progress.tokens_used + spent,
              },
              tokens_used: progress.tokens_used + spent,
              yield_for_soft_wall: true,
            };
          }
          // No full_fill / thinking-off degrade — fail visibly for Continue.
          return {
            ok: false,
            reason: deep.reason,
            tokens_used: progress.tokens_used + spent,
            progress: {
              ...progress,
              tokens_used: progress.tokens_used + spent,
            },
          };
        }
        progress = {
          ...progress,
          phase: "evidence_done",
          deep_evidence_plan: deep.plan,
          fill_yield_count: 0,
          tokens_used: progress.tokens_used + spent,
        };
      } else {
        progress = {
          ...progress,
          phase: "deep_assigned",
          deep_evidence_assignment: assigned.assignment,
          tokens_used: progress.tokens_used + assigned.tokens_used,
        };
        console.info("[delivery/segment] deep assign checkpointed", {
          key,
          units: assigned.assignment.units.length,
        });
        if (input.shouldYield("deep_assigned")) {
          return {
            ok: true,
            done: false,
            progress,
            tokens_used: progress.tokens_used,
            yield_for_soft_wall: true,
          };
        }
      }
    }
  }

  // --- deep_assigned → write / deferred rewrite → evidence_done ---
  if (progress.phase === "deep_assigned") {
    if (input.shouldYield("deep_assigned")) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }
    const assignment = progress.deep_evidence_assignment;
    if (!assignment) {
      progress = { ...progress, phase: "start", deep_rewrite_reason: undefined };
    } else {
      if (phaseBudgetExhausted(progress, "deep_assigned")) {
        return {
          ok: false,
          reason: `phase_budget_exhausted:${key}:deep_assigned:attempts=${phaseLlmAttempts(progress, "deep_assigned")}`,
          tokens_used: progress.tokens_used,
          progress,
        };
      }
      progress = withPhaseLlmAttempt(progress, "deep_assigned");
      const deepInput = buildDeepInput();
      const written = await runDeepEvidenceWritesFromAssignment(deepInput, assignment, {
        rewrite_reason: progress.deep_rewrite_reason,
        defer_rewrite: !progress.deep_rewrite_reason,
      });
      if ("needs_rewrite" in written && written.needs_rewrite) {
        console.warn("[delivery/segment] deep write quality — soft-wall for rewrite hop", {
          key,
          reason: written.rewrite_reason,
        });
        return {
          ok: true,
          done: false,
          progress: {
            ...progress,
            deep_evidence_assignment: written.assignment,
            deep_rewrite_reason: written.rewrite_reason,
            tokens_used: progress.tokens_used + written.tokens_used,
          },
          tokens_used: progress.tokens_used + written.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      if (!written.ok) {
        const priorYields = progress.fill_yield_count ?? 0;
        // Soft-wall for clock/abort/timeout — prefer fresh /continue over mid-stream kill.
        // Even if admit window still looks open, llm_timeout means this invoke cannot finish STOP.
        if (
          isDeliverySoftWallRetryableFail(written.reason) &&
          priorYields < FILL_YIELD_BEFORE_NARRATIVE &&
          (input.shouldYield("deep_assigned") ||
            /llm_timeout|abort|insufficient_budget/i.test(written.reason))
        ) {
          return {
            ok: true,
            done: false,
            progress: {
              ...progress,
              fill_yield_count: priorYields + 1,
              tokens_used: progress.tokens_used + written.tokens_used,
            },
            tokens_used: progress.tokens_used + written.tokens_used,
            yield_for_soft_wall: true,
          };
        }
        // No full_fill / thinking-off degrade — fail visibly for Continue.
        return {
          ok: false,
          reason: written.reason,
          tokens_used: progress.tokens_used + written.tokens_used,
          progress: {
            ...progress,
            deep_rewrite_reason: undefined,
            tokens_used: progress.tokens_used + written.tokens_used,
          },
        };
      } else if ("plan" in written) {
        progress = {
          ...progress,
          phase: "evidence_done",
          deep_evidence_plan: written.plan,
          deep_rewrite_reason: undefined,
          fill_yield_count: 0,
          tokens_used: progress.tokens_used + written.tokens_used,
        };
      }
    }
  }

  // Legacy migrate: old checkpoints stopped at narrative_done before evidence existed.
  if (
    progress.phase === "narrative_done" &&
    !isTransition &&
    !(progress.evidence?.[key]?.some((a) => (a.evidence ?? "").trim())) &&
    !progress.deep_evidence_plan &&
    (progress.page_schema || progress.narrative)
  ) {
    console.info("[delivery/segment] legacy checkpoint: narrative_done without evidence — runEvidenceTask", {
      key,
    });
    if (input.shouldYield("narrative_done")) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }
    const ev = await runEvidenceTask(
      input.task,
      input.finalize,
      progress.narrative ?? {},
      input.session_id,
      input.signal,
      phaseTimeout(DELIVERY_MARK_TIMEOUT_MS),
    );
    if (!ev.ok) {
      return {
        ok: false,
        reason: `evidence:${ev.reason}`,
        tokens_used: progress.tokens_used + ev.tokens_used,
        progress,
      };
    }
    progress = {
      ...progress,
      evidence: ev.value,
      tokens_used: progress.tokens_used + ev.tokens_used,
    };
    // stay narrative_done → mark below
  }

  // Legacy migrate: old evidence_done meant "ready for mark" (fill already done).
  if (
    progress.phase === "evidence_done" &&
    (progress.page_schema || progress.narrative) &&
    progress.evidence &&
    !progress.deep_evidence_plan
  ) {
    console.info("[delivery/segment] legacy checkpoint: evidence_done with narrative — skip to mark", {
      key,
    });
    progress = { ...progress, phase: "narrative_done" };
  }

  // --- evidence_done → narrative compress fill → narrative_done ---
  if (progress.phase === "evidence_done") {
    if (input.shouldYield("evidence_done")) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }
    // Heavy pages: align fill client abort with admit window (was 120s → starved high thinking).
    if (phaseBudgetExhausted(progress, "evidence_done")) {
      return {
        ok: false,
        reason: `phase_budget_exhausted:${key}:evidence_done:attempts=${phaseLlmAttempts(progress, "evidence_done")}`,
        tokens_used: progress.tokens_used,
        progress,
      };
    }
    progress = withPhaseLlmAttempt(progress, "evidence_done");
    const fillCeilingMs = SEGMENT_HEAVY_FILL_KEYS.has(key)
      ? SEGMENT_HEAVY_MIN_INVOKE_MS
      : 120_000;
    const fillTimeoutMs = phaseTimeout(fillCeilingMs);
    const hasPlan = Boolean(progress.deep_evidence_plan) && !isTransition;
    const filled = await runPageSchemaFill({
      key,
      finalize: input.finalize,
      locale: input.locale,
      session_id: input.session_id,
      signal: input.signal,
      timeout_ms: fillTimeoutMs,
      thinking_effort: segmentFillThinkingEffort(key),
      action_brief: input.action_brief,
      week_summary: input.week_summary,
      primary_backup_hint: input.primary_backup_hint,
      dashboard_score_hints: input.dashboard_score_hints,
      question_expectation: input.question_expectation,
      eastern_calc_slice: input.eastern_calc_slice,
      p3_body_excerpt: input.p3_body_excerpt,
      risk_calc_slice: input.risk_calc_slice,
      page_plan_slice: input.page_plan_slice,
      reality_constraints: input.reality_constraints,
      foundation_surface_feed: input.foundation_surface_feed,
      science_means_feed: input.science_means_feed,
      metaphysics_moat_feed: input.metaphysics_moat_feed,
      risk_fuse_feed: input.risk_fuse_feed,
      close_ritual_feed: input.close_ritual_feed,
      prior_chart_anchors: input.prior_chart_anchors,
      category_token_sets: input.category_token_sets,
      structured_inventory: input.structured_inventory,
      fill_mode: hasPlan ? "compress" : "full",
      deep_evidence_plan: progress.deep_evidence_plan ?? null,
    });
    if (!filled.ok) {
      const priorYields = progress.fill_yield_count ?? 0;
      const remainingMs =
        input.invokeHardDeadlineMs - (Date.now() - input.invocationStartedAt);
      // Soft-wall only for clock/abort. Sanitize/quality already used fill's inner 1+1 —
      // do not soft-yield into another nested fill budget (that was the 2×3 thrash).
      if (
        isDeliverySoftWallRetryableFail(filled.reason) &&
        input.shouldYield("evidence_done") &&
        priorYields < FILL_YIELD_BEFORE_NARRATIVE
      ) {
        const nextYield = priorYields + 1;
        console.warn("[delivery/segment] page_schema fill clock-fail — yield before refuse", {
          key,
          reason: filled.reason,
          fill_yield_count: nextYield,
          timeout_ms: fillTimeoutMs,
          remaining_ms: remainingMs,
        });
        return {
          ok: true,
          done: false,
          progress: {
            ...progress,
            fill_yield_count: nextYield,
            tokens_used: progress.tokens_used + filled.tokens_used,
          },
          tokens_used: progress.tokens_used + filled.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      // Slim Pipeline: never ship narrative/scan prose as a delivery page.
      // Fail visibly so transport fuse / user Continue can decide — not degrade.
      console.error("[delivery/segment] refuse narrative fallback (page_schema required)", {
        key,
        reason: filled.reason,
        fill_yield_count: priorYields,
        forced_after_yields: priorYields >= FILL_YIELD_BEFORE_NARRATIVE,
        timeout_ms: fillTimeoutMs,
        remaining_ms: remainingMs,
      });
      return {
        ok: false,
        reason: `page_schema:${filled.reason}|refuse_narrative_fallback`,
        tokens_used: progress.tokens_used + filled.tokens_used,
        progress: {
          ...progress,
          tokens_used: progress.tokens_used + filled.tokens_used,
        },
      };
    } else {
      let page = filled.page;
      let evidenceTree: DeliveryArgumentTree = progress.evidence ?? {};
      if (progress.deep_evidence_plan) {
        const aligned = alignDeepEvidenceToPage(key, page, progress.deep_evidence_plan);
        page = aligned.page;
        evidenceTree = evidenceTreeFromAligned(key, aligned.evidenceByBodyIndex);
        const coverage = countEvidenceCoverage(
          pageSchemaToArgumentTree(key, page),
          evidenceTree,
          key,
        );
        if (coverage.missingIndexes.length > 0) {
          console.warn("[delivery/deep-evidence] coverage gaps after align", {
            key,
            missingIndexes: coverage.missingIndexes,
          });
        }
      }
      const tree = pageSchemaToArgumentTree(key, page);
      progress = {
        ...progress,
        phase: "narrative_done",
        narrative: tree,
        page_schema: page,
        evidence: evidenceTree,
        scan: null,
        gantt: null,
        fill_yield_count: 0,
        tokens_used: progress.tokens_used + filled.tokens_used,
      };
    }
  }

  // --- narrative_done → mark (Batch 3; was evidence_done → mark) ---
  if (progress.phase === "narrative_done") {
    // If still no evidence (fallback narrative without plan), run classic evidence once.
    if (
      !isTransition &&
      !(progress.evidence?.[key]?.some((a) => (a.evidence ?? "").trim()))
    ) {
      if (input.shouldYield("narrative_done")) {
        return {
          ok: true,
          done: false,
          progress,
          tokens_used: progress.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      const ev = await runEvidenceTask(
        input.task,
        input.finalize,
        progress.narrative ?? {},
        input.session_id,
        input.signal,
        phaseTimeout(DELIVERY_MARK_TIMEOUT_MS),
      );
      if (!ev.ok) {
        return {
          ok: false,
          reason: `evidence:${ev.reason}`,
          tokens_used: progress.tokens_used + ev.tokens_used,
          progress,
        };
      }
      const coverage = countEvidenceCoverage(
        progress.narrative ?? {},
        ev.value,
        key,
      );
      if (coverage.missingIndexes.length > 0) {
        return {
          ok: false,
          reason: `evidence_coverage:${key}:missing=${coverage.missingIndexes.join(",")}`,
          tokens_used: progress.tokens_used + ev.tokens_used,
          progress,
        };
      }
      progress = {
        ...progress,
        evidence: ev.value,
        tokens_used: progress.tokens_used + ev.tokens_used,
      };
    }

    if (isTransition) {
      progress = {
        ...progress,
        phase: "mark_done",
        marked: {},
      };
    } else {
      if (input.shouldYield("narrative_done")) {
        return {
          ok: true,
          done: false,
          progress,
          tokens_used: progress.tokens_used,
          yield_for_soft_wall: true,
        };
      }
      if (phaseBudgetExhausted(progress, "narrative_done")) {
        return {
          ok: false,
          reason: `phase_budget_exhausted:${key}:narrative_done:attempts=${phaseLlmAttempts(progress, "narrative_done")}`,
          tokens_used: progress.tokens_used,
          progress,
        };
      }
      progress = withPhaseLlmAttempt(progress, "narrative_done");
      const mark = await runMarkDeliveryTask(
        input.task,
        progress.evidence ?? {},
        input.locale,
        {
          session_id: input.session_id,
          original_question: input.original_question,
          signal: input.signal,
          timeout_ms: phaseTimeout(DELIVERY_MARK_TIMEOUT_MS),
        },
      );
      if (!mark.ok) {
        return {
          ok: false,
          reason: `mark:${mark.reason}`,
          tokens_used: progress.tokens_used + mark.tokens_used,
          progress,
        };
      }
      const marked: DeliveryArgumentTree = {};
      for (const [k, args] of Object.entries(mark.value)) {
        marked[k as DeliverySegmentKey] = (args ?? []).map((a) => ({
          body: a.body,
          evidence: a.evidence
            ? (() => {
                try {
                  return encodeConnectiveEvidenceToTerms(a.evidence, input.locale);
                } catch {
                  return a.evidence;
                }
              })()
            : a.evidence,
        }));
      }
      progress = {
        ...progress,
        phase: "mark_done",
        marked,
        tokens_used: progress.tokens_used + mark.tokens_used,
      };
    }
  }

  // --- body translate (non-zh); evidence already locale-native from mark ---
  if (progress.phase === "mark_done") {
    // Dispatch fill tasks yield here so the dedicated `ready` worker owns
    // translate + shelf write. Must NOT gate on needsTranslate — zh P1 used to
    // fall through to phase=done in fill, then ready failed with ready_bad_phase:done
    // and interrupted the whole job (only P1 on shelf).
    if (input.shouldYield("mark_done")) {
      return {
        ok: true,
        done: false,
        progress,
        tokens_used: progress.tokens_used,
        yield_for_soft_wall: true,
      };
    }

    const needsTranslate = !input.locale.startsWith("zh");
    let narrative = progress.narrative ?? {};
    let marked = progress.marked ?? {};
    let scan = progress.scan ? localizePageScanCardLabels(progress.scan, "zh") : null;
    let gantt = progress.gantt ? localizeThirtyDayGanttLabels(progress.gantt, "zh") : null;
    if (needsTranslate) {
      const merged: DeliveryArgumentTree = {
        [key]: (narrative[key] ?? []).map((a, i) => ({
          body: a.body,
          evidence: marked[key]?.[i]?.evidence ?? a.evidence,
        })),
      };
      const tr = await translateDeliverySegments(merged, input.locale, {
        paths: [key],
        session_id: input.session_id,
        signal: input.signal,
      });
      narrative = {
        [key]: (tr.tree[key] ?? []).map((a) => ({ body: a.body })),
      };
      // Keep mark evidence as-is (locale connective). Only bodies change.
      if (!isTransition) {
        marked = {
          [key]: (tr.tree[key] ?? []).map((a, i) => ({
            body: a.body,
            evidence: marked[key]?.[i]?.evidence ?? a.evidence,
          })),
        };
      }
      let scanTokens = 0;
      if (scan) {
        const scanTr = await translatePageScanCard(scan, input.locale, {
          session_id: input.session_id,
          signal: input.signal,
        });
        scan = scanTr.scan;
        scanTokens = scanTr.tokens_used;
      }
      let ganttTokens = 0;
      if (gantt) {
        const ganttTr = await translateThirtyDayGantt(gantt, input.locale, {
          session_id: input.session_id,
          signal: input.signal,
        });
        gantt = ganttTr.gantt;
        ganttTokens = ganttTr.tokens_used;
      }
      progress = {
        ...progress,
        narrative,
        marked,
        scan,
        gantt,
        tokens_used: progress.tokens_used + tr.tokens_used + scanTokens + ganttTokens,
      };
    } else {
      if (scan) scan = localizePageScanCardLabels(scan, input.locale);
      if (gantt) gantt = localizeThirtyDayGanttLabels(gantt, input.locale);
    }

    // Slim: no page_schema → do not mark segment ready (blocks scan/narrative garbage shelf).
    if (!progress.page_schema) {
      console.error("[delivery/segment] refuse ready without page_schema", {
        key,
        phase: progress.phase,
      });
      return {
        ok: false,
        reason: "missing_page_schema_refuse_ready",
        tokens_used: progress.tokens_used,
        progress,
      };
    }

    const ready = buildReady(
      key,
      input.locale,
      narrative,
      marked,
      input.breakthrough_core,
      scan,
      gantt,
      progress.page_schema,
    );
    progress = {
      ...progress,
      phase: "done",
      narrative,
      marked,
      scan,
      gantt,
      page_schema: progress.page_schema,
    };
    return {
      ok: true,
      done: true,
      progress,
      ready,
      tokens_used: progress.tokens_used,
    };
  }

  return {
    ok: false,
    reason: `unexpected_phase:${progress.phase}`,
    tokens_used: progress.tokens_used,
    progress,
  };
}
