type GateLocale = "zh" | "en" | "es" | "fr";

const GATE_LOCALES: GateLocale[] = ["zh", "en", "es", "fr"];

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
    /** Optional footer after CTA (warm, like stage-1 gate). */
    summaryFooter: string;
  }
> = {
  zh: {
    confirm: "确认并继续",
    supplement: "补充并修正",
    supplementAck: "好的，请直接补充——我会把新信息纳入，再请你确认后生成完整方案。",
    summaryCta:
      "若以上对齐准确，请在输入框选择 **[确认并继续]**——确认后我将为你生成最终交付的完整 Plan；若要补充或修正，请选择 **[补充并修正]**。",
    summaryFooter: "你确认之后，我会把刚才对齐的现实信息织进破局方案里。",
  },
  en: {
    confirm: "Confirm and continue",
    supplement: "Add and revise",
    supplementAck:
      "Sure — tell me what to add. I'll fold it in, then ask you to confirm before generating the full plan.",
    summaryCta:
      'If this alignment looks right, choose **[Confirm and continue]** in the input — I\'ll then prepare your complete final Plan. To add or correct anything, choose **[Add and revise]**.',
    summaryFooter: "Once you confirm, I'll weave what we aligned into your breakthrough plan.",
  },
  es: {
    confirm: "Confirmar y continuar",
    supplement: "Añadir y corregir",
    supplementAck:
      "De acuerdo — cuéntame qué añadir. Lo incorporaré y luego te pediré confirmación antes de generar el plan.",
    summaryCta:
      'Si este alineamiento encaja, elige **[Confirmar y continuar]** en el cuadro de entrada: prepararé tu Plan final completo. Para añadir o corregir, elige **[Añadir y corregir]**.',
    summaryFooter: "Cuando confirmes, tejeré lo alineado en tu plan de ruptura.",
  },
  fr: {
    confirm: "Confirmer et continuer",
    supplement: "Compléter et corriger",
    supplementAck:
      "D'accord — dis-moi ce qu'il faut ajouter. Je l'intègrerai, puis je te redemanderai confirmation avant de générer le plan.",
    summaryCta:
      'Si cet alignement est exact, choisis **[Confirmer et continuer]** dans la zone de saisie — je préparerai alors ton Plan final complet. Pour ajouter ou corriger, choisis **[Compléter et corriger]**.',
    summaryFooter: "Après confirmation, j'intégrerai ce que nous avons aligné dans ton plan de rupture.",
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

export function deliveryConfirmSummaryFooter(locale: string): string {
  return COPY[resolveGateLocale(locale)].summaryFooter;
}

/**
 * Ensure wrap-up response ends with the canonical CTA (+ footer), replacing weaker paraphrases.
 */
export function ensureDeliveryConfirmCta(response: string, locale: string): string {
  const cta = deliveryConfirmSummaryCta(locale);
  const footer = deliveryConfirmSummaryFooter(locale);
  const body = response.trim();
  if (!body) return `${cta}\n\n${footer}`;
  if (body.includes(cta)) {
    return body.includes(footer) ? body : `${body}\n\n${footer}`;
  }

  const confirm = deliveryConfirmButtonLabel(locale);
  const supplement = deliverySupplementButtonLabel(locale);
  // Drop trailing invitation paragraphs that already mention the chip labels or "if accurate…"
  const stripped = body
    .replace(
      /\n{1,2}(?:如果以上|若以上|If (?:this|the above)|Si (?:todo|este)|Si (?:tout|cet)|Wenn das)[\s\S]{0,320}$/iu,
      "",
    )
    .replace(
      /\n{1,2}(?:请(?:在输入框)?(?:选择|点)|choose|elige|wähle|choisis)[\s\S]{0,280}$/iu,
      "",
    )
    .replace(
      /\n{1,2}(?:可以，没有补充了|我还要补充|Yes, nothing more|I still want to add)[\s\S]{0,200}$/iu,
      "",
    )
    .trim();

  const withCta =
    stripped.includes(confirm) && stripped.includes(supplement) && stripped.length > cta.length
      ? `${stripped}\n\n${cta}`
      : `${stripped}\n\n${cta}`;
  return `${withCta}\n\n${footer}`;
}
