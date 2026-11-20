from pathlib import Path
p = Path(r"lib/poju/shared/assistant-history-provenance.ts")
text = p.read_text(encoding="utf-8")
old = '''export async function resolveTrustedPromptHistory(
  session: { session_id: string; messages: POJUMessage[] },
  promptMessages: PromptHistoryTurn[],
): Promise<PromptHistoryTurn[]> {
  if (typeof window !== "undefined") {
    return applyAssistantHistoryProvenance(session.session_id, session.messages, promptMessages, {
      available: false,
    });
  }
  try {
    const { applyTrustedPromptHistory } = await import(
      /* webpackIgnore: true */
      "@/lib/poju/decision-authority/server/assistant-history-attestation"
    );
    return applyTrustedPromptHistory(session, promptMessages);
  } catch {
    return applyAssistantHistoryProvenance(session.session_id, session.messages, promptMessages, {
      available: false,
    });
  }
}
'''
new = '''function canLoadServerAttestationModule(): boolean {
  // Browser-only clients must not pull Node crypto. jsdom / test shims define
  // `window` inside Node, so Node process detection is the source of truth.
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

export async function resolveTrustedPromptHistory(
  session: { session_id: string; messages: POJUMessage[] },
  promptMessages: PromptHistoryTurn[],
): Promise<PromptHistoryTurn[]> {
  if (!canLoadServerAttestationModule()) {
    return applyAssistantHistoryProvenance(session.session_id, session.messages, promptMessages, {
      available: false,
    });
  }
  try {
    const { applyTrustedPromptHistory } = await import(
      /* webpackIgnore: true */
      "@/lib/poju/decision-authority/server/assistant-history-attestation"
    );
    return applyTrustedPromptHistory(session, promptMessages);
  } catch {
    return applyAssistantHistoryProvenance(session.session_id, session.messages, promptMessages, {
      available: false,
    });
  }
}
'''
if old not in text:
    raise SystemExit("loader not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("fixed server module loader for Node+jsdom")
