/**
 * Pivot chat wait + failure chrome (zh / en / es / fr).
 * Used from phase display helpers and chat UI (not React-only).
 */

import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";

type Lang = "zh" | "en" | "es" | "fr";

type PivotChatCopyPack = {
  parallel_analysis_in_progress: string;
  organizing_key_points: string;
  received_characters: string;
  network_unstable_retry: string;
  click_to_retry: string;
  analysis_timeout_retry: string;
  deep_analysis_incomplete_retry: string;
  regenerate_analysis: string;
  review_ready_questions_incomplete: string;
  regenerate_questions: string;
  summary_timeout_retry: string;
  summary_error_retry: string;
  investigation_angles_error: string;
  pass_required_for_deliverable: string;
  summary_or_deliverable_failed: string;
  summary_done_deliverable_failed: string;
  unlock_failed_retry: string;
};

const BY_LOCALE: Record<Lang, PivotChatCopyPack> = {
  zh: {
    parallel_analysis_in_progress: "正在并行深度分析…请稍后。",
    organizing_key_points: "正在整理接下来要聊的重点…",
    received_characters: "已接收 {n} 字符",
    network_unstable_retry: "网络不太稳，我这次没能把理解整理好。点下方按钮重试。",
    click_to_retry: "点击重试",
    analysis_timeout_retry: "这次分析用时过长，点下方按钮重试。",
    deep_analysis_incomplete_retry:
      "深度分析这次没能生成完（可能是分析太复杂），点下方按钮我重新为你分析。",
    regenerate_analysis: "重新生成分析",
    review_ready_questions_incomplete:
      "复盘已经好了。接下来的提问还没生成完——点下方按钮我再试一次，不影响上面那段对话。",
    regenerate_questions: "重新生成提问",
    summary_timeout_retry: "方案汇总用时过长，点下方按钮重试。",
    summary_error_retry: "方案汇总遇到点问题，请稍后重试。",
    investigation_angles_error:
      "我在整理与你问题相关的调查角度时遇到一点异常，请再发一句让我继续。",
    pass_required_for_deliverable:
      "需要 1 张 Pass 才能解锁完整交付。请先在定价页或账户中购买 Pass，再重试。",
    summary_or_deliverable_failed:
      "汇总或交付未能生成。你的上下文已保存 — 请再次点确认重试。",
    summary_done_deliverable_failed:
      "汇总已完成，但交付未能生成。请点确认重试，或使用重新生成交付。",
    unlock_failed_retry: "解锁失败，请重试",
  },
  en: {
    parallel_analysis_in_progress: "Running deep parallel analysis... Please wait.",
    organizing_key_points: "Organizing key discussion points...",
    received_characters: "Received {n} characters",
    network_unstable_retry:
      "Network connection is unstable, so I couldn't organize things properly this time. Tap the button below to retry.",
    click_to_retry: "Click to retry",
    analysis_timeout_retry: "This analysis took too long. Tap the button below to try again.",
    deep_analysis_incomplete_retry:
      "Deep analysis couldn't finish (it might be too complex). Tap the button below and I'll re-analyze it for you.",
    regenerate_analysis: "Regenerate analysis",
    review_ready_questions_incomplete:
      "The review is ready, but the follow-up questions haven't finished generating yet. Tap the button below to try again—this won't affect the conversation above.",
    regenerate_questions: "Regenerate questions",
    summary_timeout_retry:
      "Generating the solution summary took too long. Tap the button below to retry.",
    summary_error_retry: "Encountered an issue with the solution summary. Please try again later.",
    investigation_angles_error:
      "I ran into an issue while organizing research angles related to your question. Please send another message so I can continue.",
    pass_required_for_deliverable:
      "1 Pass is required to unlock the full deliverable. Please purchase a Pass on the Pricing page or in your account, then try again.",
    summary_or_deliverable_failed:
      "The summary or deliverable could not be generated. Your context has been saved—please click Confirm to try again.",
    summary_done_deliverable_failed:
      "The summary is complete, but the deliverable could not be generated. Please click Confirm to try again, or use Regenerate Deliverable.",
    unlock_failed_retry: "Unlock failed, please try again.",
  },
  es: {
    parallel_analysis_in_progress: "Realizando análisis profundo en paralelo… Por favor, espera.",
    organizing_key_points: "Organizando los puntos clave para continuar…",
    received_characters: "Se han recibido {n} caracteres",
    network_unstable_retry:
      "La red es inestable y no pude organizar la información esta vez. Toca el botón de abajo para reintentar.",
    click_to_retry: "Haz clic para reintentar",
    analysis_timeout_retry:
      "Este análisis tardó demasiado. Toca el botón de abajo para reintentar.",
    deep_analysis_incomplete_retry:
      "El análisis profundo no se pudo completar (puede que sea demasiado complejo). Toca el botón de abajo para que vuelva a analizarlo.",
    regenerate_analysis: "Volver a generar el análisis",
    review_ready_questions_incomplete:
      "El resumen ya está listo. Las siguientes preguntas aún no se han terminado de generar; toca el botón de abajo para intentarlo de nuevo (no afectará la conversación anterior).",
    regenerate_questions: "Volver a generar las preguntas",
    summary_timeout_retry:
      "El resumen de soluciones tardó demasiado. Toca el botón de abajo para reintentar.",
    summary_error_retry:
      "Ocurrió un problema con el resumen de soluciones. Inténtalo de nuevo más tarde.",
    investigation_angles_error:
      "Surgió un problema al organizar los enfoques de investigación para tu pregunta. Envía otro mensaje para que pueda continuar.",
    pass_required_for_deliverable:
      "Se requiere 1 Pass para desbloquear la entrega completa. Por favor, compra un Pass en la página de precios o en tu cuenta y vuelve a intentarlo.",
    summary_or_deliverable_failed:
      "No se pudo generar el resumen o la entrega. Tu contexto se ha guardado; haz clic en Confirmar para volver a intentarlo.",
    summary_done_deliverable_failed:
      "El resumen se ha completado, pero no se pudo generar la entrega. Haz clic en Confirmar para reintentarlo o usa Volver a generar entrega.",
    unlock_failed_retry: "Error al desbloquear, por favor vuelve a intentarlo.",
  },
  fr: {
    parallel_analysis_in_progress:
      "Analyse approfondie en parallèle en cours… Veuillez patienter.",
    organizing_key_points: "Organisation des points clés de la suite de la discussion…",
    received_characters: "{n} caractère(s) reçu(s)",
    network_unstable_retry:
      "Le réseau est instable, la synthèse n'a pas pu être effectuée. Appuyez sur le bouton ci-dessous pour réessayer.",
    click_to_retry: "Cliquer pour réessayer",
    analysis_timeout_retry:
      "Cette analyse a pris trop de temps. Appuyez sur le bouton ci-dessous pour réessayer.",
    deep_analysis_incomplete_retry:
      "L'analyse approfondie n'a pas pu être finalisée (elle est peut-être trop complexe). Appuyez sur le bouton ci-dessous pour relancer l'analyse.",
    regenerate_analysis: "Régénérer l'analyse",
    review_ready_questions_incomplete:
      "Le bilan est prêt. Les questions suivantes ne sont pas encore terminées — appuyez sur le bouton ci-dessous pour réessayer, sans impact sur la conversation ci-dessus.",
    regenerate_questions: "Régénérer les questions",
    summary_timeout_retry:
      "La synthèse des solutions a pris trop de temps. Appuyez sur le bouton ci-dessous pour réessayer.",
    summary_error_retry:
      "Un problème est survenu lors de la synthèse des solutions. Veuillez réessayer plus tard.",
    investigation_angles_error:
      "Une anomalie est survenue lors de l'organisation des axes d'analyse liés à votre question. Veuillez envoyer un autre message pour que je puisse continuer.",
    pass_required_for_deliverable:
      "1 Pass est requis pour débloquer l'intégralité du livrable. Veuillez acheter un Pass sur la page des tarifs ou dans votre compte, puis réessayez.",
    summary_or_deliverable_failed:
      "La synthèse ou le livrable n'a pas pu être généré. Votre contexte a été sauvegardé — veuillez cliquer sur Confirmer pour réessayer.",
    summary_done_deliverable_failed:
      "La synthèse est terminée, mais le livrable n'a pas pu être généré. Veuillez cliquer sur Confirmer pour réessayer, ou utiliser Régénérer le livrable.",
    unlock_failed_retry: "Échec du déverrouillage, veuillez réessayer.",
  },
};

export function pivotChatCopy(locale: string): PivotChatCopyPack {
  const b = deliveryLocaleBucket(locale);
  return BY_LOCALE[b === "de" ? "en" : b];
}

export function pivotChatReceivedChars(locale: string, n: number): string {
  return pivotChatCopy(locale).received_characters.replace("{n}", String(n));
}
