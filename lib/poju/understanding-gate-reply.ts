import type { POJUAgentState } from "@/lib/poju/agent-state";

type GateLocale = "zh" | "en" | "es" | "de" | "fr";

const GATE_LOCALES: GateLocale[] = ["zh", "en", "es", "de", "fr"];

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
    summaryCta: string;
    fieldEvent: string;
    fieldStakes: string;
    fieldSticking: string;
    fieldWants: string;
    fieldPriority: string;
  }
> = {
  zh: {
    confirm: "对，就是这样",
    supplement: "我还想补充一点",
    supplementAck: "好的，请直接补充你想调整或补充的部分——我会据此更新理解，再请你确认。",
    summaryIntro:
      "我已经听懂你现在卡在哪里、想往哪走。下面用几段话帮你核对——有偏差直接告诉我。",
    summaryPending: "（待补充）",
    summaryFooter: "你确认之后，我会结合你的个性化数据做更深一层的分析，并标出接下来值得一起聊清的几件事。",
    summaryCta: "若以上理解准确，请在输入框选择「对，就是这样」；若要补充或修正，请选择「我还想补充一点」。",
    fieldEvent: "你卡住的事",
    fieldStakes: "眼下的处境",
    fieldSticking: "你特别卡的那一层",
    fieldWants: "你想去的方向",
    fieldPriority: "你最在意的一点",
  },
  en: {
    confirm: "Yes, that's right",
    supplement: "I want to add something",
    supplementAck:
      "Sure — tell me what you'd like to add or correct, and I'll update my understanding before we continue.",
    summaryIntro:
      "I've got a clear read on where you're stuck and where you want to go. Here's a short write-up so you can check whether I've got it right:",
    summaryPending: "(pending)",
    summaryFooter:
      "Once you confirm, I'll go deeper with your personal data and outline directions plus what we should clarify next.",
    summaryCta:
      'If this looks right, choose "Yes, that\'s right" in the input. To add or correct anything, choose "I want to add something".',
    fieldEvent: "What's holding you",
    fieldStakes: "Where things stand",
    fieldSticking: "The layer that bites hardest",
    fieldWants: "Where you want to go",
    fieldPriority: "What matters most",
  },
  es: {
    confirm: "Sí, es así",
    supplement: "Quiero añadir algo",
    supplementAck:
      "De acuerdo — cuéntame qué quieres añadir o corregir y actualizaré mi comprensión antes de seguir.",
    summaryIntro:
      "Ya tengo claro dónde estás atascado/a y hacia dónde quieres ir. Te lo escribo en unos apartados cortos para que compruebes si encaja:",
    summaryPending: "(pendiente)",
    summaryFooter:
      "Cuando confirmes, profundizaré con tus datos personales y señalaré direcciones y puntos a aclarar.",
    summaryCta:
      'Si encaja, elige "Sí, es así" en el cuadro de entrada. Para añadir o corregir algo, elige "Quiero añadir algo".',
    fieldEvent: "En qué estás atascado/a",
    fieldStakes: "Cómo está el terreno",
    fieldSticking: "La capa que más aprieta",
    fieldWants: "Hacia dónde quieres ir",
    fieldPriority: "Lo que más te importa",
  },
  de: {
    confirm: "Ja, genau so",
    supplement: "Ich möchte noch etwas ergänzen",
    supplementAck:
      "Gern — sag mir, was du ergänzen oder korrigieren möchtest. Ich passe mein Verständnis an und bitte dich danach erneut um Bestätigung.",
    summaryIntro:
      "Ich habe erfasst, wo du feststeckst und wohin du willst. Hier in kurzen Abschnitten zum Gegenlesen:",
    summaryPending: "(ausstehend)",
    summaryFooter:
      "Nach deiner Bestätigung folgt eine tiefere Analyse mit deinen persönlichen Daten sowie Richtungen und Klärungspunkten.",
    summaryCta:
      'Wenn das passt, wähle im Eingabefeld "Ja, genau so". Zum Ergänzen oder Korrigieren: "Ich möchte noch etwas ergänzen".',
    fieldEvent: "Woran du hängst",
    fieldStakes: "Wo die Dinge stehen",
    fieldSticking: "Die Schicht, die am stärksten drückt",
    fieldWants: "Wohin du willst",
    fieldPriority: "Was dir am wichtigsten ist",
  },
  fr: {
    confirm: "Oui, c'est bien ça",
    supplement: "J'aimerais ajouter quelque chose",
    supplementAck:
      "D'accord — dis-moi ce que tu veux ajouter ou corriger. Je mettrai ma compréhension à jour, puis je te redemanderai confirmation.",
    summaryIntro:
      "J'ai bien saisi où tu es bloqué(e) et où tu veux aller. Voici quelques courts passages pour vérifier que j'ai bien compris :",
    summaryPending: "(à préciser)",
    summaryFooter:
      "Après confirmation, j'approfondirai l'analyse avec tes données personnelles et proposerai des directions et des points à clarifier.",
    summaryCta:
      'Si c\'est correct, choisis "Oui, c\'est bien ça" dans la zone de saisie. Pour ajouter ou corriger, choisis "J\'aimerais ajouter quelque chose".',
    fieldEvent: "Ce qui te bloque",
    fieldStakes: "Où en sont les choses",
    fieldSticking: "La couche qui serre le plus",
    fieldWants: "Où tu veux aller",
    fieldPriority: "Ce qui compte le plus",
  },
};

/** Section: `### heading` + blank line + body (RichReadingText → reading-subhead). */
function sectionBlock(heading: string, body: string): string {
  const text = body.trim();
  if (!text) return "";
  return `### ${heading}\n\n${text}`;
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

  return [copy.summaryIntro, "", ...sections.flatMap((s) => [s, ""]), copy.summaryCta, "", copy.summaryFooter]
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
