/**
 * M9 — narrow hooks shared by callPOJULLM and the authoritative chat wrapper.
 * Kept in a leaf module to avoid an agent ↔ chat ↔ llm import cycle.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import type { AdaptiveTurnTestHooks } from "@/lib/poju/decision-intake/adaptive-turn";
import {
  bindAuthoritativeChatHookRuntime,
  type TestChatModel,
} from "@/lib/poju/session-authority/chat-hook-bridge";

export type { TestChatModel } from "@/lib/poju/session-authority/chat-hook-bridge";

const llmCaptureAls = new AsyncLocalStorage<{ current?: POJULLMResponse }>();
const testModelAls = new AsyncLocalStorage<TestChatModel>();

export function runWithLlmCapture<T>(
  slot: { current?: POJULLMResponse },
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(llmCaptureAls.run(slot, fn));
}

export function captureAuthoritativeLlmResult(response: POJULLMResponse): void {
  const slot = llmCaptureAls.getStore();
  if (slot) slot.current = response;
}

export function getTestChatModel(): TestChatModel | undefined {
  return testModelAls.getStore();
}

export function runWithTestChatModel<T>(model: TestChatModel, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(testModelAls.run(model, fn));
}
const testHooksAls = new AsyncLocalStorage<AdaptiveTurnTestHooks>();

export function getAuthoritativeChatTestHooks(): AdaptiveTurnTestHooks | undefined {
  return testHooksAls.getStore();
}

export function runWithAuthoritativeChatTestHooks<T>(
  hooks: AdaptiveTurnTestHooks,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(testHooksAls.run(hooks, fn));
}

bindAuthoritativeChatHookRuntime({
  getTestChatModel,
  captureAuthoritativeLlmResult,
});
