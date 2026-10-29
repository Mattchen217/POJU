/**
 * BookJudgmentPack generate gun — one-shot dual-track, degrade to two-shot.
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
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { formatPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";
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
配额表从决策报告各页各段反推。只写表内需要的批断；禁止无报告依据自由发挥；不够条数=失败勿早停。
正文稍后只读切片阐述，本枪禁止手段处方、禁止 primary/backup、禁止恐吓预测。

## units 规则
- track=destiny：命理机制；anchors 只许闭集（日主/用忌/大运、格局名、宫干星曜四化等来自喂料 CFP/ZFP）
- track=science：只写可验证机制/认知偏差/负荷结构；anchors 禁止纯「科学维N」标签壳
- track=convergence：交汇句，同时承命理+科学
- serves_face + serves_segment（A–E）对齐配额段槽
- claim 短闭集句；每条 anchors≥1
- 每脸双轨 + 密度下限见配额表（全书 ≥24 或表内 total_min_units）
- zfp patternHits：用则写入 pattern_hits_used；不用则在相关 unit 加 caveat 说明为何不用

## 全轨硬禁 · 可执行手段句（处方/停损操作留给后文落地页，不得进包枪）
科学轨只写机制/偏差/负荷；destiny/convergence 同禁行动处方与停损操作句。写入即机检 means_prescription FAIL。
- 禁「宜…」祈使（忌神/用神专名除外）
- 禁小时块/N小时完整块、周内交付、四周任务、试点摊开
- 禁低承诺小样/做一个…验证、可收费最小样、小成品、能直接使用
- 禁红灯信号→退回、停下并退回、近步原则/停在可逆、改节奏操作句
- 禁执行清单、今晚可、只给反馈不付费等落地核对句

## 禁区
手段处方、攻守祈使收束、恐吓必损必成、primary/backup 回流、无出处现编格局、顺推硬塞空壳。`;

const JSON_SHAPE = `输出 JSON：
{
  "units": [
    {
      "id": "d01",
      "track": "destiny"|"science"|"convergence",
      "serves_face": ["02"],
      "serves_segment": "A"|"B"|"C"|"D"|"E",
      "claim": "短句",
      "anchors": ["格局名或机制句"],
      "caveat": "可选"
    }
  ],
  "pattern_hits_used": ["格局名…"],
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
  tokens_used: number;
  last_raw_text?: string;
  call_trace?: LabCallTrace;
  shot_mode?: BookJudgmentShotMode;
};

function isDegradeReason(reason: string, finish: string | null): boolean {
  if (finish === "length" || finish === "max_tokens") return true;
  const r = reason.toLowerCase();
  return (
    r.includes("timeout") ||
    r.includes("timed out") ||
    r.includes("abort") ||
    r === "empty_response" ||
    r === "json_parse" ||
    r === "coerce_failed" ||
    r === "missing_destiny_track" ||
    r === "missing_science_track" ||
    r === "missing_pattern_hits" ||
    r === "empty_face" ||
    r === "face_missing_destiny" ||
    r === "face_missing_science" ||
    r === "face_under_density" ||
    r === "under_density" ||
    r === "segment_uncovered" ||
    r === "segment_track_mismatch" ||
    r === "weak_science_anchor" ||
    r === "schema" ||
    r === "truncated" ||
    r === "quality_drift"
  );
}

function patternHitsFromZiwei(ziwei: ZiweiFactPack | null | undefined): string[] {
  return (ziwei?.patternHits ?? []).map((h) => h.name).filter(Boolean);
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
      max_attempts: deliveryTransportMaxAttempts(),
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

function feedBlock(input: {
  chartText: string;
  ziwei: ZiweiFactPack | null;
  question?: string | null;
  agenda?: string | null;
  science_feed?: string | null;
  thesis_block?: string | null;
  mode: "all" | "destiny" | "science";
}): string {
  const slice = formatPageSliceFeed({
    key: "02",
    chartText: input.chartText,
    ziwei: input.ziwei,
    question: input.question,
    withAllowlistHeader: true,
  });
  const parts: string[] = [];
  if (input.mode !== "science" && input.thesis_block?.trim()) {
    parts.push(`## 命盘总纲\n${input.thesis_block.trim()}`);
  }
  if (input.mode !== "science") {
    parts.push(slice ?? `## CFP\n${input.chartText.slice(0, 8_000)}`);
  } else if (slice) {
    parts.push(slice);
  }
  if (input.mode !== "destiny" && input.science_feed?.trim()) {
    parts.push(`## 科学 / 现代证据 feed\n${input.science_feed.trim().slice(0, 8_000)}`);
  }
  if (input.agenda?.trim()) {
    parts.push(`## agenda / 议题\n${input.agenda.trim().slice(0, 2_000)}`);
  }
  if (input.question?.trim()) {
    parts.push(`## 原问\n${input.question.trim().slice(0, 1_200)}`);
  }
  const hits = patternHitsFromZiwei(input.ziwei);
  if (hits.length) {
    parts.push(
      `## ZFP patternHits 全量（用则入 pattern_hits_used；不用则 unit.caveat）\n${hits.join("、")}`,
    );
  }
  parts.push(
    `## faces 必须覆盖\n${BOOK_FACE_IDS.join(", ")}`,
    JSON_SHAPE,
  );
  return parts.filter(Boolean).join("\n\n");
}

export async function runBookJudgmentPackGenerate(input: {
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  dispatch_attempt?: number;
  /** Force two-shot without trying one. */
  force_two_shot?: boolean;
  question_id?: string;
  thesis_ref?: string;
  chart_fact_pack: string;
  ziwei_fact_pack?: ZiweiFactPack | null;
  thesis_block?: string | null;
  question?: string | null;
  agenda?: string | null;
  science_feed?: string | null;
}): Promise<BookJudgmentGenerateOk | BookJudgmentGenerateFail> {
  const chartText = input.chart_fact_pack?.trim() ?? "";
  const ziwei = input.ziwei_fact_pack ?? null;
  const quota = buildBookJudgmentQuotaFromBlueprint();
  const quotaBlock = formatQuotaTableForPrompt(quota);
  let tokens_used = 0;

  const finishOneShot = async (): Promise<
    BookJudgmentGenerateOk | BookJudgmentGenerateFail | { degrade: true; reason: string; text?: string; trace?: LabCallTrace }
  > => {
    const user_feed = feedBlock({
      chartText,
      ziwei,
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
      return { degrade: true, reason: "coerce_failed", text: shot.text, trace: shot.call_trace };
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
      if (isDegradeReason(validated.reason, shot.finish)) {
        return {
          degrade: true,
          reason: validated.reason,
          text: shot.text,
          trace: shot.call_trace,
        };
      }
      return {
        ok: false,
        reason: validated.reason,
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

  const finishTwoShot = async (
    degradeMeta?: { reason: string },
  ): Promise<BookJudgmentGenerateOk | BookJudgmentGenerateFail> => {
    const destinyFeed = feedBlock({
      chartText,
      ziwei,
      question: input.question,
      agenda: input.agenda,
      thesis_block: input.thesis_block,
      mode: "destiny",
    });
    const destinyUser = [
      `## BookJudgmentPack · 两枪·destiny locale=${input.locale}`,
      `只产出 track=destiny（可少量 convergence）。覆盖配额表全部 faces/段。`,
      quotaBlock,
      destinyFeed,
    ].join("\n\n");
    const dShot = await callPackShot({
      phase: "book_judgment_pack_destiny",
      system: PACK_SYSTEM,
      user: destinyUser,
      user_feed: destinyFeed,
      session_id: input.session_id,
      timeout_ms: input.timeout_ms,
      dispatch_attempt: input.dispatch_attempt,
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

    const scienceFeed = feedBlock({
      chartText,
      ziwei,
      question: input.question,
      agenda: input.agenda,
      science_feed: input.science_feed,
      mode: "science",
    });
    const scienceUser = [
      `## BookJudgmentPack · 两枪·science locale=${input.locale}`,
      `只产出 track=science（可少量 convergence）。覆盖配额表；禁「科学维N」空壳。合并键 serves_face。`,
      quotaBlock,
      scienceFeed,
    ].join("\n\n");
    const sShot = await callPackShot({
      phase: "book_judgment_pack_science",
      system: PACK_SYSTEM,
      user: scienceUser,
      user_feed: scienceFeed,
      session_id: input.session_id,
      timeout_ms: input.timeout_ms,
      dispatch_attempt: input.dispatch_attempt,
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
        ...stringList(dShot.parsed, "pattern_hits_used"),
        ...stringList(sShot.parsed, "pattern_hits_used"),
      ],
      science_tags_used: [
        ...stringList(dShot.parsed, "science_tags_used"),
        ...stringList(sShot.parsed, "science_tags_used"),
      ],
    });
    const validated = validateBookJudgmentPack(draft, quota);
    if (!validated.ok) {
      return {
        ok: false,
        reason: validated.reason,
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

  if (input.force_two_shot) {
    return finishTwoShot({ reason: "force_two_shot" });
  }

  const one = await finishOneShot();
  if ("degrade" in one) {
    return finishTwoShot({ reason: one.reason });
  }
  return one;
}
