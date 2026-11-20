from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\session-authority\chat.ts")
text = p.read_text(encoding="utf-8")
old = '''import { AsyncLocalStorage } from "node:async_hooks";

import { handleUserMessage } from "@/lib/poju/agent";
import type { POJULLMResponse } from "@/lib/llm/poju-llm";
'''
new = '''import { handleUserMessage } from "@/lib/poju/agent";
import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import {
  runWithLlmCapture,
} from "@/lib/poju/session-authority/chat-hooks";
'''
if old not in text:
    raise SystemExit("import block not found")
text = text.replace(old, new, 1)
start = text.find("const llmCaptureAls")
end = text.find("function requestedRevision")
if start < 0 or end < 0:
    raise SystemExit(f"markers missing {start} {end}")
replacement = '''export { runWithTestChatModel, getTestChatModel, captureAuthoritativeLlmResult } from "@/lib/poju/session-authority/chat-hooks";
export type { TestChatModel } from "@/lib/poju/session-authority/chat-hooks";

'''
text = text[:start] + replacement + text[end:]
text = text.replace(
    "sessionOut = await llmCaptureAls.run(capture, () =>",
    "sessionOut = await runWithLlmCapture(capture, () =>",
)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched chat.ts ok")