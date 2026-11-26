/**
 * M9 — narrow hooks shared by callPOJULLM and the authoritative chat wrapper.
 * Kept in a leaf module to avoid an agent ↔ chat ↔ llm import cycle.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import type { AdaptiveTurnTestHooks } from "@/lib/poju/decision-intake/adaptive-turn";
import type { UserProfile } from "@/lib/profile/types";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  bindAuthoritativeChatHookRuntime,
  type TestChatModel,
} from "@/lib/poju/session-authority/chat-hook-bridge";

export type { TestChatModel } from "@/lib/poju/session-authority/chat-hook-bridge";

export type AuthoritativeModelInputCapture = {
  profile: UserProfile | null;
  base_analysis: unknown | null;
  claimed_stored_profile_id: string | null;
  session_selected_stored_profile_id: string | null;
};

/** Test-only: runs immediately before the final authoritative Session CAS. */
export type AuthoritativeCommitTestHook = (ctx: {
  sessionId: string;
  expectedRevision: number;
  session: POJUSessionState;
}) => void | Promise<void>;

const llmCaptureAls = new AsyncLocalStorage<{ current?: POJULLMResponse }>();
const testModelAls = new AsyncLocalStorage<TestChatModel>();
const modelInputCaptureAls = new AsyncLocalStorage<{ current?: AuthoritativeModelInputCapture }>();

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

export function runWithAuthoritativeModelInputCapture<T>(
  slot: { current?: AuthoritativeModelInputCapture },
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(modelInputCaptureAls.run(slot, fn));
}

export function noteAuthoritativeModelInputs(input: AuthoritativeModelInputCapture): void {
  const slot = modelInputCaptureAls.getStore();
  if (slot) slot.current = input;
}

const testHooksAls = new AsyncLocalStorage<AdaptiveTurnTestHooks>();
const commitTestHookAls = new AsyncLocalStorage<AuthoritativeCommitTestHook>();

export function getAuthoritativeChatTestHooks(): AdaptiveTurnTestHooks | undefined {
  return testHooksAls.getStore();
}

export function runWithAuthoritativeChatTestHooks<T>(
  hooks: AdaptiveTurnTestHooks,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(testHooksAls.run(hooks, fn));
}

export function getAuthoritativeCommitTestHook(): AuthoritativeCommitTestHook | undefined {
  return commitTestHookAls.getStore();
}

export function runWithAuthoritativeCommitTestHook<T>(
  hook: AuthoritativeCommitTestHook,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(commitTestHookAls.run(hook, fn));
}

bindAuthoritativeChatHookRuntime({
  getTestChatModel,
  captureAuthoritativeLlmResult,
});
