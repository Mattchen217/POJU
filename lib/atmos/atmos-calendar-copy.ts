/**
 * Atmos calendar UI copy + quick tags (en / zh / es / de / fr).
 */

export type AtmosQuickTagId =
  | "signing"
  | "dating"
  | "pitch"
  | "lifeEvent"
  | "travel";

export type AtmosQuickTag = {
  id: AtmosQuickTagId;
  label: string;
  prompt: string;
};

type AtmosCalendarCopy = {
  forecastTitle: string;
  pendingLabel: string;
  startParse: string;
  generating: string;
  expandReading: string;
  retry: string;
  readingTitle: (date: string) => string;
  inquiry: {
    title: string;
    hint: string;
    placeholder: string;
    tagsLabel: string;
    submit: string;
    cancel: string;
  };
  quickTags: AtmosQuickTag[];
};

const QUICK_TAG_ORDER: AtmosQuickTagId[] = [
  "signing",
  "dating",
  "pitch",
  "lifeEvent",
  "travel",
];

const QUICK_TAG_DATA: Record<
  string,
  Record<AtmosQuickTagId, { label: string; prompt: string }>
> = {
  en: {
    signing: {
      label: "Business Signing",
      prompt:
        "I have a major contract signing or business negotiation today. How can I manage the rhythm and minimize potential risks during discussions?",
    },
    dating: {
      label: "Romantic Dating",
      prompt:
        "I have an important date or first meeting today. How can I present my best self and foster a comfortable, meaningful connection?",
    },
    pitch: {
      label: "Interview & Pitch",
      prompt:
        "I face a critical presentation, interview, or public speaking event today. How can I align my focus and presence for peak performance?",
    },
    lifeEvent: {
      label: "Major Life Decision",
      prompt:
        "I am making a major decision today like moving, a large purchase, or starting a new project. What energy management and details should I mind?",
    },
    travel: {
      label: "Travel & Transit",
      prompt:
        "I have long-distance travel or key itinerary transitions today. How should I pace my energy to minimize fatigue and stay sharp?",
    },
  },
  zh: {
    signing: {
      label: "商务签约",
      prompt:
        "今天有涉及合同签署或商务谈判的重大事项，如何在沟通与决策中把握最佳节奏并规避潜在风险？",
    },
    dating: {
      label: "情感约会",
      prompt:
        "今天计划与重要对象约会或初次见面，如何在互动中展现最佳状态，并建立舒适深度的沟通氛围？",
    },
    pitch: {
      label: "汇报面试",
      prompt:
        "今天面临重要项目汇报、面试或公开表达，如何高效调动专注力与气场，发挥最佳表现？",
    },
    lifeEvent: {
      label: "重大决定",
      prompt:
        "今天准备进行搬家、大额消费或新项目启动等重大决定，需要注意哪些精力规划与细节隐患？",
    },
    travel: {
      label: "远行出差",
      prompt:
        "今天有长途出行、出差或重要行程转换，如何合理安排行程节奏以减少消耗，保持高效状态？",
    },
  },
  es: {
    signing: {
      label: "Firma comercial",
      prompt:
        "Hoy tengo un asunto clave de firma de contrato o negociación comercial. ¿Cómo puedo gestionar el ritmo de comunicación y minimizar los riesgos potenciales en las decisiones?",
    },
    dating: {
      label: "Cita personal",
      prompt:
        "Hoy planeo una cita importante o un primer encuentro. ¿Cómo puedo presentar mi mejor versión y fomentar una conexión cómoda y profunda?",
    },
    pitch: {
      label: "Presentación y Entrevista",
      prompt:
        "Hoy me enfrento a una presentación de proyecto importante, entrevista o discurso público. ¿Cómo puedo alinear mi enfoque y presencia para un rendimiento óptimo?",
    },
    lifeEvent: {
      label: "Decisión importante",
      prompt:
        "Hoy planeo tomar una decisión importante como una mudanza, compra mayor o inicio de proyecto. ¿Qué gestión de energía y detalles debo tener en cuenta?",
    },
    travel: {
      label: "Viaje y Tránsito",
      prompt:
        "Hoy tengo un viaje de larga distancia o transiciones clave de itinerario. ¿Cómo debo dosificar mi energía para reducir el cansancio y mantener la eficiencia?",
    },
  },
  de: {
    signing: {
      label: "Vertragsabschluss",
      prompt:
        "Heute steht ein wichtiger Vertragsabschluss oder eine geschäftliche Verhandlung an. Wie kann ich die Kommunikationsdynamik optimal steuern und potenzielle Risiken minimieren?",
    },
    dating: {
      label: "Persönliches Date",
      prompt:
        "Heute habe ich ein wichtiges Date oder ein erstes Treffen. Wie kann ich mich von meiner besten Seite zeigen und eine angenehme, tiefe Verbindung aufbauen?",
    },
    pitch: {
      label: "Präsentation & Bewerbung",
      prompt:
        "Heute steht eine wichtige Projektpräsentation, ein Bewerbungsgespräch oder ein öffentlicher Auftritt an. Wie kann ich meinen Fokus und meine Präsenz für Höchstleistungen ausrichten?",
    },
    lifeEvent: {
      label: "Wichtige Entscheidung",
      prompt:
        "Heute steht eine wichtige Entscheidung an, wie ein Umzug, eine größere Anschaffung oder ein Projektstart. Welche Aspekte des Energiemanagements und welche Details sollte ich beachten?",
    },
    travel: {
      label: "Reise & Transit",
      prompt:
        "Heute habe ich eine Fernreise oder wichtige Etappenwechsel vor mir. Wie sollte ich meine Kräfte einteilen, um Erschöpfung zu vermeiden und leistungsfähig zu bleiben?",
    },
  },
  fr: {
    signing: {
      label: "Signature commerciale",
      prompt:
        "J'ai une signature de contrat ou une négociation commerciale importante aujourd'hui. Comment puis-je gérer le rythme des échanges et minimiser les risques décisionnels ?",
    },
    dating: {
      label: "Rendez-vous personnel",
      prompt:
        "J'ai un rendez-vous important ou une première rencontre aujourd'hui. Comment puis-je me présenter sous mon meilleur jour et favoriser une connexion fluide et profonde ?",
    },
    pitch: {
      label: "Entretien & Présentation",
      prompt:
        "J'ai une présentation de projet, un entretien ou une prise de parole publique importante aujourd'hui. Comment aligner ma concentration et ma présence pour une performance optimale ?",
    },
    lifeEvent: {
      label: "Décision majeure",
      prompt:
        "Je prends une décision majeure aujourd'hui (déménagement, achat important ou lancement). Quels aspects de gestion d'énergie et détails dois-je garder à l'esprit ?",
    },
    travel: {
      label: "Voyage & Déplacement",
      prompt:
        "J'ai un long voyage ou des transitions d'itinéraire importantes aujourd'hui. Comment gérer mon énergie pour réduire la fatigue et rester performant ?",
    },
  },
};

const UI: Record<
  string,
  Omit<AtmosCalendarCopy, "quickTags" | "readingTitle"> & {
    readingTitlePrefix: string;
  }
> = {
  en: {
    forecastTitle: "30-Day Decision & Status Calendar",
    pendingLabel: "Pending",
    startParse: "Start",
    generating: "Writing…",
    expandReading: "Open",
    retry: "Retry",
    readingTitlePrefix: "Field reading",
    inquiry: {
      title: "Focus for this day",
      hint: "Optional — today's plan or a specific question (e.g. “On this day I have a key project review — I want communication strategy advice.”)",
      placeholder: "Share context for this day's reading…",
      tagsLabel: "You can enter",
      submit: "Continue",
      cancel: "Cancel",
    },
  },
  zh: {
    forecastTitle: "30天决策与状态日历",
    pendingLabel: "待解析",
    startParse: "开始解析",
    generating: "解析中…",
    expandReading: "展开",
    retry: "重试",
    readingTitlePrefix: "场域阅读",
    inquiry: {
      title: "这一天的焦点",
      hint: "可选填当天计划或特定问题（如：“这一天有重要项目汇报，希望获得沟通策略建议”）",
      placeholder: "写下这一天的计划或问题…",
      tagsLabel: "你可以输入",
      submit: "继续",
      cancel: "取消",
    },
  },
  es: {
    forecastTitle: "Calendario de decisiones y estado · 30 días",
    pendingLabel: "Pendiente",
    startParse: "Analizar",
    generating: "Escribiendo…",
    expandReading: "Abrir",
    retry: "Reintentar",
    readingTitlePrefix: "Lectura del campo",
    inquiry: {
      title: "Enfoque del día",
      hint: "Opcional — plan del día o una pregunta concreta (p. ej.: “Este día tengo una revisión de proyecto importante y quiero consejos de comunicación.”)",
      placeholder: "Comparte el contexto para la lectura de este día…",
      tagsLabel: "Puedes escribir",
      submit: "Continuar",
      cancel: "Cancelar",
    },
  },
  de: {
    forecastTitle: "30-Tage Entscheidungs- & Statuskalender",
    pendingLabel: "Offen",
    startParse: "Starten",
    generating: "Schreiben…",
    expandReading: "Öffnen",
    retry: "Erneut",
    readingTitlePrefix: "Feld-Lesen",
    inquiry: {
      title: "Fokus für diesen Tag",
      hint: "Optional — Tagesplan oder eine konkrete Frage (z. B.: „An diesem Tag habe ich eine wichtige Projektpräsentation und möchte Kommunikationsstrategien.“)",
      placeholder: "Kontext für die Lesung dieses Tages…",
      tagsLabel: "Du kannst eingeben",
      submit: "Weiter",
      cancel: "Abbrechen",
    },
  },
  fr: {
    forecastTitle: "Calendrier décisions & état · 30 jours",
    pendingLabel: "En attente",
    startParse: "Analyser",
    generating: "Rédaction…",
    expandReading: "Ouvrir",
    retry: "Réessayer",
    readingTitlePrefix: "Lecture du champ",
    inquiry: {
      title: "Focus du jour",
      hint: "Optionnel — plan du jour ou question précise (ex. : « Ce jour-là j’ai une revue de projet importante et je veux des conseils de communication. »)",
      placeholder: "Contexte pour la lecture de ce jour…",
      tagsLabel: "Vous pouvez saisir",
      submit: "Continuer",
      cancel: "Annuler",
    },
  },
};

function localeKey(locale: string): string {
  const base = locale.split("-")[0]?.toLowerCase() || "en";
  if (base in UI) return base;
  return "en";
}

export function getAtmosCalendarCopy(locale: string): AtmosCalendarCopy {
  const key = localeKey(locale);
  const ui = UI[key]!;
  const tags = QUICK_TAG_DATA[key] ?? QUICK_TAG_DATA.en!;
  return {
    forecastTitle: ui.forecastTitle,
    pendingLabel: ui.pendingLabel,
    startParse: ui.startParse,
    generating: ui.generating,
    expandReading: ui.expandReading,
    retry: ui.retry,
    readingTitle: (date) => `${ui.readingTitlePrefix} · ${date}`,
    inquiry: ui.inquiry,
    quickTags: QUICK_TAG_ORDER.map((id) => ({
      id,
      label: tags[id].label,
      prompt: tags[id].prompt,
    })),
  };
}

/** Weekday headers Sun→Sat via Intl (long). */
export function getAtmosWeekdayLabels(locale: string): string[] {
  const loc = locale.startsWith("zh") ? "zh-CN" : locale;
  // 2024-01-07 = Sunday UTC
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 7 + i));
    return new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: "UTC" }).format(d);
  });
}

export function formatAtmosMonthLabel(month: number, locale: string): string {
  if (locale.startsWith("zh")) return `${month}月`;
  const d = new Date(Date.UTC(2024, month - 1, 1));
  const loc = locale.split("-")[0] || "en";
  return new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" }).format(d);
}
