/** Greetings / placeholders that must not trigger deep reckoning (breakthrough-core). */
const GREETING_ONLY =
  /^(你好|您好|hi|hello|嗨|在吗|test|测试|早上好|晚上好|。|\.)+$/i;

/** True when user input is greeting / test / too thin to anchor breakthrough. */
export function isGreetingOrEmptyQuestion(text: string | null | undefined): boolean {
  const q = (text ?? "").trim();
  if (!q || q.length < 4) return true;
  if (GREETING_ONLY.test(q)) return true;
  return false;
}

/** True when session question is substantive enough to anchor breakthrough-core. */
export function isSubstantiveBreakthroughQuestion(question: string | null | undefined): boolean {
  return !isGreetingOrEmptyQuestion(question);
}
