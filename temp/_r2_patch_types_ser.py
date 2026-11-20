from pathlib import Path

# --- types.ts ---
p = Path(r"lib/poju/types.ts")
text = p.read_text(encoding="utf-8")
needle = "export interface POJUMessage {"
insert = '''export interface AssistantHistoryAttestation {
  v: 1;
  alg: "hmac-sha256";
  sig: string;
  /** Exact signed text when it differs from `content`. */
  content?: string;
}

'''
if "export interface AssistantHistoryAttestation" not in text:
    text = text.replace(needle, insert + needle, 1)

meta_needle = "    /** DI2 terminal input refusal; inspectable without reopening the frozen DC. */"
meta_insert = '''    /**
     * Server HMAC attestation for this assistant turn (M8-R1-FU1-R2).
     * Presence is not proof; Prompt construction verifies the signature
     * with the server-only authority secret. Clients must not mint this.
     */
    assistant_history_attestation?: AssistantHistoryAttestation;
    /** DI2 terminal input refusal; inspectable without reopening the frozen DC. */'''
if "assistant_history_attestation?: AssistantHistoryAttestation" not in text:
    if meta_needle not in text:
        raise SystemExit("types.ts meta needle not found")
    text = text.replace(meta_needle, meta_insert, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched types.ts")

# --- serialize-chat-payload.ts ---
p = Path(r"lib/poju/serialize-chat-payload.ts")
text = p.read_text(encoding="utf-8")
if '"assistant_history_attestation"' not in text:
    text = text.replace(
        '  "llm_debug",\n] as const;',
        '  "llm_debug",\n  "assistant_history_attestation",\n] as const;',
        1,
    )
# attach pass-through in pojuLlmToChatPayload before ...overrides
old = "    llm_debug: llm.llm_debug,\n    ...overrides,"
new = """    llm_debug: llm.llm_debug,
    assistant_history_attestation: (llm as { assistant_history_attestation?: unknown }).assistant_history_attestation,
    ...overrides,"""
if "assistant_history_attestation: (llm as" not in text:
    if old not in text:
        raise SystemExit("pojuLlmToChatPayload needle not found")
    text = text.replace(old, new, 1)

old2 = """    llm_debug:
      data.llm_debug && typeof data.llm_debug === "object" && !Array.isArray(data.llm_debug)
        ? (data.llm_debug as import("@/lib/llm/llm-debug").LLMCallDebug)
        : undefined,
  });
}"""
new2 = """    llm_debug:
      data.llm_debug && typeof data.llm_debug === "object" && !Array.isArray(data.llm_debug)
        ? (data.llm_debug as import("@/lib/llm/llm-debug").LLMCallDebug)
        : undefined,
    assistant_history_attestation: parseAssistantHistoryAttestationFromWire(
      data.assistant_history_attestation,
    ),
  });
}

function parseAssistantHistoryAttestationFromWire(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  if (rec.v !== 1 || rec.alg !== "hmac-sha256" || typeof rec.sig !== "string" || !rec.sig.trim()) {
    return undefined;
  }
  const parsed: { v: 1; alg: "hmac-sha256"; sig: string; content?: string } = {
    v: 1,
    alg: "hmac-sha256",
    sig: rec.sig.trim(),
  };
  if (typeof rec.content === "string") parsed.content = rec.content;
  return parsed;
}"""
if "parseAssistantHistoryAttestationFromWire" not in text:
    if old2 not in text:
        raise SystemExit("chatPayloadFromWire needle not found")
    text = text.replace(old2, new2, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched serialize-chat-payload.ts")
