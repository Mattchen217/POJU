from pathlib import Path
p = Path("lib/poju/decision-intake/apply-answer-to-dc.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

old = '''export async function applyAnswerEventToSessionDc(
  session: POJUSessionState,
  event: AnswerEvent,
  opts?: { now?: string },
): Promise<ApplyAnswerResult> {
'''
new = '''export async function applyAnswerEventToSessionDc(
  session: POJUSessionState,
  event: AnswerEvent,
  opts?: { now?: string; allow_incremental_same_turn?: boolean },
): Promise<ApplyAnswerResult> {
'''
if old not in text:
    raise SystemExit("signature not found")
text = text.replace(old, new, 1)

old2 = '''  const persistableWrites = event.proposed_writes.filter(
    (w) => w.kind === "reality_fact" || w.kind === "constraint",
  );
  const incrementalWrites = persistableWrites.filter(
    (w) => !writeAlreadyPresent(dc, turnId, w.kind, w.statement),
  );
  // Same source_turn_id may legally add previously unresolved statements
  // after role clarification. Replay of already-written statements stays
  // idempotent. Do not change Constraint verification_level hardcoding.
  if (alreadyMapped(dc, turnId) && incrementalWrites.length === 0) {
    return {
      session,
      applied: false,
      skipped_reason: "turn_already_mapped",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }
'''
new2 = '''  const persistableWrites = event.proposed_writes.filter(
    (w): w is typeof w & { kind: "reality_fact" | "constraint" } =>
      w.kind === "reality_fact" || w.kind === "constraint",
  );
  const incrementalWrites = persistableWrites.filter(
    (w) => !writeAlreadyPresent(dc, turnId, w.kind, w.statement),
  );
  // Default: same source_turn_id is fully mapped (ordinary replay).
  // Incremental same-turn writes are only allowed for pending role-resolution
  // follow-ups (statements not yet written). Do not change Constraint
  // verification_level hardcoding.
  if (alreadyMapped(dc, turnId)) {
    if (!opts?.allow_incremental_same_turn || incrementalWrites.length === 0) {
      return {
        session,
        applied: false,
        skipped_reason: "turn_already_mapped",
        fact_ids_written: [],
        constraint_ids_written: [],
      };
    }
  }
'''
if old2 not in text:
    raise SystemExit("alreadyMapped block not found")
text = text.replace(old2, new2, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("apply incremental gated")
