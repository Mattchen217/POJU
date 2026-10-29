/**
 * Delivery Lab v3 — face-native QC step table (01–08).
 * One chain per shelf face. No v1 paper fold steps.
 * 07 is topic-gated; 03 is slice-first appendix (no judgment).
 *
 * When BOOK_JUDGMENT_PACK is on (default): per-page judgment is replaced by
 * book.judgment + book.gate_judgment; faces only run body/gate/polish.
 * Explicit BOOK_JUDGMENT_PACK=0 restores per-page judgment (no half-mix).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import { isBookJudgmentPackEnabled } from "@/lib/llm/pro/delivery/book-judgment/flag";

export type LabV3StepKind =
  | "bootstrap"
  | "thesis"
  | "prealloc"
  | "topic_gate"
  | "face_slice"
  | "book_judgment"
  | "gate_book_judgment"
  | "content_judgment"
  | "content_body"
  | "gate"
  | "body_polish"
  | "evidence_soft"
  | "assemble"
  | "companion_seal"
  | "companion_daily"
  | "companion_batch_pair"
  | "companion_batch_gate";

/** 润色目标语言（一次 invoke 一个；Lab 可跳过或只跑其一）。 */
export const BODY_POLISH_LOCALES = ["zh", "en", "fr", "es"] as const;
export type BodyPolishLocale = (typeof BODY_POLISH_LOCALES)[number];

export function isBodyPolishLocale(v: string): v is BodyPolishLocale {
  return (BODY_POLISH_LOCALES as readonly string[]).includes(v);
}

export type LabV3StepDef = {
  step_key: string;
  label: string;
  /** Face id doubles as delivery segment key for new books. */
  page?: DeliverySegmentKey;
  faceId?: string;
  faceDisposition?: "primary" | "folded";
  kind: LabV3StepKind;
  uses_llm: boolean;
  accept: string;
  /** Topic-gated steps (07) — unlock after 07.gate_topic passes with applies=true. */
  topic_gated?: boolean;
};

/** Required main faces before topic gate / appendix. */
const REQUIRED_FACE_ORDER: DecisionPageId[] = ["01", "02", "04", "05", "06", "08"];

function bodyAccept(faceId: DecisionPageId): string {
  const s = DECISION_PAGE_SCHEMAS[faceId];
  return `Face ${faceId}「${s.title}」段齐全（zod）；dualTrack=${s.dualTrack}；禁 primary/backup；语言=locale。人审：页角色对、${s.dualTrackNote}`;
}

function gateAccept(faceId: DecisionPageId): string {
  return [
    `格式（机检）：Face ${faceId} 段齐全、非空；无 primary/backup；喂料 ⊆ PageFeedMatrix；locale 一致；恐吓红线。`,
    faceId === "01" ? "01 无长论证；依据仅指针。" : "",
    faceId === "05" ? "05 switch_or_stop（切轨/停止）必出。" : "",
    faceId === "06" ? "06 非勾选作业；动作类型+完成样貌。" : "",
    `质量（人审勾选）：双轨站得住；删切片后垮；页角色对。不过 → 回改正文。`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** dualTrack that hang evidence_soft after polish. */
function hangEvidenceSoft(faceId: DecisionPageId): boolean {
  const dt = DECISION_PAGE_SCHEMAS[faceId].dualTrack;
  return dt === "abc" || dt === "fold";
}

function faceMainChain(
  faceId: DecisionPageId,
  opts?: { topic_gated?: boolean; skipJudgment?: boolean },
): LabV3StepDef[] {
  const schema = DECISION_PAGE_SCHEMAS[faceId];
  const short = schema.title;
  const topic = Boolean(opts?.topic_gated);
  const out: LabV3StepDef[] = [];

  if (!opts?.skipJudgment) {
    out.push({
      step_key: `${faceId}.content.judgment`,
      label: `${short} · 原始批断`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "content_judgment",
      uses_llm: true,
      topic_gated: topic || undefined,
      accept: "产出本脸机制批断（可含闭集真词）。禁手段处方。禁 primary/backup。",
    });
  }

  out.push(
    {
      step_key: `${faceId}.content.body`,
      label: `${short} · 正文（face zod）`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "content_body",
      uses_llm: true,
      topic_gated: topic || undefined,
      accept: bodyAccept(faceId),
    },
    {
      step_key: `${faceId}.gate`,
      label: `${short} · 闸门（格式+人审）`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "gate",
      uses_llm: false,
      topic_gated: topic || undefined,
      accept: gateAccept(faceId),
    },
    {
      step_key: `${faceId}.body_polish`,
      label: `${short} · 润色（可 Skip）`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "body_polish",
      uses_llm: true,
      topic_gated: topic || undefined,
      accept:
        "闸门通过后。合规 + 目标语言（zh/en/fr/es）。禁改事实与段结构；可跳过。",
    },
  );

  if (hangEvidenceSoft(faceId)) {
    out.push({
      step_key: `${faceId}.evidence_soft`,
      label: `${short} · 依据软译（可 Skip）`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "evidence_soft",
      uses_llm: true,
      topic_gated: topic || undefined,
      accept: "依据折叠软译；不改正文段字段。可跳过。",
    });
  }
  return out;
}

/** Appendix 03: slice inspect required; optional body/polish (no judgment / no evidence_soft). */
function face03Chain(): LabV3StepDef[] {
  const schema = DECISION_PAGE_SCHEMAS["03"];
  return [
    {
      step_key: "03.slice",
      label: `${schema.title} · 切片检视`,
      page: "03",
      faceId: "03",
      faceDisposition: "primary",
      kind: "face_slice",
      uses_llm: false,
      accept:
        "本地 sliceForPage(03) 全量 JSON；八字锚必见；紫微未稳标 zfpOmitted。非 LLM。",
    },
    {
      step_key: "03.content.body",
      label: `${schema.title} · 对照句（可 Skip）`,
      page: "03",
      faceId: "03",
      faceDisposition: "primary",
      kind: "content_body",
      uses_llm: true,
      accept: bodyAccept("03") + " 默认可 Skip（附录检视够用）。",
    },
    {
      step_key: "03.gate",
      label: `${schema.title} · 闸门`,
      page: "03",
      faceId: "03",
      faceDisposition: "primary",
      kind: "gate",
      uses_llm: false,
      accept: gateAccept("03"),
    },
    {
      step_key: "03.body_polish",
      label: `${schema.title} · 润色（可 Skip）`,
      page: "03",
      faceId: "03",
      faceDisposition: "primary",
      kind: "body_polish",
      uses_llm: true,
      accept: "可选。禁改切片事实。",
    },
  ];
}

const HEAD_STEPS: LabV3StepDef[] = [
  {
    step_key: "bootstrap",
    label: "Bootstrap · 校验盘/问题",
    kind: "bootstrap",
    uses_llm: false,
    accept: "盘和问题能解析。",
  },
  {
    step_key: "thesis.gen",
    label: "Thesis · 命盘总纲",
    kind: "thesis",
    uses_llm: false,
    accept: "总纲维与 structured 对齐；右侧展示未裁切 CFP/ZFP 包。",
  },
  {
    step_key: "prealloc",
    label: "Prealloc · 本盘可引用词",
    kind: "prealloc",
    uses_llm: false,
    accept: "本盘闭集词可引用。",
  },
];

const BOOK_JUDGMENT_STEPS: LabV3StepDef[] = [
  {
    step_key: "book.judgment",
    label: "BookJudgment · 全书批断包（一枪双轨）",
    kind: "book_judgment",
    uses_llm: true,
    accept:
      "产出 BookJudgmentPack：destiny+science（或 convergence）；by_face 覆盖 01–08+03；zfpOmitted=false 时含 patternHits。超时/截断可降两枪。禁 primary/backup。",
  },
  {
    step_key: "book.gate_judgment",
    label: "闸门 · 批断包（格式+人审）",
    kind: "gate_book_judgment",
    uses_llm: false,
    accept:
      "机检：双轨（每脸 destiny+science）、by_face、patternHits。机检过自动解锁正文；勾选可选。不过 → 回改包枪（Invalidate 下游）。",
  },
];

const TAIL_STEPS: LabV3StepDef[] = [
  {
    step_key: "book.assemble",
    label: "Assemble · Face 书架预览",
    kind: "assemble",
    uses_llm: false,
    accept:
      "序 01→02→04→05→06→(07)→08→03；Face 槽渲染；零主辅纸；07 仅题命中时出现。",
  },
  {
    step_key: "companion.seal",
    label: "Companion · 封版 Brief+流日包",
    kind: "companion_seal",
    uses_llm: false,
    accept:
      "从 Face 01 main_recommendation + 05 路径抽 Brief，本地建 30 日流日 pack。禁 P1 主辅文案。",
  },
  {
    step_key: "companion.daily",
    label: "Companion · 双日提醒（选 N 出 N+N+1）",
    kind: "companion_daily",
    uses_llm: true,
    accept: "先 seal。选 day N + locale → 双日提醒。",
  },
  {
    step_key: "companion.batch_pair",
    label: "Companion · 后台填一对（1枪2天）",
    kind: "companion_batch_pair",
    uses_llm: true,
    accept: "先 seal。从下一未填日写 1–2 天。",
  },
  {
    step_key: "companion.batch_gate",
    label: "Companion · 满窗整体闸",
    kind: "companion_batch_gate",
    uses_llm: false,
    accept: "须 30/30 有稿。过闸后生产才允许按日推送。",
  },
];

export function buildLabStepDefsV3(opts?: {
  bookJudgmentPack?: boolean;
}): LabV3StepDef[] {
  const pack = opts?.bookJudgmentPack ?? true;
  const skipJudgment = pack;
  const faceChains = [
    ...REQUIRED_FACE_ORDER.flatMap((id) =>
      faceMainChain(id, { skipJudgment }),
    ),
    {
      step_key: "07.gate_topic",
      label: "场域 · 题门控",
      page: "07" as DeliverySegmentKey,
      faceId: "07",
      faceDisposition: "primary" as const,
      kind: "topic_gate" as const,
      uses_llm: false,
      accept:
        "page07Applies：显示 stem 命中或跳过原因。命中后解锁 07 主链；未命中可跳过整链进 03。",
    },
    ...faceMainChain("07", { topic_gated: true, skipJudgment }),
    ...face03Chain(),
  ];
  return [
    ...HEAD_STEPS,
    ...(pack ? BOOK_JUDGMENT_STEPS : []),
    ...faceChains,
    ...TAIL_STEPS,
  ];
}

/** Runtime step table — follows BOOK_JUDGMENT_PACK (default ON). */
export function labStepDefsV3(
  env: NodeJS.ProcessEnv = process.env,
): readonly LabV3StepDef[] {
  return buildLabStepDefsV3({
    bookJudgmentPack: isBookJudgmentPackEnabled(env),
  });
}

/**
 * Default export for importers that still want a const.
 * Resolves at module load from process.env (default pack ON).
 */
export const LAB_STEP_DEFS_V3: readonly LabV3StepDef[] = labStepDefsV3();

export function labV3StepDef(
  step_key: string,
  env: NodeJS.ProcessEnv = process.env,
): LabV3StepDef | undefined {
  return labStepDefsV3(env).find((s) => s.step_key === step_key);
}

export function initLabStepsV3(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, { step_key: string; status: "idle"; attempts: [] }> {
  const out: Record<string, { step_key: string; status: "idle"; attempts: [] }> =
    {};
  for (const d of labStepDefsV3(env)) {
    out[d.step_key] = { step_key: d.step_key, status: "idle", attempts: [] };
  }
  return out;
}

/** 旧 Lab 会话补齐新增步槽（如 companion.* / face 步 / book.judgment）。 */
export function ensureLabStepsV3(
  lab: {
    steps: Record<
      string,
      { step_key: string; status: string; attempts: unknown[]; approved_attempt?: number }
    >;
  },
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const d of labStepDefsV3(env)) {
    if (!lab.steps[d.step_key]) {
      lab.steps[d.step_key] = {
        step_key: d.step_key,
        status: "idle",
        attempts: [],
      };
    }
  }
}

/** Detect remapped 10-paper Labs that predate face-native step keys. */
export function labLooksLikeLegacyTenPaper(lab: {
  steps: Record<string, unknown>;
}): boolean {
  const keys = Object.keys(lab.steps);
  return (
    keys.some((k) => k.startsWith("decision_brief.") || k.startsWith("personal_decision_patterns.")) ||
    keys.some((k) => k.startsWith("recommended_strategy.") || k.startsWith("validation_risk."))
  );
}
