import type { SignData, UserInput, FullReading } from "@/types/oracle";

const inFlightFullReadingRequests = new Map<string, Promise<FullReading>>();

export async function generateFullReading({
  sign,
  userInput,
  locale,
}: {
  sign: SignData;
  userInput: UserInput;
  /** next-intl 当前 locale，传给 LLM 语言指令 */
  locale: string;
}): Promise<FullReading> {
  const requestPayload = {
    sign_number: sign.sign_number,
    level: sign.level,
    user_birth: {
      year: userInput.birthYear,
      month: userInput.birthMonth,
      day: userInput.birthDay,
      shichen: userInput.birthShichen,
    },
    user_question: userInput.question,
    locale,
  };
  const requestKey = JSON.stringify(requestPayload);

  const pending = inFlightFullReadingRequests.get(requestKey);
  if (pending) return pending;

  const requestPromise = (async () => {
    const response = await fetch("/api/oracle/full-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as {
          error?: string;
          message?: string;
          details?: string;
        };
        errorMessage =
          errorData.error ||
          errorData.message ||
          errorData.details ||
          errorMessage;
      } catch {
        // Ignore JSON parse failures and keep status-based fallback.
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as {
      reading: FullReading;
      language?: string;
    };
    return data.reading;
  })().finally(() => {
    inFlightFullReadingRequests.delete(requestKey);
  });

  inFlightFullReadingRequests.set(requestKey, requestPromise);
  return requestPromise;
}
