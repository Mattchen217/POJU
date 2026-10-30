/**
 * Body must consume BookJudgmentPack face slice (all tracks → claims/evidence).
 * Ban restating the question/agenda as the visible recommendation.
 * Explanation faces: ban means_prescription (same closed set as pack), incl. convergence.
 */

import type { BookJudgmentTrack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import { classifyMeansPrescription } from "@/lib/llm/pro/delivery/book-judgment/schema";
import { FACE_SEGMENT_FIELDS } from "@/lib/llm/pro/delivery/page-schema/face-types";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";

export const BOOK_BODY_PACK_UNIT_MISS_RULE = "gate_body_pack_unit_miss";
export const BOOK_BODY_PACK_TRACK_DROP_RULE = "gate_body_pack_track_drop";
export const BOOK_BODY_QUESTION_RESTATE_RULE = "gate_body_question_restate";
export const BOOK_BODY_MEANS_PRESCRIPTION_RULE = "gate_body_means_prescription";

/** Faces whose visible prose is explanation — not path/ops pages (05/06/08). */
const BODY_MEANS_SCAN_FIELDS: Partial<
  Record<DecisionPageId, readonly string[]>
> = {
  "02": ["destiny_reason", "science_mechanism", "convergence"],
  "04": ["bottleneck_name", "manifestation", "if_force_through", "evidence_fold"],
  "07": ["field_judgment", "relation_interaction", "evidence_fold"],
};

function asFaceId(key: string): DecisionPageId | null {
  return (DECISION_PAGE_IDS as readonly string[]).includes(key)
    ? (key as DecisionPageId)
    : null;
}

function normalizeProse(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\u3000，。、「」『』：:；;！!？?…·\-—_/\\|"'`~（）()【】\[\]{}<>]/g, "");
}

function faceVisibleBlob(faceId: DecisionPageId, page: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const { key } of FACE_SEGMENT_FIELDS[faceId]) {
    const v = page[key];
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) {
      for (const row of v) {
        if (typeof row === "string") parts.push(row);
        else if (row && typeof row === "object") {
          parts.push(JSON.stringify(row));
        }
      }
    }
  }
  parts.push(String(page.page_title ?? ""), String(page.page_subtitle ?? ""));
  return parts.join("\n");
}

/** Evidence / pointer fields that must cite unit ids. */
function evidenceBlob(faceId: DecisionPageId, page: Record<string, unknown>): string {
  switch (faceId) {
    case "01":
      return String(page.evidence_pointer ?? "");
    case "02":
      return [
        String(page.destiny_reason ?? ""),
        String(page.science_mechanism ?? ""),
        String(page.convergence ?? ""),
        ...(Array.isArray(page.verifiable_anchors)
          ? page.verifiable_anchors.map((x) => String(x ?? ""))
          : []),
      ].join("\n");
    case "04":
    case "07":
      return String(page.evidence_fold ?? "");
    default:
      return faceVisibleBlob(faceId, page);
  }
}

function claimBlob(faceId: DecisionPageId, page: Record<string, unknown>): string {
  switch (faceId) {
    case "01":
      return [
        String(page.main_recommendation ?? ""),
        String(page.conditions ?? ""),
        String(page.not_choosing ?? ""),
      ].join("\n");
    case "02":
      return [
        String(page.destiny_reason ?? ""),
        String(page.science_mechanism ?? ""),
        String(page.convergence ?? ""),
      ].join("\n");
    default:
      return faceVisibleBlob(faceId, page);
  }
}

function longestCommonSubstringLen(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  let best = 0;
  let prev = new Array<number>(n + 1).fill(0);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1]! + 1;
        if (cur[j]! > best) best = cur[j]!;
      } else {
        cur[j] = 0;
      }
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return best;
}

function isQuestionRestatement(claim: string, question: string): boolean {
  const c = normalizeProse(claim);
  const q = normalizeProse(question);
  if (c.length < 8 || q.length < 8) return false;
  if (c.includes(q) && q.length / c.length >= 0.4) return true;
  if (q.includes(c) && c.length / q.length >= 0.55) return true;
  const overlap = longestCommonSubstringLen(c, q);
  if (overlap >= 12 && overlap / c.length >= 0.5) return true;
  return false;
}

function unitCited(blob: string, unitId: string): boolean {
  const id = unitId.trim();
  if (!id) return false;
  if (blob.includes(id)) return true;
  // pack:d01 / book[0].d01 style from DeepEvidence projection
  if (blob.includes(`pack:${id}`)) return true;
  return false;
}

/**
 * Explanation-face body must not invent means prescriptions (pack closed set).
 * Runs with or without pack — machine FAIL, not human-only.
 * Returns null when face is not in the scan set (e.g. 05/06/08 path pages).
 */
export function gateFaceBodyMeansPrescription(input: {
  key: string;
  page_schema: unknown;
}): ContentGateVerdict | null {
  const faceId = asFaceId(input.key);
  if (!faceId) return null;
  const fields = BODY_MEANS_SCAN_FIELDS[faceId];
  if (!fields?.length) return null;

  const page =
    input.page_schema && typeof input.page_schema === "object"
      ? (input.page_schema as Record<string, unknown>)
      : null;
  if (!page) {
    return {
      passed: false,
      failed_rule: BOOK_BODY_MEANS_PRESCRIPTION_RULE,
      detail: "正文缺 JSON，无法核对手段处方。",
      notes: ["gate:face_body_means"],
    };
  }

  const notes: string[] = ["gate:face_body_means", `face:${faceId}`];
  for (const field of fields) {
    const text = String(page[field] ?? "").trim();
    if (!text) continue;
    const className = classifyMeansPrescription(text);
    if (!className) continue;
    const snippet = text.slice(0, 48);
    return {
      passed: false,
      failed_rule: BOOK_BODY_MEANS_PRESCRIPTION_RULE,
      detail: `Face ${faceId}「${field}」写入手段处方（${className}）：「${snippet}」。解释页（含交汇）只写为何如此，禁宜/可收费试点/付费后再切等行动处方——与 pack means_prescription 同口径。`,
      notes: [
        ...notes,
        BOOK_BODY_MEANS_PRESCRIPTION_RULE,
        `field:${field}`,
        `class:${className}`,
      ],
    };
  }
  notes.push("face_body_means_pass");
  return { passed: true, notes };
}

/**
 * Returns null when pack slice absent (legacy body path).
 * Hard-fail when pack present but body drops units/tracks or restates question.
 * Also hard-fail explanation-face means prescriptions (same closed set as pack).
 */
export function gateBookJudgmentBodyConsume(input: {
  key: string;
  page_schema: unknown;
  pack_units: readonly BookJudgmentUnit[] | null | undefined;
  question?: string | null;
}): ContentGateVerdict | null {
  const meansGate = gateFaceBodyMeansPrescription({
    key: input.key,
    page_schema: input.page_schema,
  });
  if (meansGate && !meansGate.passed) return meansGate;

  const units = input.pack_units ?? [];
  if (!units.length) {
    // No pack slice: means gate (if any) already applied above; skip consume.
    return meansGate;
  }

  const faceId = asFaceId(input.key);
  if (!faceId || faceId === "03") {
    return {
      passed: true,
      notes: ["gate:book_judgment_body", "skip:face_no_pack_consume"],
    };
  }

  const page =
    input.page_schema && typeof input.page_schema === "object"
      ? (input.page_schema as Record<string, unknown>)
      : null;
  if (!page) {
    return {
      passed: false,
      failed_rule: BOOK_BODY_PACK_UNIT_MISS_RULE,
      detail: "正文缺 JSON，无法核对批断包消费。",
      notes: ["gate:book_judgment_body"],
    };
  }

  const notes: string[] = [
    "gate:book_judgment_body",
    `pack_units:${units.length}`,
    ...(meansGate?.notes ?? []),
  ];
  const citeBlob = evidenceBlob(faceId, page);
  const fullBlob = faceVisibleBlob(faceId, page);
  const claim = claimBlob(faceId, page);

  const q = input.question?.trim() ?? "";
  if (q && isQuestionRestatement(claim, q)) {
    return {
      passed: false,
      failed_rule: BOOK_BODY_QUESTION_RESTATE_RULE,
      detail:
        "正文在复述题面/议程，未从批断包 unit.claim 装配主张。删题面复述，按 pack 三轨重写。",
      notes: [...notes, BOOK_BODY_QUESTION_RESTATE_RULE],
    };
  }

  function unitConsumed(u: BookJudgmentUnit): boolean {
    if (unitCited(citeBlob, u.id) || unitCited(fullBlob, u.id)) return true;
    // Non-pointer faces may paraphrase claim without echoing id.
    const uNorm = normalizeProse(u.claim);
    if (uNorm.length < 6) return false;
    const overlap = longestCommonSubstringLen(normalizeProse(fullBlob), uNorm);
    return overlap >= 6 && overlap / Math.min(uNorm.length, 28) >= 0.35;
  }

  // Face 01: pointer must list every unit id (science included).
  if (faceId === "01") {
    const pointerMiss = units.filter((u) => !unitCited(citeBlob, u.id));
    if (pointerMiss.length) {
      return {
        passed: false,
        failed_rule: BOOK_BODY_PACK_UNIT_MISS_RULE,
        detail: `01 依据指针未点名 pack unit：${pointerMiss.map((u) => u.id).join("、")}（须含 science）。`,
        notes: [
          ...notes,
          BOOK_BODY_PACK_UNIT_MISS_RULE,
          `miss:${pointerMiss.map((u) => u.id).join(",")}`,
        ],
      };
    }
  } else {
    const missing = units.filter((u) => !unitConsumed(u));
    if (missing.length === units.length) {
      return {
        passed: false,
        failed_rule: BOOK_BODY_PACK_UNIT_MISS_RULE,
        detail: `正文未消费任何本页 pack unit（${units.map((u) => u.id).join("、")}）。主张/依据须从 unit.claim 装配。`,
        notes: [
          ...notes,
          BOOK_BODY_PACK_UNIT_MISS_RULE,
          `miss:${missing.map((u) => u.id).join(",")}`,
        ],
      };
    }
  }

  const presentTracks = new Set<BookJudgmentTrack>(units.map((u) => u.track));
  const dropped: BookJudgmentTrack[] = [];
  for (const track of presentTracks) {
    const trackUnits = units.filter((u) => u.track === track);
    const hit =
      faceId === "01"
        ? trackUnits.some((u) => unitCited(citeBlob, u.id))
        : trackUnits.some((u) => unitConsumed(u));
    if (!hit) dropped.push(track);
  }
  if (dropped.length) {
    return {
      passed: false,
      failed_rule: BOOK_BODY_PACK_TRACK_DROP_RULE,
      detail: `正文丢掉批断包轨：${dropped.join("、")}。三轨凡本页有 unit 的都必须进主张/依据。`,
      notes: [...notes, BOOK_BODY_PACK_TRACK_DROP_RULE, `drop:${dropped.join(",")}`],
    };
  }

  notes.push("book_judgment_body_consume_pass");
  return { passed: true, notes };
}
