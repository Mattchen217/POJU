import type { POJUMessage } from "@/lib/poju/types";
import type { POJUSessionState } from "@/lib/poju/types";

export type ConfirmationScriptKey = "intro" | "confirmed" | "generating";

const SCRIPTS: Record<string, Record<ConfirmationScriptKey, string>> = {
  en: {
    intro:
      "Here is a structured summary of what I understand about your situation so far. Please read each line carefully — edit anything that is wrong, delete what does not apply, or tell me in chat if you want me to change it.\n\nWhen it looks right, tap **Confirm and generate reading** below.",
    confirmed:
      "Thank you — your information is confirmed. I am now generating your detailed analysis on this device. Please wait…",
    generating: "Running deep situation analysis and your full reading (Steps 8–9)…",
  },
  zh: {
    intro:
      "以下是我目前对你处境的整理与总结，请逐条核对：若有出入可直接在表格里修改或删除，也可以在对话里告诉我，我来改。\n\n确认无误后，请点击下方的「确认并生成分析报告」。",
    confirmed: "信息已确认。我正在本机生成详细分析报告，请稍候…",
    generating: "正在进行困境深度分析与完整报告生成（Step 8–9）…",
  },
};

function lang(locale: string): string {
  const code = locale.split("-")[0];
  return SCRIPTS[code] ? code : "en";
}

export function confirmationScriptText(locale: string, key: ConfirmationScriptKey): string {
  return SCRIPTS[lang(locale)][key];
}

export function createConfirmationAssistantMessage(
  locale: string,
  key: ConfirmationScriptKey,
): POJUMessage {
  return {
    role: "assistant",
    content: confirmationScriptText(locale, key),
    timestamp: new Date().toISOString(),
    meta: {
      current_state: "awaiting_confirmation",
      user_intent: "sharing_situation",
      action_requested: "continue_chat",
    },
  };
}

export function appendConfirmationScriptMessage<T extends POJUSessionState>(
  session: T,
  locale: string,
  key: ConfirmationScriptKey,
): T {
  const msg = createConfirmationAssistantMessage(locale, key);
  const last = session.messages[session.messages.length - 1];
  if (last?.role === "assistant" && last.content === msg.content) {
    return session;
  }
  return { ...session, messages: [...session.messages, msg] };
}
