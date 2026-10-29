/**
 * Delivery Lab v3 — face-native step table (01–08).
 * One triad per shelf face. No v1 paper fold steps.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";

export type LabV3StepKind =
  | "bootstrap"
  | "thesis"
  | "prealloc"
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
};

const FACE_ORDER: DecisionPageId[] = ["01", "02", "04", "05", "06", "08", "03"];

function bodyAccept(faceId: DecisionPageId): string {
  const s = DECISION_PAGE_SCHEMAS[faceId];
  return `Face ${faceId}「${s.title}」段齐全（zod）；dualTrack=${s.dualTrack}；禁 primary/backup；语言=locale。人审：页角色对、${s.dualTrackNote}`;
}

function gateAccept(faceId: DecisionPageId): string {
  return `格式闸：Face ${faceId} 段字段齐全、非空（facts=required）；无 primary/backup；喂料 ⊆ PageFeedMatrix。不过 → 回改正文。`;
}

function faceTriad(faceId: DecisionPageId): LabV3StepDef[] {
  const schema = DECISION_PAGE_SCHEMAS[faceId];
  const short = `${faceId} ${schema.title}`;
  const hangEvidenceSoft = faceId !== "01" && faceId !== "03";
  const out: LabV3StepDef[] = [
    {
      step_key: `${faceId}.content.judgment`,
      label: `${short} 内容① · 原始批断`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "content_judgment",
      uses_llm: true,
      accept: "产出本脸机制批断（可含闭集真词）。禁手段处方。已升闸类别机检；其余人审。",
    },
    {
      step_key: `${faceId}.content.body`,
      label: `${short} 内容① · 正文（face zod）`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "content_body",
      uses_llm: true,
      accept: bodyAccept(faceId),
    },
    {
      step_key: `${faceId}.gate`,
      label: `${short} 闸门② · 验收（只判不改）`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "gate",
      uses_llm: false,
      accept: gateAccept(faceId),
    },
    {
      step_key: `${faceId}.body_polish`,
      label: `${short} 润色 · 合规+目标语言`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "body_polish",
      uses_llm: true,
      accept:
        "闸门通过后。合规 + 目标语言（zh/en/fr/es）。禁改事实与段结构；可跳过。",
    },
  ];
  if (hangEvidenceSoft) {
    out.push({
      step_key: `${faceId}.evidence_soft`,
      label: `${short} 依据③ · 合规软译`,
      page: faceId,
      faceId,
      faceDisposition: "primary",
      kind: "evidence_soft",
      uses_llm: true,
      accept: "依据折叠软译；不改正文段字段。可跳过（01/03 无此步）。",
    });
  }
  return out;
}

/** Fixed unlock order for v3 labs — face-native. */
export const LAB_STEP_DEFS_V3: readonly LabV3StepDef[] = [
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
    accept: "总纲维与 structured 对齐（本地真算）。",
  },
  {
    step_key: "prealloc",
    label: "Prealloc · 本盘可引用词",
    kind: "prealloc",
    uses_llm: false,
    accept: "本盘闭集词可引用。",
  },
  ...FACE_ORDER.flatMap((id) => faceTriad(id)),
  {
    step_key: "book.assemble",
    label: "Assemble · 书架预览（01→02→04→05→06→(07)→08→03）",
    kind: "assemble",
    uses_llm: false,
    accept:
      "按内容 SoT 书架序通读；07 题相关才出；03 附录包尾。全书 face-native，零主辅纸。",
  },
  {
    step_key: "companion.seal",
    label: "Companion · 封版战略 Brief+流日包",
    kind: "companion_seal",
    uses_llm: false,
    accept:
      "从 Face 01(+05) 抽主推荐/路径 Brief，本地建 30 日流日 pack。语言=站/Lab locale。",
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
] as const;

export function labV3StepDef(step_key: string): LabV3StepDef | undefined {
  return LAB_STEP_DEFS_V3.find((s) => s.step_key === step_key);
}

export function initLabStepsV3(): Record<
  string,
  { step_key: string; status: "idle"; attempts: [] }
> {
  const out: Record<string, { step_key: string; status: "idle"; attempts: [] }> = {};
  for (const d of LAB_STEP_DEFS_V3) {
    out[d.step_key] = { step_key: d.step_key, status: "idle", attempts: [] };
  }
  return out;
}

/** 旧 Lab 会话补齐新增步槽（如 companion.* / face 步）。 */
export function ensureLabStepsV3(lab: {
  steps: Record<
    string,
    { step_key: string; status: string; attempts: unknown[]; approved_attempt?: number }
  >;
}): void {
  for (const d of LAB_STEP_DEFS_V3) {
    if (!lab.steps[d.step_key]) {
      lab.steps[d.step_key] = {
        step_key: d.step_key,
        status: "idle",
        attempts: [],
      };
    }
  }
}
