type GateLocale = "zh" | "en" | "es" | "de" | "fr";

const GATE_LOCALES: GateLocale[] = ["zh", "en", "es", "de", "fr"];

function resolveGateLocale(locale: string): GateLocale {
  const code = locale.split("-")[0]?.toLowerCase() ?? "en";
  return GATE_LOCALES.includes(code as GateLocale) ? (code as GateLocale) : "en";
}

const COPY: Record<
  GateLocale,
  {
    confirm: string;
    supplement: string;
    supplementAck: string;
  }
> = {
  zh: {
    confirm: "可以，没有补充了",
    supplement: "我还要补充",
    supplementAck: "好的，请直接补充——我会把新信息纳入，再请你确认后生成完整方案。",
  },
  en: {
    confirm: "Yes, nothing more to add",
    supplement: "I still want to add something",
    supplementAck:
      "Sure — tell me what to add. I'll fold it in, then ask you to confirm before generating the full plan.",
  },
  es: {
    confirm: "Sí, no tengo más que añadir",
    supplement: "Todavía quiero añadir algo",
    supplementAck:
      "De acuerdo — cuéntame qué añadir. Lo incorporaré y luego te pediré confirmación antes de generar el plan.",
  },
  de: {
    confirm: "Ja, nichts mehr hinzuzufügen",
    supplement: "Ich möchte noch etwas ergänzen",
    supplementAck:
      "Gern — sag mir, was du ergänzen möchtest. Ich nehme es auf und bitte dich danach erneut um Bestätigung.",
  },
  fr: {
    confirm: "Oui, rien à ajouter",
    supplement: "Je veux encore ajouter quelque chose",
    supplementAck:
      "D'accord — dis-moi ce qu'il faut ajouter. Je l'intègrerai, puis je te redemanderai confirmation avant de générer le plan.",
  },
};

export function deliveryConfirmButtonLabel(locale: string): string {
  return COPY[resolveGateLocale(locale)].confirm;
}

export function deliverySupplementButtonLabel(locale: string): string {
  return COPY[resolveGateLocale(locale)].supplement;
}

export function deliverySupplementAck(locale: string): string {
  return COPY[resolveGateLocale(locale)].supplementAck;
}
