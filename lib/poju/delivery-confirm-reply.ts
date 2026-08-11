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
    /** Closing CTA after collecting summary — fixed copy, do not paraphrase. */
    summaryCta: string;
  }
> = {
  zh: {
    confirm: "可以，没有补充了",
    supplement: "我还要补充",
    supplementAck: "好的，请直接补充——我会把新信息纳入，再请你确认后生成完整方案。",
    summaryCta:
      "如果以上都准确，请点「可以，没有补充了」——确认后我将为你生成最终交付的完整 Plan；若还有要补充或修正的，请点「我还要补充」。",
  },
  en: {
    confirm: "Yes, nothing more to add",
    supplement: "I still want to add something",
    supplementAck:
      "Sure — tell me what to add. I'll fold it in, then ask you to confirm before generating the full plan.",
    summaryCta:
      'If this all looks right, choose "Yes, nothing more to add" — I\'ll then prepare your complete final Plan for delivery. To add or correct anything, choose "I still want to add something".',
  },
  es: {
    confirm: "Sí, no tengo más que añadir",
    supplement: "Todavía quiero añadir algo",
    supplementAck:
      "De acuerdo — cuéntame qué añadir. Lo incorporaré y luego te pediré confirmación antes de generar el plan.",
    summaryCta:
      'Si todo encaja, elige "Sí, no tengo más que añadir": a continuación prepararé tu Plan final completo para la entrega. Si quieres añadir o corregir algo, elige "Todavía quiero añadir algo".',
  },
  de: {
    confirm: "Ja, nichts mehr hinzuzufügen",
    supplement: "Ich möchte noch etwas ergänzen",
    supplementAck:
      "Gern — sag mir, was du ergänzen möchtest. Ich nehme es auf und bitte dich danach erneut um Bestätigung.",
    summaryCta:
      'Wenn das alles stimmt, wähle „Ja, nichts mehr hinzuzufügen“ — danach erstelle ich deinen vollständigen finalen Plan zur Übergabe. Zum Ergänzen oder Korrigieren wähle „Ich möchte noch etwas ergänzen“.',
  },
  fr: {
    confirm: "Oui, rien à ajouter",
    supplement: "Je veux encore ajouter quelque chose",
    supplementAck:
      "D'accord — dis-moi ce qu'il faut ajouter. Je l'intègrerai, puis je te redemanderai confirmation avant de générer le plan.",
    summaryCta:
      'Si tout est exact, choisis « Oui, rien à ajouter » — je préparerai alors ton Plan final complet pour la livraison. Pour ajouter ou corriger, choisis « Je veux encore ajouter quelque chose ».',
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

/** Fixed multilingual CTA for stage-3 wrap-up / awaiting_confirmation summary. */
export function deliveryConfirmSummaryCta(locale: string): string {
  return COPY[resolveGateLocale(locale)].summaryCta;
}

/**
 * Ensure wrap-up response ends with the canonical CTA (replace weaker model paraphrases).
 */
export function ensureDeliveryConfirmCta(response: string, locale: string): string {
  const cta = deliveryConfirmSummaryCta(locale);
  const body = response.trim();
  if (!body) return cta;
  if (body.includes(cta)) return body;

  const confirm = deliveryConfirmButtonLabel(locale);
  const supplement = deliverySupplementButtonLabel(locale);
  // Drop trailing invitation paragraphs that already mention the chip labels or "if accurate…"
  const stripped = body
    .replace(
      /\n{1,2}(?:如果以上|若以上|If (?:this|the above)|Si todo|Si tout|Wenn das)[\s\S]{0,280}$/iu,
      "",
    )
    .replace(
      /\n{1,2}(?:请(?:在输入框)?(?:选择|点)|choose|elige|wähle|choisis)[\s\S]{0,220}$/iu,
      "",
    )
    .trim();

  if (stripped.includes(confirm) && stripped.includes(supplement) && stripped.length > cta.length) {
    return `${stripped}\n\n${cta}`;
  }
  return `${stripped}\n\n${cta}`;
}
