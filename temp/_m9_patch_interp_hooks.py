from pathlib import Path

h = Path(r"D:\POJU\pojulife\lib\poju\session-authority\chat-hooks.ts")
text = h.read_text(encoding="utf-8")
if "runWithAuthoritativeChatTestHooks" not in text:
    text = text.replace(
        'import type { UserProfile } from "@/lib/profile/types";\n',
        'import type { UserProfile } from "@/lib/profile/types";\nimport type { AdaptiveTurnTestHooks } from "@/lib/poju/decision-intake/adaptive-turn";\n',
        1,
    )
    text += '''
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
'''
    h.write_text(text, encoding="utf-8", newline="\n")
    print("patched chat-hooks.ts")
else:
    print("hooks already present")

c = Path(r"D:\POJU\pojulife\lib\poju\session-authority\chat.ts")
ct = c.read_text(encoding="utf-8")
if "getAuthoritativeChatTestHooks" not in ct:
    ct = ct.replace(
        '  runWithLlmCapture,\n} from "@/lib/poju/session-authority/chat-hooks";\n',
        '  getAuthoritativeChatTestHooks,\n  runWithLlmCapture,\n} from "@/lib/poju/session-authority/chat-hooks";\n',
        1,
    )
    ct = ct.replace(
        '''        server_invoke: {
          base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
          profile: body.profile ?? body.userProfile ?? null,
        },
''',
        '''        server_invoke: {
          base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
          profile: body.profile ?? body.userProfile ?? null,
        },
        __testOnlyM1Hooks: getAuthoritativeChatTestHooks(),
''',
        1,
    )
    c.write_text(ct, encoding="utf-8", newline="\n")
    print("patched chat.ts test hooks")
else:
    print("chat.ts hooks already present")

# wrap withModel in tests? Better wrap withStore so all tests get the hook.
t = Path(r"D:\POJU\pojulife\scripts\test-m9-server-authoritative-session.ts")
tt = t.read_text(encoding="utf-8")
if "runWithAuthoritativeChatTestHooks" not in tt:
    tt = tt.replace(
        'import { runWithTestChatModel } from "../lib/poju/session-authority/chat-hooks";\n',
        'import { runWithAuthoritativeChatTestHooks, runWithTestChatModel } from "../lib/poju/session-authority/chat-hooks";\nimport { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";\n',
        1,
    )
    old = '''async function withStore<T>(
  fn: (store: SessionAuthorityStore) => Promise<T>,
  store: SessionAuthorityStore = createMemorySessionAuthorityStore(),
): Promise<T> {
  return runWithSessionAuthorityStore(store, () => fn(store));
}
'''
    new = '''async function withStore<T>(
  fn: (store: SessionAuthorityStore) => Promise<T>,
  store: SessionAuthorityStore = createMemorySessionAuthorityStore(),
): Promise<T> {
  return runWithSessionAuthorityStore(store, () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), () => fn(store)),
  );
}
'''
    if old not in tt:
        raise SystemExit("withStore not found")
    tt = tt.replace(old, new, 1)
    t.write_text(tt, encoding="utf-8", newline="\n")
    print("patched test withStore")
else:
    print("test already patched")