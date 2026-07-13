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
    summaryIntro: "我先把你目前说清的情况完整复述一遍，请你核对是否准确：",
    summaryPending: "（待补充）",
    summaryFooter: "确认后，我会结合你的个性化数据做深度分析，给出方向与接下来需要聊清的几个点。",
    summaryCta: "若以上理解准确，请点击下方「对，就是这样」；若要补充或修正，请点「我还想补充一点」。",
    fieldEvent: "具体发生了什么",
    fieldStakes: "你在意、或害怕失去的是",
    fieldSticking: "卡住的地方是",
    fieldWants: "你期望解决成",
    fieldPriority: "你最想优先往哪走",
  },
  en: {
    confirm: "Yes, that's right",
    supplement: "I want to add something",
    supplementAck:
      "Sure — tell me what you'd like to add or correct, and I'll update my understanding before we continue.",
    summaryIntro: "Let me play back what I understand so far — please check whether this is accurate:",
    summaryPending: "(pending)",
    summaryFooter:
      "After you confirm, I'll run a deeper analysis using your personal chart data and outline directions plus what we should clarify next.",
    summaryCta:
      'If this looks right, tap "Yes, that\'s right" below. To add or correct anything, tap "I want to add something".',
    fieldEvent: "What happened",
    fieldStakes: "What you care about or fear losing",
    fieldSticking: "Where you're stuck",
    fieldWants: "What you want instead",
    fieldPriority: "Your top priority",
  },
  es: {
    confirm: "Sí, es así",
    supplement: "Quiero añadir algo",
    supplementAck:
      "De acuerdo — cuéntame qué quieres añadir o corregir y actualizaré mi comprensión antes de seguir.",
    summaryIntro: "Te resumo lo que entiendo hasta ahora — comprueba si es correcto:",
    summaryPending: "(pendiente)",
    summaryFooter:
      "Tras confirmar, haré un análisis más profundo con tus datos personales y señalaré direcciones y puntos a aclarar.",
    summaryCta:
      'Si encaja, pulsa "Sí, es así" abajo. Para añadir o corregir algo, pulsa "Quiero añadir algo".',
    fieldEvent: "Qué ocurrió",
    fieldStakes: "Qué te importa o temes perder",
    fieldSticking: "Dónde estás atascado/a",
    fieldWants: "Qué quieres lograr",
    fieldPriority: "Tu prioridad principal",
  },
  de: {
    confirm: "Ja, genau so",
    supplement: "Ich möchte noch etwas ergänzen",
    supplementAck:
      "Gern — sag mir, was du ergänzen oder korrigieren möchtest. Ich passe mein Verständnis an und bitte dich danach erneut um Bestätigung.",
    summaryIntro: "Ich fasse zusammen, was ich bisher verstanden habe — bitte prüfe, ob das stimmt:",
    summaryPending: "(ausstehend)",
    summaryFooter:
      "Nach deiner Bestätigung folgt eine tiefere Analyse mit deinen persönlichen Daten sowie Richtungen und Klärungspunkten.",
    summaryCta:
      'Wenn das passt, tippe unten auf "Ja, genau so". Zum Ergänzen oder Korrigieren: "Ich möchte noch etwas ergänzen".',
    fieldEvent: "Was passiert ist",
    fieldStakes: "Was dir wichtig ist oder du fürchtest zu verlieren",
    fieldSticking: "Wo es hakt",
    fieldWants: "Was du erreichen willst",
    fieldPriority: "Deine oberste Priorität",
  },
  fr: {
    confirm: "Oui, c'est bien ça",
    supplement: "J'aimerais ajouter quelque chose",
    supplementAck:
      "D'accord — dis-moi ce que tu veux ajouter ou corriger. Je mettrai ma compréhension à jour, puis je te redemanderai confirmation.",
    summaryIntro: "Voici ce que j'ai compris jusqu'ici — vérifie si c'est exact :",
    summaryPending: "(à préciser)",
    summaryFooter:
      "Après confirmation, j'approfondirai l'analyse avec tes données personnelles et proposerai des directions et des points à clarifier.",
    summaryCta:
      'Si c\'est correct, appuie sur "Oui, c\'est bien ça" ci-dessous. Pour ajouter ou corriger, appuie sur "J\'aimerais ajouter quelque chose".',
    fieldEvent: "Ce qui s'est passé",
    fieldStakes: "Ce qui compte pour toi ou ce que tu crains de perdre",
    fieldSticking: "Où tu es bloqué(e)",
    fieldWants: "Ce que tu veux obtenir",
    fieldPriority: "Ta priorité principale",
  },
};

/** Natural-language recap of segment-1 fields (no metaphysics, no model freeform). */
export function buildUnderstandingGateSummaryFromFields(
  agent: POJUAgentState,
  locale: string,
): string {
  const copy = GATE_COPY[resolveGateLocale(locale)];
  const d = agent.core_dilemma;
  const dir = agent.desired_direction;
  const event = d?.concrete_event?.trim() || copy.summaryPending;
  const stakes = d?.stakes?.trim() || copy.summaryPending;
  const sticking = d?.sticking_point?.trim() || copy.summaryPending;
  const wants = dir?.wants?.trim() || copy.summaryPending;
  const priority = dir?.priority?.trim() || copy.summaryPending;

  const lang = resolveGateLocale(locale);

  const narrative =
    lang === "zh"
      ? `你面对的是：${event}。这背后你在意的是 ${stakes}，现在最卡住的是 ${sticking}。\n\n你期望的是 ${wants}，其中你最想优先的是 ${priority}。`
      : lang === "es"
        ? `Lo que enfrentas: ${event}. Te importa ${stakes}, y lo que más te traba ahora es ${sticking}.\n\nQuieres ${wants}, y tu prioridad principal es ${priority}.`
        : lang === "de"
          ? `Du stehst vor: ${event}. Dir wichtig ist ${stakes}, und am meisten hakt es gerade bei ${sticking}.\n\nDu willst ${wants}, und deine oberste Priorität ist ${priority}.`
          : lang === "fr"
            ? `Tu fais face à : ${event}. Ce qui compte pour toi : ${stakes}, et ce qui te bloque le plus : ${sticking}.\n\nTu veux ${wants}, et ta priorité principale est ${priority}.`
            : `What you're facing: ${event}. You care about ${stakes}, and what's stuck right now is ${sticking}.\n\nYou want ${wants}, and your top priority is ${priority}.`;

  return [copy.summaryIntro, "", narrative, "", copy.summaryCta, "", copy.summaryFooter].join("\n");
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
