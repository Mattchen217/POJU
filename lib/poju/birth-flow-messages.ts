import type { POJUMessage } from "@/lib/poju/types";

export type BirthFlowScriptKey =
  | "intro"
  | "received"
  | "analyzing"
  | "analysis_done"
  | "analysis_failed";

const SCRIPTS: Record<string, Record<BirthFlowScriptKey, string>> = {
  en: {
    intro:
      "To go deeper on your situation, I need a few personal details for a BaZi chart. Everything stays on **this device only**—nothing is uploaded to our servers.\n\nWhen you're ready, tap below to fill in birth date, time, and gender.",
    received:
      "Thank you — I've received your birth details and saved them on this device.",
    analyzing:
      "I'm running your base chart analysis now. This may take a minute; please wait…",
    analysis_done:
      "Your base chart analysis is ready. Let's continue our conversation — tell me what still feels unclear or what you'd like to focus on next.",
    analysis_failed:
      "Your birth details are saved, but the deep chart analysis didn't finish. You can keep chatting; we'll retry analysis when you send your next message.",
  },
  zh: {
    intro:
      "为了更准确地理解你的处境，我需要收集一些**个性化出生信息**用于八字排盘。\n\n请放心：这些数据**只会保存在你的电脑上**，不会上传到服务器。\n\n准备好后，请点击下方按钮填写出生年月、时辰与性别。",
    received: "谢谢，我已收到你的出生信息，并已保存在本机。",
    analyzing: "正在为你做命主基础分析，可能需要一两分钟，请稍候…",
    analysis_done: "基础分析已完成。我们继续聊——你可以补充细节，或告诉我你现在最想弄清的一点。",
    analysis_failed:
      "出生信息已保存在本机，但深度命盘分析尚未完成。你可以先继续对话，稍后我们会自动重试分析。",
  },
};

function lang(locale: string): string {
  const code = locale.split("-")[0];
  return SCRIPTS[code] ? code : "en";
}

export function birthFlowScriptText(locale: string, key: BirthFlowScriptKey): string {
  return SCRIPTS[lang(locale)][key];
}

export function createBirthFlowAssistantMessage(locale: string, key: BirthFlowScriptKey): POJUMessage {
  return {
    role: "assistant",
    content: birthFlowScriptText(locale, key),
    timestamp: new Date().toISOString(),
    meta: {
      current_state: "collecting_context",
      user_intent: "sharing_situation",
      action_requested: "continue_chat",
    },
  };
}

export function appendBirthFlowMessage<T extends { messages: POJUMessage[] }>(
  session: T,
  locale: string,
  key: BirthFlowScriptKey,
): T {
  const msg = createBirthFlowAssistantMessage(locale, key);
  const last = session.messages[session.messages.length - 1];
  if (last?.role === "assistant" && last.content === msg.content) {
    return session;
  }
  return { ...session, messages: [...session.messages, msg] };
}
