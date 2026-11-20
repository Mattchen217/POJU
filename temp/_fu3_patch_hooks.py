from pathlib import Path

# --- adaptive-turn.ts: extend hooks + pass persistOverride ---
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old_hooks = '''export type AdaptiveTurnTestHooks = {
  /** @internal Test-only. Runs immediately before each Understanding build. */
  beforeUnderstandingBuild?: () => void;
};'''

new_hooks = '''export type AdaptiveTurnTestHooks = {
  /** @internal Test-only. Runs immediately before each Understanding build. */
  beforeUnderstandingBuild?: () => void;
  /**
   * @internal Test-only C1 substitute for Conflict-clarification persist.
   * When omitted (production default), persistDcLifecycleChange is used.
   * Must never be set outside tests.
   */
  conflictClarifyPersist?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
};'''

if old_hooks not in text:
    raise SystemExit("AdaptiveTurnTestHooks block not found")
text = text.replace(old_hooks, new_hooks, 1)

old_call = '''      return handleConflictClarificationAnswer({
        current,
        original: input.session,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        target: clarifyTarget,
        buildUnderstanding,
        planFromState,
        withUnderstanding,
        outcomeFromPlanResult,
        errorText,
      });'''

new_call = '''      return handleConflictClarificationAnswer({
        current,
        original: input.session,
        statement,
        source_turn_id: input.source_turn_id,
        now: input.now,
        target: clarifyTarget,
        buildUnderstanding,
        planFromState,
        withUnderstanding,
        outcomeFromPlanResult,
        errorText,
        persistOverride: input.test_hooks?.conflictClarifyPersist,
      });'''

if old_call not in text:
    raise SystemExit("handleConflictClarificationAnswer call not found")
text = text.replace(old_call, new_call, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched adaptive-turn.ts")

# --- conflict-clarification-turn.ts ---
q = Path("lib/poju/decision-intake/conflict-clarification-turn.ts")
t2 = q.read_text(encoding="utf-8")

old_sig = '''export async function handleConflictClarificationAnswer(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  target: ConflictClarificationTarget;
} & ConflictClarificationTurnDeps): Promise<AdaptiveTurnResult> {'''

new_sig = '''export async function handleConflictClarificationAnswer(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  target: ConflictClarificationTarget;
  /**
   * @internal Test-only. Substitutes persistDcLifecycleChange for C1 fault injection.
   * Production callers must omit this so the official lifecycle persist is used.
   */
  persistOverride?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
} & ConflictClarificationTurnDeps): Promise<AdaptiveTurnResult> {'''

if old_sig not in t2:
    raise SystemExit("handleConflictClarificationAnswer signature not found")
t2 = t2.replace(old_sig, new_sig, 1)

old_persist = '''    const persisted = await persistDcLifecycleChange(
      input.original,
      nextSession,
      key,
    );'''

new_persist = '''    const persistFn = input.persistOverride ?? persistDcLifecycleChange;
    const persisted = await persistFn(
      input.original,
      nextSession,
      key,
    );'''

if old_persist not in t2:
    raise SystemExit("persistDcLifecycleChange call not found")
t2 = t2.replace(old_persist, new_persist, 1)
q.write_text(t2, encoding="utf-8", newline="\n")
print("patched conflict-clarification-turn.ts")