from pathlib import Path

# oriental-prompt-context.ts
p = Path(r"lib/llm/phases/oriental-prompt-context.ts")
text = p.read_text(encoding="utf-8")
if "resolveTrustedPromptHistory" not in text:
    text = text.replace(
        'import type { PhaseLLMInput } from "@/lib/llm/phases/types";\n',
        'import type { PhaseLLMInput } from "@/lib/llm/phases/types";\nimport { resolveTrustedPromptHistory } from "@/lib/poju/shared/assistant-history-provenance";\n',
        1,
    )
    # Change buildPhaseTurnContext to accept optional conversation history
    old = '''export function buildPhaseTurnContext(input: PhaseLLMInput, taskBlock: string): string {
  const uiLocale = parseAppLocale(input.locale);
  const outLoc = resolvePivotSessionLang(input.session, input.locale);
  const langDirective = getPojuChatLanguageDirective({
    locale: uiLocale,
    userInput: input.user_message,
    conversationHistory: sanitizeClientPromptHistory(
      input.session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ),
    forcedOutputLocale: outLoc,
  });'''
    new = '''export function buildPhaseTurnContext(
  input: PhaseLLMInput,
  taskBlock: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const uiLocale = parseAppLocale(input.locale);
  const outLoc = resolvePivotSessionLang(input.session, input.locale);
  const langDirective = getPojuChatLanguageDirective({
    locale: uiLocale,
    userInput: input.user_message,
    conversationHistory: conversationHistory ?? sanitizeClientPromptHistory(
      input.session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ),
    forcedOutputLocale: outLoc,
  });'''
    if old not in text:
        raise SystemExit("buildPhaseTurnContext needle not found")
    text = text.replace(old, new, 1)

    old2 = '''  const system = await buildPojuSystemPrompt(input);
  const turnContext = buildPhaseTurnContext(input, taskBlock);
  const base = sanitizeClientPromptHistory(
    messageHistory ?? formatPhaseMessageHistory(input.session.messages),
  );
  return {
    system,
    messages: applyTurnContext(base, turnContext),
  };'''
    new2 = '''  const system = await buildPojuSystemPrompt(input);
  const base = await resolveTrustedPromptHistory(
    input.session,
    sanitizeClientPromptHistory(
      messageHistory ?? formatPhaseMessageHistory(input.session.messages),
    ),
  );
  const turnContext = buildPhaseTurnContext(input, taskBlock, base);
  return {
    system,
    messages: applyTurnContext(base, turnContext),
  };'''
    if old2 not in text:
        raise SystemExit("buildPhaseTransportInput needle not found")
    text = text.replace(old2, new2, 1)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("patched oriental-prompt-context.ts")
else:
    print("oriental-prompt-context.ts already patched")

# v6
p = Path(r"lib/llm/phases/oriental-prompt-context-v6.ts")
text = p.read_text(encoding="utf-8")
if "resolveTrustedPromptHistory" not in text:
    # find the import from phase-transport and add after the block ending
    needle = '} from "@/lib/llm/phases/phase-transport";'
    if needle not in text:
        raise SystemExit("v6 phase-transport import not found")
    text = text.replace(
        needle,
        needle + '\nimport { resolveTrustedPromptHistory } from "@/lib/poju/shared/assistant-history-provenance";',
        1,
    )

    old = '''export async function buildPhaseTurnContextV6(
  input: PhaseLLMInput,
  taskBlock: string,
): Promise<string> {'''
    new = '''export async function buildPhaseTurnContextV6(
  input: PhaseLLMInput,
  taskBlock: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {'''
    if old not in text:
        raise SystemExit("buildPhaseTurnContextV6 signature not found")
    text = text.replace(old, new, 1)

    old = '''    conversationHistory: sanitizeClientPromptHistory(
      input.session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ),'''
    new = '''    conversationHistory: conversationHistory ?? sanitizeClientPromptHistory(
      input.session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ),'''
    if old not in text:
        raise SystemExit("v6 conversationHistory needle not found")
    text = text.replace(old, new, 1)

    old2 = '''  const system = buildPojuSystemPromptV6Sync();
  const turnContext = await buildPhaseTurnContextV6(input, taskBlock);
  const base = sanitizeClientPromptHistory(
    messageHistory ?? formatPhaseMessageHistory(input.session.messages),
  );'''
    new2 = '''  const system = buildPojuSystemPromptV6Sync();
  const base = await resolveTrustedPromptHistory(
    input.session,
    sanitizeClientPromptHistory(
      messageHistory ?? formatPhaseMessageHistory(input.session.messages),
    ),
  );
  const turnContext = await buildPhaseTurnContextV6(input, taskBlock, base);'''
    if old2 not in text:
        raise SystemExit("buildPhaseTransportInputV6 needle not found")
    text = text.replace(old2, new2, 1)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("patched oriental-prompt-context-v6.ts")
else:
    print("v6 already patched")
