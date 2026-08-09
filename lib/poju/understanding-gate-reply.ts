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
      "我已经基本了解你的问题和期望。我先把你目前说清的情况完整复述一遍，请你核对是否准确：",
    summaryPending: "（待补充）",
    summaryFooter: "确认后，我会结合你的个性化数据做深度分析，给出方向与接下来需要聊清的几个点。",
    summaryCta: "若以上理解准确，请在输入框选择「对，就是这样」；若要补充或修正，请选择「我还想补充一点」。",
    fieldEvent: "问题",
    fieldStakes: "情况",
    fieldSticking: "卡点模式",
    fieldWants: "期望",
    fieldPriority: "优先点",
  },
  en: {
    confirm: "Yes, that's right",
    supplement: "I want to add something",
    supplementAck:
      "Sure — tell me what you'd like to add or correct, and I'll update my understanding before we continue.",
    summaryIntro:
      "I've got a solid read on your problem and what you're aiming for. Let me play back what you've made clear so far — please check whether this is accurate:",
    summaryPending: "(pending)",
    summaryFooter:
      "After you confirm, I'll run a deeper analysis using your personal chart data and outline directions plus what we should clarify next.",
    summaryCta:
      'If this looks right, choose "Yes, that\'s right" in the input. To add or correct anything, choose "I want to add something".',
    fieldEvent: "Problem",
    fieldStakes: "Situation",
    fieldSticking: "Stuck pattern",
    fieldWants: "Desired outcome",
    fieldPriority: "Priority",
  },
  es: {
    confirm: "Sí, es así",
    supplement: "Quiero añadir algo",
    supplementAck:
      "De acuerdo — cuéntame qué quieres añadir o corregir y actualizaré mi comprensión antes de seguir.",
    summaryIntro:
      "Ya tengo una idea clara de tu problema y de lo que esperas. Te resumo lo que has dejado claro hasta ahora — comprueba si es correcto:",
    summaryPending: "(pendiente)",
    summaryFooter:
      "Tras confirmar, haré un análisis más profundo con tus datos personales y señalaré direcciones y puntos a aclarar.",
    summaryCta:
      'Si encaja, elige "Sí, es así" en el cuadro de entrada. Para añadir o corregir algo, elige "Quiero añadir algo".',
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
    summaryIntro:
      "Ich habe dein Problem und deine Erwartung im Wesentlichen erfasst. Ich fasse zusammen, was du bisher klargestellt hast — bitte prüfe, ob das stimmt:",
    summaryPending: "(ausstehend)",
    summaryFooter:
      "Nach deiner Bestätigung folgt eine tiefere Analyse mit deinen persönlichen Daten sowie Richtungen und Klärungspunkten.",
    summaryCta:
      'Wenn das passt, wähle im Eingabefeld "Ja, genau so". Zum Ergänzen oder Korrigieren: "Ich möchte noch etwas ergänzen".',
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
    summaryIntro:
      "J'ai bien saisi ton problème et ce que tu attends. Voici ce que tu as clarifié jusqu'ici — vérifie si c'est exact :",
    summaryPending: "(à préciser)",
    summaryFooter:
      "Après confirmation, j'approfondirai l'analyse avec tes données personnelles et proposerai des directions et des points à clarifier.",
    summaryCta:
      'Si c\'est correct, choisis "Oui, c\'est bien ça" dans la zone de saisie. Pour ajouter ou corriger, choisis "J\'aimerais ajouter quelque chose".',
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
  const wants = dir?.wants?.trim() || copy.summaryPending;
  const sticking = d?.sticking_point?.trim() || "";
  const priority = dir?.priority?.trim() || "";

  const lang = resolveGateLocale(locale);

  // Summary centers on 三必填 (问题/情况/期望); optional fields only if user said them.
  let narrative =
    lang === "zh"
      ? `你的问题是：${event}。\n情况是：${stakes}。\n你期望的是：${wants}。`
      : lang === "es"
        ? `Tu problema: ${event}.\nSituación: ${stakes}.\nLo que esperas: ${wants}.`
        : lang === "de"
          ? `Dein Problem: ${event}.\nLage: ${stakes}.\nDein Wunsch: ${wants}.`
          : lang === "fr"
            ? `Ton problème : ${event}.\nSituation : ${stakes}.\nCe que tu attends : ${wants}.`
            : `Your problem: ${event}.\nSituation: ${stakes}.\nWhat you want: ${wants}.`;

  if (sticking) {
    narrative +=
      lang === "zh"
        ? `\n（卡点模式：${sticking}）`
        : lang === "es"
          ? `\n(Patrón de bloqueo: ${sticking})`
          : lang === "de"
            ? `\n(Muster: ${sticking})`
            : lang === "fr"
              ? `\n(Schéma de blocage : ${sticking})`
              : `\n(Stuck pattern: ${sticking})`;
  }
  if (priority) {
    narrative +=
      lang === "zh"
        ? `\n（优先：${priority}）`
        : lang === "es"
          ? `\n(Prioridad: ${priority})`
          : lang === "de"
            ? `\n(Priorität: ${priority})`
            : lang === "fr"
              ? `\n(Priorité : ${priority})`
              : `\n(Priority: ${priority})`;
  }

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
