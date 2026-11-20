from pathlib import Path

# --- session-mutation.ts ---
p = Path(r"lib/poju/session-mutation.ts")
lines = p.read_text(encoding="utf-8").splitlines(True)

def find_line(needle, start=0):
    for i, line in enumerate(lines):
        if i < start:
            continue
        if needle in line:
            return i
    raise SystemExit(f"line not found: {needle!r}")

idx = find_line('import { AsyncLocalStorage } from "node:async_hooks";')
del lines[idx]
if idx < len(lines) and lines[idx].strip() == "":
    del lines[idx]

start = find_line("type MemorySessionPersistFrame = {")
end = find_line("function isMemorySessionPersistActive(): boolean {", start)
brace_end = end
while brace_end < len(lines) and lines[brace_end].strip() != "}":
    brace_end += 1
end_exclusive = brace_end + 1
if end_exclusive < len(lines) and lines[end_exclusive].strip() == "":
    end_exclusive += 1

replacement = """type MemorySessionPersistFrame = {
  sessions: Map<string, POJUSessionState>;
};

type MemorySessionPersistRuntime = {
  getStore(): MemorySessionPersistFrame | undefined;
};

let memorySessionPersistRuntime: MemorySessionPersistRuntime | null = null;

/** Bound by the server-only memory-persist module so this file stays client-safe. */
export function bindMemorySessionPersistRuntime(runtime: MemorySessionPersistRuntime): void {
  memorySessionPersistRuntime = runtime;
}

function memoryPersistedSession(sessionId: string): POJUSessionState | undefined {
  return memorySessionPersistRuntime?.getStore()?.sessions.get(sessionId);
}

function writeMemoryPersistedSession(state: POJUSessionState): void {
  memorySessionPersistRuntime?.getStore()?.sessions.set(state.session_id, state);
}

function isMemorySessionPersistActive(): boolean {
  return memorySessionPersistRuntime?.getStore() != null;
}

"""
lines[start:end_exclusive] = [replacement]
text = "".join(lines)
if not text.endswith("\n"):
    text += "\n"
if 'from "node:async_hooks"' in text or "from 'node:async_hooks'" in text:
    raise SystemExit("session-mutation still imports async_hooks")
if "export function runWithMemorySessionPersist" in text:
    raise SystemExit("session-mutation still defines runWithMemorySessionPersist")
if "bindMemorySessionPersistRuntime" not in text:
    raise SystemExit("bind helper missing")
p.write_text(text, encoding="utf-8")
print("patched session-mutation.ts")

# --- chat-hooks.ts ---
p = Path(r"lib/poju/session-authority/chat-hooks.ts")
text = p.read_text(encoding="utf-8")
old = '''import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import type { AdaptiveTurnTestHooks } from "@/lib/poju/decision-intake/adaptive-turn";

export type TestChatModel = (input: {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
  signal?: AbortSignal;
}) => Promise<POJULLMResponse>;
'''
new = '''import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import type { AdaptiveTurnTestHooks } from "@/lib/poju/decision-intake/adaptive-turn";
import {
  bindAuthoritativeChatHookRuntime,
  type TestChatModel,
} from "@/lib/poju/session-authority/chat-hook-bridge";

export type { TestChatModel } from "@/lib/poju/session-authority/chat-hook-bridge";
'''
if old not in text:
    raise SystemExit("chat-hooks type block not found")
text = text.replace(old, new, 1)
if "bindAuthoritativeChatHookRuntime({" not in text:
    if not text.endswith("\n"):
        text += "\n"
    text += """
bindAuthoritativeChatHookRuntime({
  getTestChatModel,
  captureAuthoritativeLlmResult,
});
"""
p.write_text(text, encoding="utf-8")
print("patched chat-hooks.ts")

# --- poju-llm.ts ---
p = Path(r"lib/llm/poju-llm.ts")
text = p.read_text(encoding="utf-8")
old = '} from "@/lib/poju/session-authority/chat-hooks";'
new = '} from "@/lib/poju/session-authority/chat-hook-bridge";'
if old not in text:
    raise SystemExit("poju-llm import not found")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("patched poju-llm.ts")

# --- chat.ts ---
p = Path(r"lib/poju/session-authority/chat.ts")
text = p.read_text(encoding="utf-8")
old = 'import { runWithMemorySessionPersist } from "@/lib/poju/session-mutation";'
new = 'import { runWithMemorySessionPersist } from "@/lib/poju/session-authority/memory-persist";'
if old not in text:
    raise SystemExit("chat.ts memory import not found")
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print("patched chat.ts")
