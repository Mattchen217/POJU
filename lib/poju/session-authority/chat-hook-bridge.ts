/**
 * Client-safe hook bridge for callPOJULLM.
 * The AsyncLocalStorage implementation lives in chat-hooks.ts and is bound
 * only when that server module is loaded.
 */

import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export type TestChatModel = (input: {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
  signal?: AbortSignal;
}) => Promise<POJULLMResponse>;

export type AuthoritativeChatHookRuntime = {
  getTestChatModel(): TestChatModel | undefined;
  captureAuthoritativeLlmResult(response: POJULLMResponse): void;
};

let runtime: AuthoritativeChatHookRuntime | null = null;

export function bindAuthoritativeChatHookRuntime(next: AuthoritativeChatHookRuntime): void {
  runtime = next;
}

export function getTestChatModel(): TestChatModel | undefined {
  return runtime?.getTestChatModel();
}

export function captureAuthoritativeLlmResult(response: POJULLMResponse): void {
  runtime?.captureAuthoritativeLlmResult(response);
}
