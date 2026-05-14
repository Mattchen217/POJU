import type { POJUSessionState } from "@/lib/poju/types";

export interface RuleCheckResult {
  violated: boolean;
  type?: "too_long" | "jailbreak" | "spam";
}

export function checkRuleViolation(userMessage: string, session: POJUSessionState): RuleCheckResult {
  if (userMessage.length > 2000) {
    return { violated: true, type: "too_long" };
  }

  const jailbreakPatterns = [
    /ignore\s+your\s+previous\s+instructions/i,
    /ignore\s+(your|all|previous)\s+instructions/i,
    /you\s+are\s+not\s+POJU/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /act\s+as\s+(if\s+you\s+were|a\s+different)/i,
    /forget\s+(your|the)\s+(rules|prompt|system)/i,
    /system\s+prompt/i,
    /jailbreak/i,
    /忽略.{0,5}(指令|规则|前面)/,
    /你不是\s*POJU/,
    /假装你是/,
    /扮演.{0,3}(成|为)/,
  ];

  for (const pattern of jailbreakPatterns) {
    if (pattern.test(userMessage)) {
      return { violated: true, type: "jailbreak" };
    }
  }

  const recentUserMessages = session.messages
    .filter((m) => m.role === "user" && !m.is_rejected)
    .slice(-3)
    .map((m) => m.content.trim());

  if (recentUserMessages.length >= 2) {
    const identical = recentUserMessages.every((m) => m === userMessage.trim());
    if (identical) {
      return { violated: true, type: "spam" };
    }
  }

  return { violated: false };
}

const REJECTION_MESSAGES: Record<"too_long" | "jailbreak" | "spam", Record<string, string>> = {
  too_long: {
    en: "Your message is too long. POJU works best with focused, concise inputs. Please rephrase what's most important to you.",
    zh: "你的消息太长了。POJU 适合简洁聚焦的输入,请把对你最重要的部分重述一下。",
    es: "Tu mensaje es muy largo. POJU funciona mejor con mensajes concisos y enfocados. Por favor, reformula lo más importante.",
    fr: "Votre message est trop long. POJU fonctionne mieux avec des entrées concises et focalisées. Veuillez reformuler l'essentiel.",
    de: "Ihre Nachricht ist zu lang. POJU funktioniert am besten mit prägnanten, fokussierten Eingaben. Bitte formulieren Sie das Wichtigste neu.",
  },
  jailbreak: {
    en: "POJU has a single, consistent purpose: helping you with your original question. I won't change identity or scope. Let's return to what you came here for.",
    zh: "POJU 有它清晰的角色和目的:帮助你处理最初的问题。我不会改变身份或范围。让我们回到你想要解决的事情上。",
    es: "POJU tiene un propósito único y consistente: ayudarte con tu pregunta original. No cambiaré de identidad ni alcance. Volvamos a lo que viniste a resolver.",
    fr: "POJU a un objectif unique et cohérent : vous aider avec votre question initiale. Je ne changerai pas d'identité ni de portée. Revenons à ce pourquoi vous êtes venu.",
    de: "POJU hat einen einzigen, konsistenten Zweck: Ihnen bei Ihrer ursprünglichen Frage zu helfen. Ich werde meine Identität oder meinen Umfang nicht ändern. Kehren wir zu dem zurück, weswegen Sie hier sind.",
  },
  spam: {
    en: "I've received this message multiple times. If my previous response didn't help, could you tell me specifically what was missing?",
    zh: "我已经收到这条消息多次了。如果之前的回复没帮上你,可以具体告诉我缺了什么吗?",
    es: "He recibido este mensaje varias veces. Si mi respuesta anterior no te ayudó, ¿podrías decirme específicamente qué faltó?",
    fr: "J'ai reçu ce message plusieurs fois. Si ma réponse précédente n'a pas aidé, pouvez-vous me dire spécifiquement ce qui manquait ?",
    de: "Ich habe diese Nachricht mehrmals erhalten. Wenn meine vorherige Antwort nicht geholfen hat, könnten Sie mir konkret sagen, was gefehlt hat?",
  },
};

export function getRuleRejectionMessage(type: "too_long" | "jailbreak" | "spam", locale: string): string {
  const langCode = locale.split("-")[0];
  const messages = REJECTION_MESSAGES[type];
  return messages[langCode] || messages.en;
}
