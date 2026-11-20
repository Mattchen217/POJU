from pathlib import Path

# --- poju-llm.ts ---
p = Path(r"D:\POJU\pojulife\lib\llm\poju-llm.ts")
text = p.read_text(encoding="utf-8")
needle = '''import { getLocalIntakeTerminalReason, POJUIntakeTerminalError } from "@/lib/poju/intake-terminal";
'''
insert = '''import { getLocalIntakeTerminalReason, POJUIntakeTerminalError } from "@/lib/poju/intake-terminal";
import {
  captureAuthoritativeLlmResult,
  getTestChatModel,
} from "@/lib/poju/session-authority/chat-hooks";
'''
if needle not in text:
    raise SystemExit("poju-llm import needle not found")
text = text.replace(needle, insert, 1)

old = '''  if (typeof window === "undefined") {
    const { assertSessionCanEnterIntake } = await import(
      /* webpackIgnore: true */
      "@/lib/poju/decision-authority/server/intake-guard"
    );
    await assertSessionCanEnterIntake(session);
  }

  try {
    if (!isOpenRouterConfigured() && !getGeminiClient()) {
      return emptyFailureResponse(
        session,
        input.locale,
        GEMINI_PRIMARY_MODEL,
      );
    }

    return finalizeLockFields(await callPOJULLMPhasePath(input), session);
'''
new = '''  if (typeof window === "undefined") {
    const { assertSessionCanEnterIntake } = await import(
      /* webpackIgnore: true */
      "@/lib/poju/decision-authority/server/intake-guard"
    );
    await assertSessionCanEnterIntake(session);
  }

  const testModel = getTestChatModel();
  if (testModel) {
    const response = finalizeLockFields(
      await testModel({
        session,
        profile: input.profile,
        locale: input.locale,
        signal: input.signal,
      }),
      session,
    );
    captureAuthoritativeLlmResult(response);
    return response;
  }

  try {
    if (!isOpenRouterConfigured() && !getGeminiClient()) {
      const failure = emptyFailureResponse(
        session,
        input.locale,
        GEMINI_PRIMARY_MODEL,
      );
      captureAuthoritativeLlmResult(failure);
      return failure;
    }

    const response = finalizeLockFields(await callPOJULLMPhasePath(input), session);
    captureAuthoritativeLlmResult(response);
    return response;
'''
if old not in text:
    raise SystemExit("poju-llm call body not found")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched poju-llm.ts")

# --- agent.ts: short-circuit on authoritative_session ---
a = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
agent = a.read_text(encoding="utf-8")
old_llm = '''  const llmResponse = input.server_invoke
    ? await callPOJULLMDirect({
        session: sessionForLlm,
        profile,
        base_analysis,
        archive_data,
        locale: sessionOutputLocale,
        signal,
        tool_injection_context: injectionPrep.tool_injection_context,
        attachment: attachment ?? null,
        lab_prompt_capture: input.server_invoke.lab_prompt_capture,
      })
    : await callLLMViaAPI({
        session: sessionForLlm,
        profile,
        base_analysis,
        archive_data,
        // Process language SSOT — never the website UI locale once lock/sample resolves.
        locale: sessionOutputLocale,
        signal,
        tool_injection_context: injectionPrep.tool_injection_context,
        attachment: attachment ?? null,
      });

  workingSession = finalizeToolInjectionTurn(workingSession, injectionPrep.pending);
'''
new_llm = '''  const llmResponse = input.server_invoke
    ? await callPOJULLMDirect({
        session: sessionForLlm,
        profile,
        base_analysis,
        archive_data,
        locale: sessionOutputLocale,
        signal,
        tool_injection_context: injectionPrep.tool_injection_context,
        attachment: attachment ?? null,
        lab_prompt_capture: input.server_invoke.lab_prompt_capture,
      })
    : await callLLMViaAPI({
        session: sessionForLlm,
        profile,
        base_analysis,
        archive_data,
        // Process language SSOT — never the website UI locale once lock/sample resolves.
        locale: sessionOutputLocale,
        signal,
        tool_injection_context: injectionPrep.tool_injection_context,
        attachment: attachment ?? null,
      });

  if (llmResponse.authoritative_session) {
    return ensureSessionCycles(llmResponse.authoritative_session);
  }

  workingSession = finalizeToolInjectionTurn(workingSession, injectionPrep.pending);
'''
if old_llm not in agent:
    raise SystemExit("agent llm block not found")
agent = agent.replace(old_llm, new_llm, 1)

old_fetch = '''  const data = (await response.json().catch(() => ({}))) as LLMApiPayload & { error?: string };
  if (
    data.error === "openrouter_provider_queue" ||
    (!response.ok && response.status === 503)
  ) {
    const err = new Error("openrouter_provider_queue");
    err.name = "OpenRouterProviderQueueError";
    throw err;
  }
  if (!response.ok) {
    throw new Error(`/api/poju/chat returned HTTP ${response.status}`);
  }
  if (data.error) {
    throw new Error(String(data.error));
  }
  return mapLlmApiPayload(data, input.session);
'''
new_fetch = '''  const data = (await response.json().catch(() => ({}))) as LLMApiPayload & {
    error?: string;
    code?: string;
    message?: string;
    authoritative_session?: POJUSessionState;
  };
  if (
    data.error === "openrouter_provider_queue" ||
    (!response.ok && response.status === 503 && data.error !== "session_authority")
  ) {
    const err = new Error("openrouter_provider_queue");
    err.name = "OpenRouterProviderQueueError";
    throw err;
  }
  if (!response.ok) {
    const err = new Error(
      data.message || data.error || `/api/poju/chat returned HTTP ${response.status}`,
    );
    if (data.error === "session_authority" && typeof data.code === "string") {
      err.name = "SessionAuthorityError";
      (err as Error & { code?: string }).code = data.code;
    }
    throw err;
  }
  if (data.error) {
    throw new Error(String(data.error));
  }
  const mapped = mapLlmApiPayload(data, data.authoritative_session ?? input.session);
  if (data.authoritative_session && typeof data.authoritative_session === "object") {
    return { ...mapped, authoritative_session: data.authoritative_session };
  }
  return mapped;
'''
if old_fetch not in agent:
    raise SystemExit("agent fetch block not found")
agent = agent.replace(old_fetch, new_fetch, 1)
a.write_text(agent, encoding="utf-8", newline="\n")
print("patched agent.ts")