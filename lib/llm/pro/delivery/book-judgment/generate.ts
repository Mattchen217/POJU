/**
 * BookJudgmentPack generate gun — prefer one-shot dual-track.
 * Degrade to two-shot (destiny then science, then merge) ONLY on true ~300s
 * Vercel wall / function maxDuration / explicit shot budget exhausted
 * (timeout / llm_timeout / AbortError-maxDuration).
 * Early StreamLake/OR 499 / zombie SSE / stream_stall / provider_abort → hard fail
 * (surface for Lab diagnose; do NOT auto-continue to two_destiny).
 * Quality / validate / coerce failures hard-fail the step — no gun split.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
  PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import {
  BOOK_JUDGMENT_SHOT_CONTINUE_RULE,
  deliveryLabTransportMaxAttempts,
  type BookJudgmentLabShotPhase,
} from "@/lib/llm/pro/delivery/lab/provider-call-budget";
import {
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { patternHitRefsForPrompt } from "@/lib/ziwei/soft-zfp-labels";
import { sanitizeZiweiLeaksInPromptText } from "@/lib/ziwei/sanitize-prompt-ziwei-leaks";
import { formatPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";
import { formatGlobalSegmentFeedDuties } from "@/lib/llm/pro/delivery/page-segment-feed-duties";
import { formatZiweiTraditionalClosedSetForEvidence } from "@/lib/ziwei/traditional-closed-set-for-evidence";
import { hashChartFactPackText, hashZiweiFactPack } from "./hash";
import {
  BOOK_FACE_IDS,
  BOOK_JUDGMENT_PACK_VERSION,
  indexBookJudgmentByFace,
  validateBookJudgmentPack,
  type BookJudgmentPack,
  type BookJudgmentSegmentId,
  type BookJudgmentShotMode,
  type BookJudgmentUnit,
} from "./schema";
import {
  buildBookJudgmentQuotaFromBlueprint,
  formatQuotaTableForPrompt,
} from "./quota-from-blueprint";

const PACK_SYSTEM = `你是交付报告「全书批断包」写手（BookJudgmentPack）。
只输出 JSON，不要 markdown。

## 主心骨（反推）
配额表从决策报告反推。只写表内需要的批断；不够条数=失败勿早停。
正文稍后只读切片；本枪禁手段处方、primary/backup、恐吓预测。

## 正写句模（先写对 · 决定分布）
- science：主语=机制/偏差/负荷；谓语=导致/维持/放大。
  正例：「完美主义替代外部反馈抬高切换成本」
  反例 timebox_block：「试点压成每周一个四小时块」← 禁
- destiny：命理判断/结构倾向 + 闭集锚。CFP+ZFP 共担同一断语（非八字模板贴紫微贴纸）。
  有紫微（zfpOmitted=false）且段职责含 ZFP：claim/anchors 须纳入本盘相关紫微传统真词（见依据层闭集）；无关则省略，禁整盘灌段。
  正例：「用神木受制于忌神火，开口窗口收窄；本题宫星四化同向收束」
  反例 billable_min：「以最小可收费承诺作为验证单元」← 禁
- convergence：双轨同向或张力交汇，禁止动作清单；可点名命理锚与科学机制的交汇张力（含相关紫微，勿硬塞）。
  正例：「岁运忌神与损失厌恶同向放大开口成本」
  反例 ops_checklist：「当三人付费时转为加大投入」← 禁

## Feed 用法（硬）
议程/用户手段语只可作背景事实一句（如「用户自述存在时段切分」）；
claim 必须改写成机制/判断句；禁止把时段块/可收费样/投入加减原样写入 claim。

## 配额与字段
- serves_face + serves_segment 对齐配额与「全书段级喂料职责」；claim 短闭集；anchors≥1
- 每脸双轨 + 密度见配额表；用到的格局记 pattern_hits_used（hit:id:level）；古典格名可与 hit 并存于 destiny claim（须 ∈ 本盘闭集）
- 段职责已正写为机制/偏差/负荷|命理判断|交汇张力|复盘问句；科学段勿硬塞紫微

## 闭集安全网（写入 claim → means_prescription FAIL + unitId@className）
imperative_yi · redlight_stop · stop_loss_ops · next_action · ops_checklist · timebox_block · billable_min · low_commit_sample

## 禁区
手段处方、攻守祈使、恐吓必损必成、primary/backup、无出处现编格局、顺推硬塞。`;

const JSON_SHAPE = `输出 JSON：
{
  "units": [
    {
      "id": "d01",
      "track": "destiny"|"science"|"convergence",
      "serves_face": ["02"],
      "serves_segment": "A"|"B"|"C"|"D"|"E",
      "claim": "短句",
      "anchors": ["机制句或 hit:id:level"],
      "caveat": "可选"
    }
  ],
  "pattern_hits_used": ["hit:<id>:<level>…"],
  "science_tags_used": ["机制词…"]
}`;

export type BookJudgmentGenerateOk = {
  ok: true;
  pack: BookJudgmentPack;
  tokens_used: number;
  shot_mode: BookJudgmentShotMode;
  last_raw_text?: string;
  call_trace: LabCallTrace;
  degraded_from_one?: boolean;
  degrade_reason?: string;
};

export type BookJudgmentGenerateFail = {
  ok: false;
  reason: string;
  /** validate detail（含 unit id / 类名）；机检 FAIL 必填 */
  detail?: string;
  /** 本枪已解析草案（可能未过闸）— 供 Lab 刷新 face_matrix，勿丢弃 */
  draft_pack?: BookJudgmentPack;
  tokens_used: number;
  last_raw_text?: string;
  call_trace?: LabCallTrace;
  shot_mode?: BookJudgmentShotMode;
};

/** Lab/macro: this hop fired one gun; client/production must re-POST for next shot. */
export type BookJudgmentGenerateContinue = {
  ok: false;
  continue: true;
  reason: typeof BOOK_JUDGMENT_SHOT_CONTINUE_RULE;
  next_shot_phase: Exclude<BookJudgmentLabShotPhase, "one">;
  tokens_used: number;
  shot_mode: BookJudgmentShotMode;
  degrade_meta?: {
    reason: string;
    detail?: string;
    means_classes?: string[];
  };
  destiny_units?: BookJudgmentUnit[];
  destiny_pattern_hits_used?: string[];
  destiny_science_tags_used?: string[];
  last_raw_text?: string;
  call_trace?: LabCallTrace;
  draft_pack?: BookJudgmentPack;
};

export type BookJudgmentGenerateResult =
  | BookJudgmentGenerateOk
  | BookJudgmentGenerateFail
  | BookJudgmentGenerateContinue;

export function isBookJudgmentGenerateContinue(
  r: BookJudgmentGenerateResult,
): r is BookJudgmentGenerateContinue {
  return (
    r.ok === false &&
    "continue" in r &&
    r.continue === true &&
    r.reason === BOOK_JUDGMENT_SHOT_CONTINUE_RULE
  );
}

type DegradeCarry = {
  degrade: true;
  reason: string;
  detail?: string;
  means_classes?: string[];
  draft_pack?: BookJudgmentPack;
  text?: string;
  trace?: LabCallTrace;
};

/**
 * Max lock (2026-11-01): one-shot → two-shot ONLY for true Vercel ~300s wall /
 * function maxDuration / explicit shot budget exhausted.
 * Quality / validate / coerce / schema / density / means_prescription → hard fail.
 * Early StreamLake/OR 499 / zombie SSE / 60s chunk stall → stream_stall (etc.) hard
 * fail — must NOT match here or Lab hides the cause via book_judgment_shot_continue.
 * `finish` kept for call-site compat; truncation (length/max_tokens) is NOT degrade.
 */
export function isBookJudgmentTimeoutDegradeReason(
  reason: string,
  _finish?: string | null,
): boolean {
  const r = (reason ?? "").toLowerCase().trim();
  // Provider mid-stream death / zombie body cancel — visible hard fail, not degrade.
  if (
    r.includes("stream_stall") ||
    r.includes("chunk_stall") ||
    r.includes("provider_abort") ||
    r === "cancelled" ||
    r === "canceled" ||
    r === "finish_cancelled" ||
    r === "finish_canceled"
  ) {
    return false;
  }
  return (
    r.includes("timeout") ||
    r.includes("timed out") ||
    r.includes("llm_timeout") ||
    r.includes("maxduration") ||
    r.includes("time budget") ||
    r.includes("time_budget") ||
    r.includes("deadline") ||
    r.includes("etimedout") ||
    // True client/parent abort near wall (AbortError / aborted due to maxDuration).
    // Intentionally NOT bare provider_abort (excluded above).
    r.includes("aborterror") ||
    r.includes("aborted due to maxduration") ||
    (r.includes("abort") && !r.includes("provider_abort"))
  );
}

/** @deprecated alias — prefer isBookJudgmentTimeoutDegradeReason */
function isDegradeReason(reason: string, finish: string | null): boolean {
  return isBookJudgmentTimeoutDegradeReason(reason, finish);
}

function patternHitsFromZiwei(ziwei: ZiweiFactPack | null | undefined): string[] {
  // Phase 10: never feed classical 格名 into judgment prompts — hit_id:level only.
  return patternHitRefsForPrompt(ziwei?.patternHits ?? []);
}

function coerceUnits(raw: unknown): BookJudgmentUnit[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.units)
    ? obj.units
    : Array.isArray(raw)
      ? raw
      : null;
  if (!list?.length) return null;
  const units: BookJudgmentUnit[] = [];
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u || typeof u !== "object") continue;
    const row = u as Record<string, unknown>;
    const track = String(row.track ?? "").trim();
    if (track !== "destiny" && track !== "science" && track !== "convergence") {
      continue;
    }
    const serves = Array.isArray(row.serves_face)
      ? row.serves_face
          .map((x) => String(x).trim())
          .filter((x) => (BOOK_FACE_IDS as readonly string[]).includes(x))
      : [];
    if (!serves.length) continue;
    const anchors = Array.isArray(row.anchors)
      ? row.anchors.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
      : [];
    const claim = String(row.claim ?? "").trim();
    if (!claim || !anchors.length) continue;
    const id = String(row.id ?? `${track}_${i + 1}`).trim().slice(0, 64) || `${track}_${i + 1}`;
    const caveat = String(row.caveat ?? "").trim();
    const segRaw = String(row.serves_segment ?? "").trim().toUpperCase();
    const serves_segment = (["A", "B", "C", "D", "E"] as const).includes(
      segRaw as BookJudgmentSegmentId,
    )
      ? (segRaw as BookJudgmentSegmentId)
      : undefined;
    units.push({
      id,
      track,
      serves_face: serves as BookJudgmentUnit["serves_face"],
      ...(serves_segment ? { serves_segment } : {}),
      claim: claim.slice(0, 400),
      anchors: anchors as [string, ...string[]],
      ...(caveat ? { caveat: caveat.slice(0, 240) } : {}),
    });
  }
  return units.length ? units : null;
}

function stringList(raw: unknown, key: string): string[] {
  if (!raw || typeof raw !== "object") return [];
  const v = (raw as Record<string, unknown>)[key];
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
}

function buildPackDraft(input: {
  locale: string;
  question_id?: string;
  thesis_ref?: string;
  chartText: string;
  ziwei: ZiweiFactPack | null;
  shot_mode: BookJudgmentShotMode;
  units: BookJudgmentUnit[];
  pattern_hits_used: string[];
  science_tags_used: string[];
}): BookJudgmentPack {
  const zfpOmitted = !input.ziwei || !(input.ziwei.patternHits?.length > 0);
  const hits = zfpOmitted
    ? []
    : input.pattern_hits_used.length
      ? input.pattern_hits_used
      : patternHitsFromZiwei(input.ziwei).slice(0, 12);
  return {
    version: BOOK_JUDGMENT_PACK_VERSION,
    locale: input.locale || "zh",
    ...(input.question_id ? { question_id: input.question_id } : {}),
    ...(input.thesis_ref ? { thesis_ref: input.thesis_ref } : {}),
    cfp_hash: hashChartFactPackText(input.chartText),
    zfp_hash: hashZiweiFactPack(input.ziwei),
    zfpOmitted,
    shot_mode: input.shot_mode,
    created_at: new Date().toISOString(),
    units: input.units,
    by_face: indexBookJudgmentByFace(input.units),
    pattern_hits_used: hits,
    science_tags_used: input.science_tags_used,
  };
}

async function callPackShot(input: {
  phase: string;
  system: string;
  user: string;
  user_feed: string;
  session_id?: string;
  timeout_ms?: number;
  dispatch_attempt?: number;
  /** Lab/macro: cap OpenRouter transport to 1 admit (no stacked main_delivery). */
  single_provider_call?: boolean;
  signal?: AbortSignal;
}): Promise<{
  ok: boolean;
  reason?: string;
  parsed?: unknown;
  text: string;
  tokens_used: number;
  finish: string | null;
  call_trace: LabCallTrace;
  result?: Awaited<ReturnType<typeof callLLM>>;
}> {
  const { deliveryDispatchProviderBody } = await import(
    "@/lib/llm/pro/delivery/dispatch/provider-escape"
  );
  const provider = deliveryDispatchProviderBody(
    Math.max(1, input.dispatch_attempt ?? 1),
  );
  try {
    const result = await callLLM({
      call_type: "main_delivery",
      system: input.system,
      messages: [{ role: "user", content: input.user }],
      max_tokens: PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS,
      thinking_effort: "high",
      timeout_ms:
        input.timeout_ms ??
        PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS ??
        DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      response_format: "json",
      session_id: input.session_id,
      temperature: 0.3,
      max_attempts: input.single_provider_call
        ? deliveryLabTransportMaxAttempts()
        : deliveryTransportMaxAttempts(),
      signal: input.signal,
      provider,
      phase_name: input.phase,
    });
    const finish = result.meta.finish_reason ?? null;
    const text = result.content?.trim() ?? "";
    const baseTrace = {
      phase: input.phase,
      system: input.system,
      user: input.user,
      user_feed: input.user_feed,
      result,
    };
    if (!text) {
      return {
        ok: false,
        reason: "empty_response",
        text,
        tokens_used: result.meta.tokens_used,
        finish,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
        result,
      };
    }
    if (scareRedlineSnippet(text)) {
      return {
        ok: false,
        reason: "scare_redline",
        text,
        tokens_used: result.meta.tokens_used,
        finish,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
        result,
      };
    }
    if (finish === "length" || finish === "max_tokens") {
      return {
        ok: false,
        reason: "truncated",
        text,
        tokens_used: result.meta.tokens_used,
        finish,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
        result,
      };
    }
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return {
        ok: false,
        reason: "json_parse",
        text,
        tokens_used: result.meta.tokens_used,
        finish,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
        result,
      };
    }
    return {
      ok: true,
      parsed,
      text,
      tokens_used: result.meta.tokens_used,
      finish,
      call_trace: buildLabCallTrace({
        ...baseTrace,
        raw_text: text,
        parsed,
      }),
      result,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_error";
    return {
      ok: false,
      reason: msg,
      text: "",
      tokens_used: 0,
      finish: null,
      call_trace: buildLabCallTrace({
        phase: input.phase,
        system: input.system,
        user: input.user,
        user_feed: input.user_feed,
        raw_text: null,
      }),
    };
  }
}

function mergeUnits(
  destiny: BookJudgmentUnit[],
  science: BookJudgmentUnit[],
): BookJudgmentUnit[] {
  const seen = new Set<string>();
  const out: BookJudgmentUnit[] = [];
  for (const u of [...destiny, ...science]) {
    let id = u.id;
    if (seen.has(id)) id = `${u.track}_${id}`;
    if (seen.has(id)) id = `${id}_${out.length + 1}`;
    seen.add(id);
    out.push({ ...u, id });
  }
  return out;
}

/**
 * Build the Judgment user feed string (one-shot / destiny / science).
 * Dual-layer: soft page slices stay vernacular/soft-ZFP; this judgment feed may include
 * a labeled Ziwei traditional closed-set (evidence layer) when zfpOmitted=false.
 * Free-text thesis/science/agenda/question remain scrubbed of uncontrolled Ziwei leaks.
 */
export function buildBookJudgmentFeedBlock(input: {
  chartText: string;
  ziwei: ZiweiFactPack | null;
  question?: string | null;
  agenda?: string | null;
  science_feed?: string | null;
  thesis_block?: string | null;
  mode: "all" | "destiny" | "science";
  locale?: string;
}): string {
  const locale = input.locale ?? "zh";
  // Field sources / allow-terms:
  // - thesis_block: ziwei diagnosis prose → full ziwei scrub (no bazi-homonym preserve)
  // - CFP chartText: bazi legal; not scrubbed by ziwei star lists
  // - science_feed / agenda / question: free text → ziwei scrub + preserve bazi homonyms
  //   (question must be scrubbed BEFORE formatPageSliceFeed — slice embeds user.Q)
  // - patternHits: hit_id:level only (from soft projection)
  const thesisSafe = input.thesis_block?.trim()
    ? sanitizeZiweiLeaksInPromptText(input.thesis_block.trim(), {
        ziwei: input.ziwei,
        locale,
      })
    : "";
  const scienceSafe = input.science_feed?.trim()
    ? sanitizeZiweiLeaksInPromptText(input.science_feed.trim().slice(0, 8_000), {
        ziwei: input.ziwei,
        locale,
        preserveBaziHomonyms: true,
      })
    : "";
  const agendaSafe = input.agenda?.trim()
    ? sanitizeZiweiLeaksInPromptText(input.agenda.trim().slice(0, 2_000), {
        ziwei: input.ziwei,
        locale,
        preserveBaziHomonyms: true,
      })
    : "";
  const questionSafe = input.question?.trim()
    ? sanitizeZiweiLeaksInPromptText(input.question.trim().slice(0, 1_200), {
        ziwei: input.ziwei,
        locale,
        preserveBaziHomonyms: true,
      })
    : "";

  const slice = formatPageSliceFeed({
    key: "02",
    chartText: input.chartText,
    ziwei: input.ziwei,
    question: questionSafe || null,
    locale,
    withAllowlistHeader: true,
  });
  const parts: string[] = [];
  if (input.mode !== "science" && thesisSafe) {
    parts.push(`## 命盘总纲\n${thesisSafe}`);
  }
  if (input.mode !== "science") {
    parts.push(slice ?? `## CFP\n${input.chartText.slice(0, 8_000)}`);
  } else if (slice) {
    parts.push(slice);
  }
  if (input.mode !== "destiny" && scienceSafe) {
    parts.push(`## 科学 / 现代证据 feed\n${scienceSafe}`);
  }
  if (agendaSafe) {
    parts.push(
      `## agenda / 议题（仅背景事实 · 禁把时段块/可收费样/投入加减原样写入 claim）\n${agendaSafe}`,
    );
  }
  if (questionSafe) {
    parts.push(`## 原问\n${questionSafe}`);
  }
  parts.push(
    `## Feed→claim 硬规则\n用户手段语可压缩为「用户自述存在…」一句背景；claim 必须改写成机制/判断句，禁止原样复述操作日程或验证单元。`,
  );
  const zfpOmitted = !input.ziwei || !(input.ziwei.patternHits?.length > 0);
  const hits = patternHitsFromZiwei(input.ziwei);
  if (input.mode !== "science") {
    parts.push(
      formatGlobalSegmentFeedDuties({
        zfpOmitted,
        locale,
      }),
    );
  }
  if (input.mode !== "science" && !zfpOmitted && input.ziwei) {
    const trad = formatZiweiTraditionalClosedSetForEvidence(input.ziwei, {
      locale,
    });
    if (trad) parts.push(trad);
  }
  if (hits.length) {
    parts.push(
      `## ZFP patternHits 稳定引用（hit_id:level · 用则入 pattern_hits_used；古典格名仅可写本盘闭集内且与段职责相关；不用则 unit.caveat）\n${hits.join("、")}`,
    );
  }
  parts.push(
    `## faces 必须覆盖\n${BOOK_FACE_IDS.join(", ")}`,
    JSON_SHAPE,
  );
  return parts.filter(Boolean).join("\n\n");
}

/** @deprecated internal alias — use buildBookJudgmentFeedBlock */
function feedBlock(
  input: Parameters<typeof buildBookJudgmentFeedBlock>[0],
): string {
  return buildBookJudgmentFeedBlock(input);
}

export async function runBookJudgmentPackGenerate(input: {
  locale: string;
  session_id?: string;
  timeout_ms?: number;
  dispatch_attempt?: number;
  signal?: AbortSignal;
  question_id?: string;
  thesis_ref?: string;
  chart_fact_pack: string;
  ziwei_fact_pack?: ZiweiFactPack | null;
  thesis_block?: string | null;
  question?: string | null;
  agenda?: string | null;
  science_feed?: string | null;
  /** Force two-shot without trying one. */
  force_two_shot?: boolean;
  /**
   * Lab/macro: at most one provider call this invocation.
   * Timeout-budget degrade / second gun returns `book_judgment_shot_continue`
   * for a fresh HTTP (quality fails do not continue).
   */
  single_provider_call?: boolean;
  /** Which gun to fire when single_provider_call (default one / force_two → two_destiny). */
  shot_phase?: BookJudgmentLabShotPhase;
  /** Carry from prior two_destiny continue hop. */
  prior_destiny_units?: BookJudgmentUnit[];
  prior_destiny_pattern_hits_used?: string[];
  prior_destiny_science_tags_used?: string[];
  degrade_meta?: {
    reason: string;
    detail?: string;
    means_classes?: string[];
  };
}): Promise<BookJudgmentGenerateResult> {
  const chartText = input.chart_fact_pack?.trim() ?? "";
  const ziwei = input.ziwei_fact_pack ?? null;
  const quota = buildBookJudgmentQuotaFromBlueprint();
  const quotaBlock = formatQuotaTableForPrompt(quota);
  let tokens_used = 0;
  const single = Boolean(input.single_provider_call);
  const shotPhase: BookJudgmentLabShotPhase =
    input.shot_phase ??
    (input.force_two_shot ? "two_destiny" : "one");

  const finishOneShot = async (): Promise<
    BookJudgmentGenerateOk | BookJudgmentGenerateFail | DegradeCarry
  > => {
    const user_feed = feedBlock({
      chartText,
      ziwei,
      locale: input.locale,
      question: input.question,
      agenda: input.agenda,
      science_feed: input.science_feed,
      thesis_block: input.thesis_block,
      mode: "all",
    });
    const user = [
      `## BookJudgmentPack · 一枪双轨 locale=${input.locale}`,
      `按配额表产出；total_min_units=${quota.total_min_units}；每脸 dual-track + serves_segment。`,
      quotaBlock,
      user_feed,
    ].join("\n\n");
    const shot = await callPackShot({
      phase: "book_judgment_pack_one",
      system: PACK_SYSTEM,
      user,
      user_feed,
      session_id: input.session_id,
      timeout_ms: input.timeout_ms,
      dispatch_attempt: input.dispatch_attempt,
      single_provider_call: single,
      signal: input.signal,
    });
    tokens_used += shot.tokens_used;
    if (!shot.ok) {
      if (shot.reason === "scare_redline") {
        return {
          ok: false,
          reason: "scare_redline",
          tokens_used,
          last_raw_text: shot.text.slice(0, 12_000),
          call_trace: shot.call_trace,
          shot_mode: "one",
        };
      }
      if (isDegradeReason(shot.reason ?? "", shot.finish)) {
        return { degrade: true, reason: shot.reason ?? "one_shot_fail", text: shot.text, trace: shot.call_trace };
      }
      return {
        ok: false,
        reason: shot.reason ?? "one_shot_fail",
        tokens_used,
        last_raw_text: shot.text.slice(0, 12_000),
        call_trace: shot.call_trace,
        shot_mode: "one",
      };
    }
    const units = coerceUnits(shot.parsed);
    if (!units) {
      // Quality/parse fail: hard fail — do NOT degrade to two-shot.
      return {
        ok: false,
        reason: "coerce_failed",
        tokens_used,
        last_raw_text: shot.text.slice(0, 12_000),
        call_trace: shot.call_trace,
        shot_mode: "one",
      };
    }
    const draft = buildPackDraft({
      locale: input.locale,
      question_id: input.question_id,
      thesis_ref: input.thesis_ref,
      chartText,
      ziwei,
      shot_mode: "one",
      units,
      pattern_hits_used: stringList(shot.parsed, "pattern_hits_used"),
      science_tags_used: stringList(shot.parsed, "science_tags_used"),
    });
    const validated = validateBookJudgmentPack(draft, quota);
    if (!validated.ok) {
      // Validate/quality fail: hard fail — never schedule two_destiny continue.
      return {
        ok: false,
        reason: validated.reason,
        detail: validated.detail,
        draft_pack: draft,
        tokens_used,
        last_raw_text: shot.text.slice(0, 12_000),
        call_trace: shot.call_trace,
        shot_mode: "one",
      };
    }
    return {
      ok: true,
      pack: validated.pack,
      tokens_used,
      shot_mode: "one",
      last_raw_text: shot.text.slice(0, 12_000),
      call_trace: shot.call_trace,
    };
  };

  const meansInjectFor = (
    degradeMeta?: {
      reason: string;
      detail?: string;
      means_classes?: string[];
    },
  ): string =>
    degradeMeta?.means_classes?.length
      ? [
          `## 一枪 means_prescription 失败类（二枪必须避开 · 改写成正写句模）`,
          `className=${degradeMeta.means_classes.join(" · ")}`,
          degradeMeta.detail ? `detail=${degradeMeta.detail}` : "",
          `正写：science=机制/偏差/负荷；destiny=命理判断；convergence=交汇张力。禁原样复述 feed 操作语。`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  /** Destiny gun only (one provider call). */
  const runDestinyShot = async (
    degradeMeta?: {
      reason: string;
      detail?: string;
      means_classes?: string[];
    },
  ): Promise<
    | {
        ok: true;
        units: BookJudgmentUnit[];
        pattern_hits_used: string[];
        science_tags_used: string[];
        text: string;
        call_trace?: LabCallTrace;
      }
    | BookJudgmentGenerateFail
  > => {
    const meansInject = meansInjectFor(degradeMeta);
    const destinyFeed = feedBlock({
      chartText,
      ziwei,
      locale: input.locale,
      question: input.question,
      agenda: input.agenda,
      thesis_block: input.thesis_block,
      mode: "destiny",
    });
    const destinyUser = [
      `## BookJudgmentPack · 两枪·destiny locale=${input.locale}`,
      `只产出 track=destiny（可少量 convergence）。覆盖配额表全部 faces/段。`,
      meansInject,
      quotaBlock,
      destinyFeed,
    ]
      .filter(Boolean)
      .join("\n\n");
    const dShot = await callPackShot({
      phase: "book_judgment_pack_destiny",
      system: PACK_SYSTEM,
      user: destinyUser,
      user_feed: destinyFeed,
      session_id: input.session_id,
      timeout_ms: input.timeout_ms,
      dispatch_attempt: input.dispatch_attempt,
      single_provider_call: single,
      signal: input.signal,
    });
    tokens_used += dShot.tokens_used;
    if (!dShot.ok) {
      return {
        ok: false,
        reason: dShot.reason ?? "destiny_shot_fail",
        tokens_used,
        last_raw_text: dShot.text.slice(0, 12_000),
        call_trace: dShot.call_trace,
        shot_mode: "two",
      };
    }
    const destinyUnits = (coerceUnits(dShot.parsed) ?? []).filter(
      (u) => u.track === "destiny" || u.track === "convergence",
    );
    if (!destinyUnits.length) {
      return {
        ok: false,
        reason: "destiny_coerce_failed",
        tokens_used,
        last_raw_text: dShot.text.slice(0, 12_000),
        call_trace: dShot.call_trace,
        shot_mode: "two",
      };
    }
    return {
      ok: true,
      units: destinyUnits,
      pattern_hits_used: stringList(dShot.parsed, "pattern_hits_used"),
      science_tags_used: stringList(dShot.parsed, "science_tags_used"),
      text: dShot.text,
      call_trace: dShot.call_trace,
    };
  };

  /** Science gun + merge (one provider call; destiny units must be carried in). */
  const runScienceShot = async (
    destinyUnits: BookJudgmentUnit[],
    destinyHits: { pattern_hits_used: string[]; science_tags_used: string[] },
    degradeMeta?: {
      reason: string;
      detail?: string;
      means_classes?: string[];
    },
  ): Promise<BookJudgmentGenerateOk | BookJudgmentGenerateFail> => {
    const meansInject = meansInjectFor(degradeMeta);
    const scienceFeed = feedBlock({
      chartText,
      ziwei,
      locale: input.locale,
      question: input.question,
      agenda: input.agenda,
      science_feed: input.science_feed,
      mode: "science",
    });
    const scienceUser = [
      `## BookJudgmentPack · 两枪·science locale=${input.locale}`,
      `只产出 track=science（可少量 convergence）。覆盖配额表；禁「科学维N」空壳。合并键 serves_face。`,
      meansInject,
      quotaBlock,
      scienceFeed,
    ]
      .filter(Boolean)
      .join("\n\n");
    const sShot = await callPackShot({
      phase: "book_judgment_pack_science",
      system: PACK_SYSTEM,
      user: scienceUser,
      user_feed: scienceFeed,
      session_id: input.session_id,
      timeout_ms: input.timeout_ms,
      dispatch_attempt: input.dispatch_attempt,
      single_provider_call: single,
      signal: input.signal,
    });
    tokens_used += sShot.tokens_used;
    if (!sShot.ok) {
      return {
        ok: false,
        reason: sShot.reason ?? "science_shot_fail",
        tokens_used,
        last_raw_text: sShot.text.slice(0, 12_000),
        call_trace: sShot.call_trace,
        shot_mode: "two",
      };
    }
    const scienceUnits = (coerceUnits(sShot.parsed) ?? []).filter(
      (u) => u.track === "science" || u.track === "convergence",
    );
    if (!scienceUnits.length) {
      return {
        ok: false,
        reason: "science_coerce_failed",
        tokens_used,
        last_raw_text: sShot.text.slice(0, 12_000),
        call_trace: sShot.call_trace,
        shot_mode: "two",
      };
    }

    const units = mergeUnits(destinyUnits, scienceUnits);
    const draft = buildPackDraft({
      locale: input.locale,
      question_id: input.question_id,
      thesis_ref: input.thesis_ref,
      chartText,
      ziwei,
      shot_mode: "two",
      units,
      pattern_hits_used: [
        ...destinyHits.pattern_hits_used,
        ...stringList(sShot.parsed, "pattern_hits_used"),
      ],
      science_tags_used: [
        ...destinyHits.science_tags_used,
        ...stringList(sShot.parsed, "science_tags_used"),
      ],
    });
    const validated = validateBookJudgmentPack(draft, quota);
    if (!validated.ok) {
      return {
        ok: false,
        reason: validated.reason,
        detail: validated.detail,
        draft_pack: draft,
        tokens_used,
        last_raw_text: sShot.text.slice(0, 12_000),
        call_trace: sShot.call_trace,
        shot_mode: "two",
      };
    }
    return {
      ok: true,
      pack: validated.pack,
      tokens_used,
      shot_mode: "two",
      last_raw_text: sShot.text.slice(0, 12_000),
      call_trace: sShot.call_trace,
      degraded_from_one: Boolean(degradeMeta),
      degrade_reason: degradeMeta?.reason,
    };
  };

  /** Legacy in-process two-shot (non-Lab only). Lab must use single_provider_call. */
  const finishTwoShotStacked = async (
    degradeMeta?: {
      reason: string;
      detail?: string;
      means_classes?: string[];
    },
  ): Promise<BookJudgmentGenerateOk | BookJudgmentGenerateFail> => {
    const destiny = await runDestinyShot(degradeMeta);
    if (!destiny.ok) return destiny;
    return runScienceShot(
      destiny.units,
      {
        pattern_hits_used: destiny.pattern_hits_used,
        science_tags_used: destiny.science_tags_used,
      },
      degradeMeta,
    );
  };

  const continueTo = (
    next: Exclude<BookJudgmentLabShotPhase, "one">,
    extra: Partial<BookJudgmentGenerateContinue> & {
      degrade_meta?: BookJudgmentGenerateContinue["degrade_meta"];
    },
  ): BookJudgmentGenerateContinue => ({
    ok: false,
    continue: true,
    reason: BOOK_JUDGMENT_SHOT_CONTINUE_RULE,
    next_shot_phase: next,
    tokens_used,
    shot_mode: next === "two_destiny" || next === "two_science" ? "two" : "one",
    ...extra,
  });

  // --- Lab/macro single-call phases ---
  if (single) {
    if (shotPhase === "two_science") {
      const units = input.prior_destiny_units ?? [];
      if (!units.length) {
        return {
          ok: false,
          reason: "missing_prior_destiny_units",
          tokens_used,
          shot_mode: "two",
        };
      }
      return runScienceShot(
        units,
        {
          pattern_hits_used: input.prior_destiny_pattern_hits_used ?? [],
          science_tags_used: input.prior_destiny_science_tags_used ?? [],
        },
        input.degrade_meta,
      );
    }

    if (shotPhase === "two_destiny" || input.force_two_shot) {
      const destiny = await runDestinyShot(
        input.degrade_meta ??
          (input.force_two_shot ? { reason: "force_two_shot" } : undefined),
      );
      if (!destiny.ok) return destiny;
      return continueTo("two_science", {
        degrade_meta:
          input.degrade_meta ??
          (input.force_two_shot ? { reason: "force_two_shot" } : undefined),
        destiny_units: destiny.units,
        destiny_pattern_hits_used: destiny.pattern_hits_used,
        destiny_science_tags_used: destiny.science_tags_used,
        last_raw_text: destiny.text.slice(0, 12_000),
        call_trace: destiny.call_trace,
      });
    }

    // shotPhase === "one"
    const one = await finishOneShot();
    if ("degrade" in one) {
      return continueTo("two_destiny", {
        degrade_meta: {
          reason: one.reason,
          detail: one.detail,
          means_classes: one.means_classes,
        },
        draft_pack: one.draft_pack,
        last_raw_text: one.text?.slice(0, 12_000),
        call_trace: one.trace,
        shot_mode: "one",
      });
    }
    return one;
  }

  // --- Legacy stacked path (scripts / non-Lab) ---
  if (input.force_two_shot) {
    return finishTwoShotStacked({ reason: "force_two_shot" });
  }

  const one = await finishOneShot();
  if ("degrade" in one) {
    return finishTwoShotStacked({
      reason: one.reason,
      detail: one.detail,
      means_classes: one.means_classes,
    });
  }
  return one;
}
