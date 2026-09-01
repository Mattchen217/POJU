import type { POJUAgentState } from "@/lib/poju/agent-state";
import { rewriteUnderstandingFieldSecondPerson } from "@/lib/poju/rewrite-understanding-second-person";

type GateLocale = "zh" | "en" | "es" | "fr";

const GATE_LOCALES: GateLocale[] = ["zh", "en", "es", "fr"];

function resolveGateLocale(locale: string): GateLocale {
  const code = locale.split("-")[0]?.toLowerCase() ?? "en";
  return GATE_LOCALES.includes(code as GateLocale) ? (code as GateLocale) : "en";
}

const GATE_COPY: Record<
  GateLocale,
  {
    confirm: string;
    supplement: string;
    supplementAck: string;
    summaryIntro: string;
    summaryPending: string;
    summaryFooter: string;
    fieldEvent: string;
    fieldStakes: string;
    fieldSticking: string;
    fieldWants: string;
    fieldPriority: string;
  }
> = {
  zh: {
    confirm: "确认并继续",
    supplement: "补充并修正",
    supplementAck: "好的，请直接写出你想调整或补充的部分——我会据此更新理解，再请你确认。",
    summaryIntro:
      "我已经听懂你现在卡在哪里、想往哪走。下面用几段话帮你核对——有偏差直接告诉我。",
    summaryPending: "（待补充）",
    summaryFooter: "你确认之后，我会结合你的个性化数据做更深一层的分析，并标出接下来值得一起聊清的几件事。",
    fieldEvent: "你卡住的事",
    fieldStakes: "眼下的处境",
    fieldSticking: "你特别卡的那一层",
    fieldWants: "你想去的方向",
    fieldPriority: "你最在意的一点",
  },
  en: {
    confirm: "Confirm and continue",
    supplement: "Add and revise",
    supplementAck:
      "Sure — tell me what you'd like to add or correct, and I'll update my understanding before we continue.",
    summaryIntro:
      "I've got a clear read on where you're stuck and where you want to go. Here's a short write-up so you can check whether I've got it right:",
    summaryPending: "(pending)",
    summaryFooter:
      "Once you confirm, I'll go deeper with your personal data and outline directions plus what we should clarify next.",
    fieldEvent: "What's holding you",
    fieldStakes: "Where things stand",
    fieldSticking: "The layer that bites hardest",
    fieldWants: "Where you want to go",
    fieldPriority: "What matters most",
  },
  es: {
    confirm: "Confirmar y continuar",
    supplement: "Añadir y corregir",
    supplementAck:
      "De acuerdo — cuéntame qué quieres añadir o corregir y actualizaré mi comprensión antes de seguir.",
    summaryIntro:
      "Ya tengo claro dónde estás atascado/a y hacia dónde quieres ir. Te lo escribo en unos apartados cortos para que compruebes si encaja:",
    summaryPending: "(pendiente)",
    summaryFooter:
      "Cuando confirmes, profundizaré con tus datos personales y señalaré direcciones y puntos a aclarar.",
    fieldEvent: "En qué estás atascado/a",
    fieldStakes: "Cómo está el terreno",
    fieldSticking: "La capa que más aprieta",
    fieldWants: "Hacia dónde quieres ir",
    fieldPriority: "Lo que más te importa",
  },
  fr: {
    confirm: "Confirmer et continuer",
    supplement: "Compléter et corriger",
    supplementAck:
      "D'accord — dis-moi ce que tu veux ajouter ou corriger. Je mettrai ma compréhension à jour, puis je te redemanderai confirmation.",
    summaryIntro:
      "J'ai bien saisi où tu es bloqué(e) et où tu veux aller. Voici quelques courts passages pour vérifier que j'ai bien compris :",
    summaryPending: "(à préciser)",
    summaryFooter:
      "Après confirmation, j'approfondirai l'analyse avec tes données personnelles et proposerai des directions et des points à clarifier.",
    fieldEvent: "Ce qui te bloque",
    fieldStakes: "Où en sont les choses",
    fieldSticking: "La couche qui serre le plus",
    fieldWants: "Où tu veux aller",
    fieldPriority: "Ce qui compte le plus",
  },
};

/** CTA with bold [label] chips so options don't blend into body prose. */
function buildSummaryCta(
  copy: { confirm: string; supplement: string },
  lang: GateLocale,
): string {
  const a = `**[${copy.confirm}]**`;
  const b = `**[${copy.supplement}]**`;
  if (lang === "zh") {
    return `若以上理解准确，请在输入框选择 ${a}；若要补充或修正，请选择 ${b}。`;
  }
  if (lang === "es") {
    return `Si encaja, elige ${a} en el cuadro de entrada. Para corregir o añadir, elige ${b}.`;
  }
  if (lang === "fr") {
    return `Si c'est correct, choisis ${a} dans la zone de saisie. Pour corriger, choisis ${b}.`;
  }
  return `If this looks right, choose ${a} in the input. To revise, choose ${b}.`;
}

/** Section: `### heading` + blank line + body (RichReadingText → reading-subhead). */
function sectionBlock(heading: string, body: string): string {
  const text = polishGateSectionBody(body);
  if (!text) return "";
  return `### ${heading}\n\n${text}`;
}

/**
 * Avoid visual glue across section breaks (e.g. “…不接” then next body “接：…”),
 * which reads as if the last character fell into the next section.
 */
function polishGateSectionBody(body: string): string {
  let t = rewriteUnderstandingFieldSecondPerson(body.trim());
  if (!t) return "";
  // Expand bare 接/不接 labels — avoids “…不接” + next “接：” looking like a moved character.
  t = t.replace(/(^|[；;。]\s*)接\s*[:：]/g, "$1如果接：");
  t = t.replace(/(^|[；;。]\s*)不接\s*[:：]/g, "$1如果不接：");
  if (!/[。．.！？!?…）」』"\u201d\u2019]$/u.test(t)) {
    t = `${t}。`;
  }
  return t;
}

/**
 * Natural-language recap of segment-1 fields (no metaphysics, no model freeform).
 * Layout matches segment-2 analysis: warm prose + Word-like ### heading + paragraphs.
 */
export function buildUnderstandingGateSummaryFromFields(
  agent: POJUAgentState,
  locale: string,
): string {
  const copy = GATE_COPY[resolveGateLocale(locale)];
  const lang = resolveGateLocale(locale);
  const d = agent.core_dilemma;
  const dir = agent.desired_direction;
  const event = d?.concrete_event?.trim() || copy.summaryPending;
  const stakes = d?.stakes?.trim() || copy.summaryPending;
  const wants = dir?.wants?.trim() || copy.summaryPending;
  const sticking = d?.sticking_point?.trim() || "";
  const priority = dir?.priority?.trim() || "";

  const sections = [
    sectionBlock(copy.fieldEvent, event),
    sectionBlock(copy.fieldStakes, stakes),
    sectionBlock(copy.fieldWants, wants),
    sticking ? sectionBlock(copy.fieldSticking, sticking) : "",
    priority ? sectionBlock(copy.fieldPriority, priority) : "",
  ].filter(Boolean);

  return [
    copy.summaryIntro,
    "",
    ...sections.flatMap((s) => [s, ""]),
    buildSummaryCta(copy, lang),
    "",
    copy.summaryFooter,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip follow-up questions and analysis leakage from a model summary (fallback only). */
export function sanitizeUnderstandingGateModelResponse(response: string): string {
  let text = response.replace(/\r\n/g, "\n").trim();
  if (!text) return text;

  const paragraphs = text.split(/\n\n+/);
  const kept: string[] = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const sentences = trimmed.split(/(?<=[。！？!?…])\s+/);
    const safe = sentences.filter((s) => {
      const t = s.trim();
      if (!t) return false;
      if (/[？?]\s*$/.test(t)) return false;
      if (/(?:是…还是…|还是…|能不能|有没有|是否|会不会|要不要|吗\s*$)/.test(t)) return false;
      if (/(?:破局|方向|代价|命盘|日主|大运|流年|食神|正官|七杀|藤蔓|冷却)/.test(t)) return false;
      return true;
    });
    if (safe.length > 0) kept.push(safe.join(""));
  }
  return kept.join("\n\n").trim();
}

export function understandingGateSupplementAck(locale: string): string {
  return GATE_COPY[resolveGateLocale(locale)].supplementAck;
}

export function understandingGateConfirmButtonLabel(locale: string): string {
  return GATE_COPY[resolveGateLocale(locale)].confirm;
}

export function understandingGateSupplementButtonLabel(locale: string): string {
  return GATE_COPY[resolveGateLocale(locale)].supplement;
}

/** Gate turn display — always deterministic from confirmed fields (never model freeform). */
export function resolveUnderstandingGateSummaryContent(
  agent: POJUAgentState,
  _modelResponse: string,
  locale: string,
): string {
  return buildUnderstandingGateSummaryFromFields(agent, locale);
}
