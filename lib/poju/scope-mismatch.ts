/**
 * First-input scope gate — fixed user-facing copy (no model freeform for out_of_scope).
 * Rules only; no positive examples in prompts that call this.
 */

export type ScopeSignal = "in_scope" | "unclear" | "out_of_scope";

export function parseScopeSignal(raw: unknown): ScopeSignal | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s === "in_scope" || s === "unclear" || s === "out_of_scope") return s;
  return null;
}

/** Fixed scope_mismatch body for refund path — five locales. */
export function scopeMismatchMessage(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) {
    return "POJU 面向特定的人、一件具体的问题或困境，帮助你找到可落地的破局方向。当前内容看不出属于可服务范围。请用文字重新描述你的情况；若暂时不适合继续，可申请退款。";
  }
  if (l.startsWith("es")) {
    return "POJU está pensado para una persona concreta y un dilema o decisión específica, para ofrecer un camino accionable. Lo que enviaste no parece estar dentro de ese alcance. Describe tu situación con palabras; si prefieres no continuar, puedes solicitar un reembolso.";
  }
  if (l.startsWith("de")) {
    return "POJU richtet sich an eine konkrete Person und ein bestimmtes Problem oder Dilemma — mit umsetzbaren nächsten Schritten. Deine Eingabe scheint außerhalb dieses Rahmens zu liegen. Bitte beschreibe deine Situation in Worten; wenn du nicht fortfahren möchtest, kannst du eine Rückerstattung beantragen.";
  }
  if (l.startsWith("fr")) {
    return "POJU s’adresse à une personne précise et à un dilemme ou une décision concrète, pour proposer une voie actionnable. Votre message ne semble pas entrer dans ce cadre. Décrivez votre situation en mots ; si vous préférez ne pas continuer, vous pouvez demander un remboursement.";
  }
  return "POJU is for a specific person and a concrete dilemma or decision — with actionable next steps. What you sent doesn’t look like that. Please restate your situation in words; if you’d rather not continue, you can request a refund.";
}
