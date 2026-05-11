export const MECHANICAL_REFUSALS: Record<string, { drift: string; abuse: string }> = {
  en: {
    drift: "I detect topic drift from your session objective. Please restate the original question or start a new session.",
    abuse: "This input violates safety boundaries. Session is paused until you submit safe content.",
  },
  zh: {
    drift: "检测到话题偏移。请回到原始问题，或新建会话。",
    abuse: "输入触发安全边界。当前会话已暂停，请改写后再试。",
  },
  es: {
    drift: "Detecté desvío del tema. Vuelve a la pregunta original o inicia una sesión nueva.",
    abuse: "Este contenido cruza límites de seguridad. La sesión queda en pausa.",
  },
  fr: {
    drift: "Je détecte une dérive du sujet. Revenez à la question initiale ou démarrez une nouvelle session.",
    abuse: "Ce contenu dépasse les limites de sécurité. Session mise en pause.",
  },
  de: {
    drift: "Ich erkenne eine Themenabweichung. Bitte zur Ausgangsfrage zurückkehren oder neue Sitzung starten.",
    abuse: "Diese Eingabe verletzt Sicherheitsgrenzen. Sitzung wurde pausiert.",
  },
};
