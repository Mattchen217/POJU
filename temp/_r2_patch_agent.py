from pathlib import Path
p = Path(r"lib/poju/agent.ts")
text = p.read_text(encoding="utf-8")

# import bind helper
old = 'import { chatPayloadFromWire } from "@/lib/poju/serialize-chat-payload";\n'
new = '''import { chatPayloadFromWire } from "@/lib/poju/serialize-chat-payload";
import { bindStoredAssistantAttestation } from "@/lib/poju/shared/assistant-history-provenance";
import type { AssistantHistoryAttestation } from "@/lib/poju/types";
'''
if "bindStoredAssistantAttestation" not in text:
    if old not in text:
        raise SystemExit("chatPayloadFromWire import not found")
    text = text.replace(old, new, 1)

# LLMApiPayload
old = "  llm_debug?: import(\"@/lib/llm/llm-debug\").LLMCallDebug;\n};"
# this might match more than once? check count
count = text.count(old)
print("LLMApiPayload-like needle count", count)
# more unique:
old = '''  conversion_envelope_failed?: boolean;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
};'''
new = '''  conversion_envelope_failed?: boolean;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
  assistant_history_attestation?: AssistantHistoryAttestation;
};'''
if text.count(old) != 1:
    raise SystemExit(f"LLMApiPayload block count {text.count(old)}")
text = text.replace(old, new, 1)

# Promise type of callLLMViaAPI
old = '''  conversion_envelope_failed?: boolean;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
}> {'''
new = '''  conversion_envelope_failed?: boolean;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
  assistant_history_attestation?: AssistantHistoryAttestation;
}> {'''
if text.count(old) != 1:
    raise SystemExit(f"Promise type count {text.count(old)}")
text = text.replace(old, new, 1)

# callPOJULLMDirect: attest after call and include in return
old = '''  const r = await callPOJULLM({
    session: input.session,
    profile: input.profile,
    base_analysis: input.base_analysis ?? null,
    archive_data: input.archive_data ?? null,
    locale: input.locale,
    tool_injection_context: input.tool_injection_context ?? null,
    signal: input.signal,
    attachment: input.attachment ?? null,
    lab_prompt_capture: input.lab_prompt_capture,
  });
  return {'''
new = '''  const r = await callPOJULLM({
    session: input.session,
    profile: input.profile,
    base_analysis: input.base_analysis ?? null,
    archive_data: input.archive_data ?? null,
    locale: input.locale,
    tool_injection_context: input.tool_injection_context ?? null,
    signal: input.signal,
    attachment: input.attachment ?? null,
    lab_prompt_capture: input.lab_prompt_capture,
  });
  let assistant_history_attestation: AssistantHistoryAttestation | undefined;
  try {
    const { signAssistantHistoryAttestation } = await import(
      /* webpackIgnore: true */
      "@/lib/poju/decision-authority/server/assistant-history-attestation"
    );
    assistant_history_attestation = signAssistantHistoryAttestation(input.session.session_id, r.response) ?? undefined;
  } catch {
    assistant_history_attestation = undefined;
  }
  return {'''
if old not in text:
    raise SystemExit("callPOJULLMDirect call site not found")
text = text.replace(old, new, 1)

old = "    conversion_envelope_failed: r.conversion_envelope_failed,\n    llm_debug: r.llm_debug,\n  };"
new = "    conversion_envelope_failed: r.conversion_envelope_failed,\n    llm_debug: r.llm_debug,\n    assistant_history_attestation,\n  };"
if text.count(old) != 1:
    raise SystemExit(f"direct return count {text.count(old)}")
text = text.replace(old, new, 1)

# mapLlmApiPayload return
old = '''    llm_debug:
      wire.llm_debug && typeof wire.llm_debug === "object" && !Array.isArray(wire.llm_debug)
        ? (wire.llm_debug as import("@/lib/llm/llm-debug").LLMCallDebug)
        : undefined,
  };
}'''
new = '''    llm_debug:
      wire.llm_debug && typeof wire.llm_debug === "object" && !Array.isArray(wire.llm_debug)
        ? (wire.llm_debug as import("@/lib/llm/llm-debug").LLMCallDebug)
        : undefined,
    assistant_history_attestation: bindStoredAssistantAttestation(
      wire.assistant_history_attestation,
      text,
      text,
    ),
  };
}'''
if old not in text:
    raise SystemExit("mapLlmApiPayload return not found")
text = text.replace(old, new, 1)

# Before assistantMessage construction, resolve stored attestation
old = "  const assistantMessage: POJUMessage = {\n    role: \"assistant\",\n    content: finalContent,"
new = '''  let storedAttestation = bindStoredAssistantAttestation(
    llmResponse.assistant_history_attestation,
    llmResponse.response,
    finalContent,
  );
  if (input.server_invoke && typeof window === "undefined") {
    try {
      const { signAssistantHistoryAttestation } = await import(
        /* webpackIgnore: true */
        "@/lib/poju/decision-authority/server/assistant-history-attestation"
      );
      storedAttestation =
        signAssistantHistoryAttestation(sessionForLlm.session_id, finalContent) ?? storedAttestation;
    } catch {
      /* keep the API-bound attestation if re-signing is unavailable */
    }
  }

  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: finalContent,'''
if old not in text:
    raise SystemExit("assistantMessage construction not found")
text = text.replace(old, new, 1)

old = '''      ...(isPojuEmptyGenerationMessage(finalContent)
        ? { kind: "generation_incomplete" as const }
        : isPojuInfrastructureFailureMessage(finalContent)
          ? { kind: "infra_busy" as const }
          : {}),
    },
  };'''
new = '''      ...(isPojuEmptyGenerationMessage(finalContent)
        ? { kind: "generation_incomplete" as const }
        : isPojuInfrastructureFailureMessage(finalContent)
          ? { kind: "infra_busy" as const }
          : {}),
      ...(storedAttestation ? { assistant_history_attestation: storedAttestation } : {}),
    },
  };'''
if old not in text:
    raise SystemExit("assistant meta tail not found")
text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("patched agent.ts")
