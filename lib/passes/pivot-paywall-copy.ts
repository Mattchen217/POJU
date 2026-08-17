/**
 * Pivot Pass paywall chrome — zh / en / es / fr.
 * No “matrix / bazi report” framing; unlock = dialogue + deliverables.
 */

import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";

export type PivotPaywallCopy = {
  unlockWithPass: string;
  deepDialogueTitle: string;
  consumePassDesc: string;
  passDeducted: (n: number) => string;
  buyOrSubscribePass: string;
  working: string;
  passPerSession: string;
  errUnlockFailed: string;
};

const BY_LOCALE: Record<
  "zh" | "en" | "es" | "fr",
  Omit<PivotPaywallCopy, "passDeducted"> & { passDeductedTpl: string }
> = {
  zh: {
    unlockWithPass: "使用 1 Pass 解锁",
    deepDialogueTitle: "与 Pivot 深入对话",
    consumePassDesc: "消耗 1 个 Pass（优先订阅额度），解锁完整Pivot对话与交付。",
    passDeductedTpl: "已经扣除 {n} Pass",
    buyOrSubscribePass: "购买 / 订阅 Pass",
    working: "处理中…",
    passPerSession: " Pass / 次",
    errUnlockFailed: "解锁失败，请重试",
  },
  en: {
    unlockWithPass: "Unlock with 1 Pass",
    deepDialogueTitle: "In-depth Conversation with Pivot",
    consumePassDesc:
      "Consume 1 Pass (subscription quota prioritized) to unlock full Pivot dialogue and deliverables.",
    passDeductedTpl: "{n} Pass deducted",
    buyOrSubscribePass: "Buy / Subscribe to Pass",
    working: "Working…",
    passPerSession: " Pass / session",
    errUnlockFailed: "Unlock failed, please try again.",
  },
  es: {
    unlockWithPass: "Desbloquear con 1 Pass",
    deepDialogueTitle: "Conversación en profundidad con Pivot",
    consumePassDesc:
      "Consume 1 Pass (prioridad de cuota de suscripción) para desbloquear la conversación completa y los entregables de Pivot.",
    passDeductedTpl: "Se ha deducido {n} Pass",
    buyOrSubscribePass: "Comprar / Suscribirse a Pass",
    working: "Procesando…",
    passPerSession: " Pass / sesión",
    errUnlockFailed: "Error al desbloquear, por favor vuelve a intentarlo.",
  },
  fr: {
    unlockWithPass: "Débloquer avec 1 Pass",
    deepDialogueTitle: "Conversation approfondie avec Pivot",
    consumePassDesc:
      "Consomme 1 Pass (quota d'abonnement prioritaire) pour débloquer l'intégralité de la conversation et des livrables Pivot.",
    passDeductedTpl: "{n} Pass déduit(s)",
    buyOrSubscribePass: "Acheter / S'abonner à un Pass",
    working: "Traitement…",
    passPerSession: " Pass / session",
    errUnlockFailed: "Échec du déverrouillage, veuillez réessayer.",
  },
};

export function pivotPaywallCopy(locale: string): PivotPaywallCopy {
  const b = deliveryLocaleBucket(locale);
  const pack = BY_LOCALE[b === "de" ? "en" : b];
  const { passDeductedTpl, ...rest } = pack;
  return {
    ...rest,
    passDeducted: (n: number) => passDeductedTpl.replace("{n}", String(n)),
  };
}
