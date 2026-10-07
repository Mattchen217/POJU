/**
 * Pivot chat wait + failure chrome (zh / en / es / fr).
 * Used from phase display helpers and chat UI (not React-only).
 */

import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";
import type { Segment2CallAProgressStep } from "@/lib/poju/segment2-progress-steps";

type Lang = "zh" | "en" | "es" | "fr" | "de";

type PivotChatCopyPack = {
  /** Fixed Stage-2 wait headline (not final delivery). */
  parallel_analysis_in_progress: string;
  organizing_key_points: string;
  received_characters: string;
  /** Dynamic Call A steps — keyed by Segment2CallAProgressStep. */
  segment2_step_starting: string;
  segment2_step_a0_plan: string;
  segment2_step_dims_spine: string;
  segment2_step_voice: string;
  segment2_step_finalize: string;
  /** Silent supply retry while Call A is still in the wait row. */
  segment2_supply_retry: string;
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
    parallel_analysis_in_progress: "正在进行初步的深度推算…这不是最终交付…请稍后！",
    organizing_key_points: "正在整理接下来要聊的重点…",
    received_characters: "已接收 {n} 字符",
    segment2_step_starting: "正在启动深度推算…",
    segment2_step_a0_plan: "正在锁定与本题相关的真算切片…",
    segment2_step_dims_spine: "正在并行推算多维判断与破局骨架…",
    segment2_step_voice: "正在整理初步假设与核对文案…",
    segment2_step_finalize: "正在收束分析…",
    segment2_supply_retry: "供应波动，正在自动重试深度分析…",
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
    summary_done_deliverable_failed:
      "汇总已完成，但交付书在写出第一页之前中断了。请用侧栏「重新生成交付书」重试；若仍失败，把服务器红色 [final-delivery-STOP] 里的 reason 发我。",
    summary_or_deliverable_failed:
      "汇总或交付未能完成。若书页已显示，请点「继续」；否则用侧栏重新生成交付书。",
    unlock_failed_retry: "解锁失败，请重试",
  },
  en: {
    parallel_analysis_in_progress:
      "Running a preliminary deep reckoning… This is not the final deliverable… Please wait!",
    organizing_key_points: "Organizing key discussion points...",
    received_characters: "Received {n} characters",
    segment2_step_starting: "Starting deep reckoning…",
    segment2_step_a0_plan: "Locking the calc slice relevant to this question…",
    segment2_step_dims_spine: "Reckoning dimensions and breakthrough spine in parallel…",
    segment2_step_voice: "Drafting the preliminary hypothesis for you to check…",
    segment2_step_finalize: "Closing the analysis…",
    segment2_supply_retry: "Provider hiccup — retrying deep analysis…",
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
    summary_done_deliverable_failed:
      "The summary is complete, but delivery stopped before the first page. Use Regenerate delivery in the rail to retry. If it fails again, send the red [final-delivery-STOP] reason from server logs.",
    summary_or_deliverable_failed:
      "Summary or delivery didn't finish. If pages are on screen, tap Continue; otherwise regenerate delivery from the rail.",
    unlock_failed_retry: "Unlock failed, please try again.",
  },
  es: {
    parallel_analysis_in_progress:
      "Realizando un cálculo profundo preliminar… Esto no es la entrega final… ¡Espera un momento!",
    organizing_key_points: "Organizando los puntos clave para continuar…",
    received_characters: "Se han recibido {n} caracteres",
    segment2_step_starting: "Iniciando el cálculo profundo…",
    segment2_step_a0_plan: "Bloqueando el recorte de cálculo relevante…",
    segment2_step_dims_spine: "Calculando dimensiones y estructura en paralelo…",
    segment2_step_voice: "Redactando la hipótesis preliminar para que la revises…",
    segment2_step_finalize: "Cerrando el análisis…",
    segment2_supply_retry: "Inestabilidad del proveedor — reintentando el análisis profundo…",
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
      "No se pudo generar el resumen o la entrega. Si ya hay páginas, toca Continuar; si no, usa Regenerar entrega.",
    summary_done_deliverable_failed:
      "El resumen se completó, pero la entrega se detuvo antes de la primera página. Usa Regenerar entrega en la barra lateral. Si falla otra vez, envía el reason del log rojo [final-delivery-STOP].",
    unlock_failed_retry: "Error al desbloquear, por favor vuelve a intentarlo.",
  },
  fr: {
    parallel_analysis_in_progress:
      "Calcul profond préliminaire en cours… Ce n'est pas la livraison finale… Veuillez patienter !",
    organizing_key_points: "Organisation des points clés de la suite de la discussion…",
    received_characters: "{n} caractère(s) reçu(s)",
    segment2_step_starting: "Démarrage du calcul profond…",
    segment2_step_a0_plan: "Verrouillage de la tranche de calcul pertinente…",
    segment2_step_dims_spine: "Calcul parallèle des dimensions et de la structure…",
    segment2_step_voice: "Rédaction de l'hypothèse préliminaire à vérifier…",
    segment2_step_finalize: "Clôture de l'analyse…",
    segment2_supply_retry: "Instabilité du fournisseur — nouvelle tentative d'analyse…",
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
      "La synthèse ou le livrable n'a pas pu aboutir. Si des pages sont affichées, appuyez sur Continuer ; sinon, régénérez le livrable.",
    summary_done_deliverable_failed:
      "La synthèse est terminée, mais la livraison s'est arrêtée avant la première page. Utilisez Régénérer le livrable. En cas d'échec, envoyez le reason du log rouge [final-delivery-STOP].",
    unlock_failed_retry: "Échec du déverrouillage, veuillez réessayer.",
  },
  de: {
    parallel_analysis_in_progress:
      "Vorläufige Tiefenberechnung läuft… Dies ist nicht die endgültige Lieferung… Bitte warten!",
    organizing_key_points: "Die nächsten Gesprächspunkte werden vorbereitet…",
    received_characters: "{n} Zeichen empfangen",
    segment2_step_starting: "Tiefenberechnung wird gestartet…",
    segment2_step_a0_plan: "Relevante Berechnungsscheibe wird gesperrt…",
    segment2_step_dims_spine: "Dimensionen und Durchbruch-Gerüst werden parallel berechnet…",
    segment2_step_voice: "Vorläufige Hypothese zum Abgleich wird formuliert…",
    segment2_step_finalize: "Analyse wird abgeschlossen…",
    segment2_supply_retry: "Anbieterstörung — Tiefenanalyse wird erneut gestartet…",
    network_unstable_retry:
      "Das Netzwerk ist instabil; die Zusammenfassung konnte nicht erstellt werden. Tippe unten zum erneuten Versuch.",
    click_to_retry: "Erneut versuchen",
    analysis_timeout_retry:
      "Diese Analyse hat zu lange gedauert. Tippe unten, um es erneut zu versuchen.",
    deep_analysis_incomplete_retry:
      "Die Tiefenanalyse konnte nicht abgeschlossen werden (möglicherweise zu komplex). Tippe unten für eine neue Analyse.",
    regenerate_analysis: "Analyse neu erzeugen",
    review_ready_questions_incomplete:
      "Der Rückblick ist fertig, aber die Folgefragen sind noch nicht fertig. Tippe unten zum erneuten Versuch — das Gespräch oben bleibt unberührt.",
    regenerate_questions: "Fragen neu erzeugen",
    summary_timeout_retry:
      "Die Lösungssusammenfassung hat zu lange gedauert. Tippe unten zum erneuten Versuch.",
    summary_error_retry:
      "Bei der Lösungssusammenfassung ist ein Problem aufgetreten. Bitte später erneut versuchen.",
    investigation_angles_error:
      "Beim Ordnen der Untersuchungsrichtungen zu deiner Frage ist etwas schiefgelaufen. Sende bitte eine weitere Nachricht.",
    pass_required_for_deliverable:
      "1 Pass ist nötig, um die vollständige Lieferung freizuschalten. Bitte auf der Preisseite oder im Konto kaufen und erneut versuchen.",
    summary_or_deliverable_failed:
      "Zusammenfassung oder Lieferung konnte nicht abgeschlossen werden. Wenn Seiten sichtbar sind, tippe Weiter; sonst Lieferung neu erzeugen.",
    summary_done_deliverable_failed:
      "Die Zusammenfassung ist fertig, aber die Lieferung stoppte vor der ersten Seite. Nutze «Lieferung neu erzeugen». Bei erneutem Fehler sende den reason aus dem roten [final-delivery-STOP]-Log.",
    unlock_failed_retry: "Freischalten fehlgeschlagen, bitte erneut versuchen.",
  },
};

export function pivotChatCopy(locale: string): PivotChatCopyPack {
  const b = deliveryLocaleBucket(locale);
  // Website chrome: honor de when present; deliveryLocaleBucket currently folds de→en.
  const key: Lang = locale.toLowerCase().startsWith("de")
    ? "de"
    : b === "de"
      ? "en"
      : b;
  return BY_LOCALE[key];
}

export function pivotChatReceivedChars(locale: string, n: number): string {
  return pivotChatCopy(locale).received_characters.replace("{n}", String(n));
}

export function pivotChatSegment2StepLabel(
  locale: string,
  step: Segment2CallAProgressStep,
): string {
  const pack = pivotChatCopy(locale);
  switch (step) {
    case "a0_plan":
      return pack.segment2_step_a0_plan;
    case "dims_spine":
      return pack.segment2_step_dims_spine;
    case "voice":
      return pack.segment2_step_voice;
    case "finalize":
      return pack.segment2_step_finalize;
    case "starting":
    default:
      return pack.segment2_step_starting;
  }
}
