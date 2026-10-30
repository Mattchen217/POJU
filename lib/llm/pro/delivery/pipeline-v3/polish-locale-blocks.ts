/**
 * Body polish · four native locale blocks (SoT) + shared brief→report thicken contract.
 * Site language / Lab target_locale selects one whole block — no fragmented if-else persona.
 */

import type { BodyPolishLocale } from "@/lib/llm/pro/delivery/lab/types-v3";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { isFaceDeliveryKey } from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";

export type PolishLocaleBlock = {
  locale: BodyPolishLocale;
  /** Whole block injected into system (persona · task · register). */
  block: string;
};

/** Face 01 absolute floors (report feel). */
export const FACE01_POLISH_FLOOR = {
  zh_chars: 450,
  en_words: 280,
  es_words: 280,
  fr_words: 280,
  main_zh: 120,
  conditions_zh: 100,
  not_choosing_zh: 80,
  main_words: 70,
  conditions_words: 55,
  not_choosing_words: 45,
  /** Min growth vs skeleton when same-script; below + high similarity = synonym FAIL. */
  min_growth_ratio: 1.55,
  synonym_jaccard: 0.72,
} as const;

export const POLISH_LOCALE_BLOCKS: Record<BodyPolishLocale, PolishLocaleBlock> = {
  en: {
    locale: "en",
    block: [
      `## Locale block · en (US English) — inject whole`,
      `### Persona`,
      `You are an American. Your native language is US English.`,
      `### Task`,
      `Localize and polish this Chinese decision-report skeleton into clear US English that a US high-school reader can follow—plain words, short sentences, no translationese.`,
      `Input = brief skeleton. Output = reader-facing report body in the same JSON slots, denser and clearer—not a synonym swap.`,
      `### Register`,
      `American spelling and habits (favor, check, organize). No British defaults. No Chinglish calques.`,
      `Sound like a sharp US editor of a decision brief, not a mystic or a corporate chatbot.`,
      `First use of "energy picture": short appositive a teen gets; then the short term is fine.`,
      `Ban stacked energy-structure / mantra / fortune-opener wallpaper.`,
    ].join("\n"),
  },
  zh: {
    locale: "zh",
    block: [
      `## Locale block · zh（中文）— 整块注入`,
      `### 人设`,
      `你是中国人，母语是中文（现代标准汉语书面语）。`,
      `### 任务`,
      `把这份已定稿的决策报告骨架做「中→中」本地化润色与加厚，写成母语读者能一口气读完的报告正文——不是同义改写，也不是说明书腔。`,
      `输入=简报骨架；输出=同 schema 槽位的读者报告正文，信息量明显高于骨架。`,
      `### 语域`,
      `自然当代书面中文；禁翻译腔、禁堆砌文言算命套话、禁「主辅」等内部管线词漏到可见层。`,
      `「能量画像」可留；周围句子须像对人讲。禁能量结构/调频/泄漏脚手架与运势开场墙纸。`,
    ].join("\n"),
  },
  es: {
    locale: "es",
    block: [
      `## Locale block · es (US / LatAm Spanish) — inyectar entero`,
      `### Persona`,
      `Eres una persona de Estados Unidos. Tu lengua materna es el español de uso en EE.UU. / Latinoamérica (no el registro exclusivo de España).`,
      `### Tarea`,
      `Localizar y pulir este esqueleto de informe de decisión (desde el chino o el borrador) al español que un hablante US/LatAm lea con naturalidad—claro, concreto, sin calcos.`,
      `Entrada = esqueleto de brief; salida = cuerpo de informe para el lector en los mismos campos JSON, más denso—no un cambio de sinónimos.`,
      `### Registro`,
      `US/LatAm (ustedes, computadora, etc.). Prohibido default solo de España. Prohibido tono de fortune-telling.`,
      `Primera vez «mapa de fuerzas / cuadro energético»: apposición corta obligatoria. Falso amigo: 领证 ≠ licencia.`,
      `Pertenencia: si el borrador dice «ella / su permiso», no lo conviertas en «tu».`,
    ].join("\n"),
  },
  fr: {
    locale: "fr",
    block: [
      `## Locale block · fr (Français) — injecter en bloc`,
      `### Persona`,
      `Tu es français / française. Ta langue maternelle est le français.`,
      `### Tâche`,
      `Localiser et densifier ce squelette de rapport de décision en français clair, lisible par un lycéen francophone—sans traduction mot à mot ni jargon mystique.`,
      `Entrée = squelette de brief ; sortie = corps de rapport pour le lecteur, mêmes champs JSON, plus dense—pas un remplacement de synonymes.`,
      `### Registre`,
      `Français métropolitain écrit clair. Interdit calque anglais, formules de voyance, mots de pipeline internes.`,
      `Première occurrence de « tableau énergétique / carte des forces » : apposition courte. Apostrophes dans les mots (l'/d'/aujourd'hui) sont légales.`,
    ].join("\n"),
  },
};

/** Shared after locale block — brief skeleton → reader report. */
export const SHARED_BRIEF_TO_REPORT_CONTRACT = [
  `## 共享加厚合同（简报 → 报告 · 四语共用）`,
  `1. 角色：输入=简报骨架；输出=读者报告正文。禁止把「草稿完整」当成「禁止加长」。`,
  `2. 保真：不得改主张方向；不得丢 conditions / not_choosing / evidence_pointer 约束；指针若含 unit id（如 d01、d02、d03）必须全保留。`,
  `3. 展开：用骨架主张 + 本页 pack 主张含义，把「为什么是这条路」写成可读段落；命理/科学/交汇在读者层自然展开（pointer 页：主文加厚 + 指针仍指向 02；主文不得只剩一句口号）。`,
  `4. 禁近义换皮：主推与骨架仅同义替换且总可见量增幅不足 → 厚度闸 FAIL。`,
  `5. 禁灌水：不加空泛励志、不加手段处方清单、不加与题无关背景；仍守恐吓红线。`,
  `6. 双轨：科学轨含义须在可见层可感（01 可在主推/条件点出负荷/现状偏差等，不必写「科学」标签）。`,
].join("\n");

export function face01ReportSlotTemplate(locale: BodyPolishLocale): string {
  const floor =
    locale === "zh"
      ? `机检下限约：可见合计 ≥${FACE01_POLISH_FLOOR.zh_chars} 字；main≥${FACE01_POLISH_FLOOR.main_zh} / conditions≥${FACE01_POLISH_FLOOR.conditions_zh} / not_choosing≥${FACE01_POLISH_FLOOR.not_choosing_zh}。`
      : `机检下限约：可见合计 ≥${FACE01_POLISH_FLOOR.en_words} words；各槽成段。`;
  return [
    `## Face 01 槽位报告感（同 schema · 勿改字段名）`,
    `- page_title / page_subtitle：可微调语感，不扩写成摘要。`,
    `- main_recommendation：2–4 句——落点 + 为何此刻这档（展开骨架关键约束，含科学/局势含义）。`,
    `- conditions：成段——成立前提与可核对反馈。`,
    `- not_choosing：成段——此刻不选哪条、误读成「必须立刻放大」的坑。`,
    `- evidence_pointer：保留全部 unit id；语感本地化，不删 science id。`,
    floor,
  ].join("\n");
}

export function assemblePolishLocaleSystem(input: {
  locale: BodyPolishLocale;
  key: DeliverySegmentKey;
  /** Extra face/page role lines already built by caller. */
  page_role?: string;
  gate_avoidance?: string;
  prior_gate?: string;
}): string {
  const localeBlock = POLISH_LOCALE_BLOCKS[input.locale].block;
  const face01 =
    input.key === "01"
      ? face01ReportSlotTemplate(input.locale)
      : isFaceDeliveryKey(input.key)
        ? [
            `## Face ${input.key} 加厚`,
            `同共享合同：简报骨架 → 读者报告；禁近义换皮；禁灌水；保真主张与条数/结构。`,
          ].join("\n")
        : "";

  return [
    `你是交付报告「可见正文润色」编辑（Pipeline v3 · body_polish）。`,
    `只输出 JSON，不要 markdown。`,
    ``,
    localeBlock,
    ``,
    SHARED_BRIEF_TO_REPORT_CONTRACT,
    face01 ? `\n${face01}` : "",
    input.page_role ? `\n${input.page_role}` : "",
    ``,
    `## 换壳同禁`,
    `禁区按类别；近义/半否定/换道具仍算犯。`,
    ``,
    `## 其它硬锁`,
    `- 禁止为写厚而发明截止点/人数配额/未收集比例/$/%/年龄（#11）；时长与具体量只保留收集已给量。`,
    `- 禁止把 chart_anchors 真词写进可见字段；chart_anchors 原样保留。`,
    `- 禁止恐吓预测；禁止自我发挥新策略；没有的事实不要补。`,
    `- 禁可照念对话引号；举例禁用模糊词时不要加引号。`,
    `- 机检失败规则：\`gate_polish_thin_synonym\`（过薄/换皮）、指针丢 unit id。`,
    input.gate_avoidance ? `\n${input.gate_avoidance}` : "",
    input.prior_gate ? `\n${input.prior_gate}` : "",
  ]
    .filter((s) => s != null && String(s).length)
    .join("\n");
}

export function polishFaceSelfCheck(locale: BodyPolishLocale): string {
  return [
    `自检（报告体）：`,
    `- 是否达到报告下限（非「略长于草稿」）？`,
    `- 是否近义换皮（主推几乎同义且总可见量未明显加厚）？`,
    `- evidence_pointer 是否仍含草稿全部 unit id（含 science）？`,
    `- 输出语言是否整页=${locale}？可见层零命理专名报幕？`,
  ].join("\n");
}
