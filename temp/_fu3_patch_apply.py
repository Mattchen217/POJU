from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\apply-answer-to-dc.ts")
text = p.read_text(encoding="utf-8")

old_present = '''function writeAlreadyPresent(
  dc: DecisionContext,
  turnId: string,
  kind: "reality_fact" | "constraint",
  statement: string,
): boolean {
  const norm = normalizeComparable(statement);
  if (kind === "reality_fact") {
    return dc.reality_facts.some(
      (f) =>
        f.source_turn_id === turnId &&
        normalizeComparable(f.statement) === norm,
    );
  }
  return dc.constraints.some(
    (c) =>
      c.source_turn_id === turnId &&
      normalizeComparable(c.statement) === norm,
  );
}
'''
new_present = '''function sameIdSet(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = [...(a ?? [])].slice().sort();
  const right = [...(b ?? [])].slice().sort();
  if (left.length !== right.length) return false;
  return left.every((value, i) => value === right[i]);
}

function writeAlreadyPresent(
  dc: DecisionContext,
  turnId: string,
  kind: "reality_fact" | "constraint",
  statement: string,
  relatedDirIds: string[],
  factRoles: string[],
): boolean {
  const norm = normalizeComparable(statement);
  if (kind === "reality_fact") {
    return dc.reality_facts.some(
      (f) =>
        f.source_turn_id === turnId &&
        normalizeComparable(f.statement) === norm &&
        sameIdSet(f.related_dir_ids, relatedDirIds) &&
        sameIdSet(f.fact_roles, factRoles),
    );
  }
  return dc.constraints.some(
    (c) =>
      c.source_turn_id === turnId &&
      normalizeComparable(c.statement) === norm &&
      sameIdSet(c.related_dir_ids, relatedDirIds),
  );
}
'''
assert old_present in text, "writeAlreadyPresent not found"
text = text.replace(old_present, new_present)

old_sig = '''export async function applyAnswerEventToSessionDc(
  session: POJUSessionState,
  event: AnswerEvent,
  opts?: { now?: string; allow_incremental_same_turn?: boolean },
): Promise<ApplyAnswerResult> {
'''
new_sig = '''export type IncrementalSameTurnOpts = {
  pending_source_turn_id: string;
  pending_authorized_role_codes: string[];
  pending_authorized_dir_ids: string[];
  resolving_item_id: string;
};

export async function applyAnswerEventToSessionDc(
  session: POJUSessionState,
  event: AnswerEvent,
  opts?: {
    now?: string;
    allow_incremental_same_turn?: boolean;
    incremental?: IncrementalSameTurnOpts;
  },
): Promise<ApplyAnswerResult> {
'''
assert old_sig in text, "apply signature not found"
text = text.replace(old_sig, new_sig)

old_inc = '''  const incrementalWrites = persistableWrites.filter(
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
new_inc = '''  const incrementalWrites = persistableWrites.filter(
    (w) =>
      !writeAlreadyPresent(
        dc,
        turnId,
        w.kind,
        w.statement,
        w.related_dir_ids,
        w.fact_roles,
      ),
  );

  const incrementalAuthorized = (writes: typeof incrementalWrites): boolean => {
    const inc = opts?.incremental;
    if (!opts?.allow_incremental_same_turn || !inc) return false;
    if (inc.pending_source_turn_id !== turnId) return false;
    if (!inc.resolving_item_id) return false;
    const authorizedCodes = new Set(inc.pending_authorized_role_codes);
    const authorizedDirs = new Set(inc.pending_authorized_dir_ids);
    for (const w of writes) {
      if (!w.related_dir_ids.every((dirId) => authorizedDirs.has(dirId))) {
        return false;
      }
      // Role codes on the write are bare role names; also accept full codes.
      const writeRolesOk = w.fact_roles.every((role) => {
        if (authorizedCodes.has(role)) return true;
        return [...authorizedCodes].some(
          (code) => code.endsWith(`/role/${role}`) || code === role,
        );
      });
      if (!writeRolesOk) return false;
    }
    return true;
  };

  // Default: same source_turn_id is fully mapped (ordinary replay).
  // Incremental same-turn writes are only allowed for a legal pending bind
  // of an item identity not yet written, with role/DIR still in the
  // originally sent authorization set. Do not change Constraint
  // verification_level hardcoding. Do not loosen ordinary replay.
  if (alreadyMapped(dc, turnId)) {
    if (
      !opts?.allow_incremental_same_turn ||
      incrementalWrites.length === 0 ||
      !incrementalAuthorized(incrementalWrites)
    ) {
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
assert old_inc in text, "incremental block not found"
text = text.replace(old_inc, new_inc)

old_skip = '''    if (w.kind === "reality_fact" || w.kind === "constraint") {
      if (writeAlreadyPresent(dc, turnId, w.kind, w.statement)) {
        continue;
      }
    }
'''
new_skip = '''    if (w.kind === "reality_fact" || w.kind === "constraint") {
      if (
        writeAlreadyPresent(
          dc,
          turnId,
          w.kind,
          w.statement,
          w.related_dir_ids,
          w.fact_roles,
        )
      ) {
        continue;
      }
    }
'''
assert old_skip in text, "in-loop writeAlreadyPresent not found"
text = text.replace(old_skip, new_skip)

p.write_text(text, encoding="utf-8", newline="\n")
print("apply-answer-to-dc.ts patched")
