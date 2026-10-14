/**
 * Companion step34+ entry lock SSOT (pure).
 *
 * Rule: Companion opens only after book.assemble has passed; once Assemble
 * passes (and delivery is not still Stage1–3 locked), entry must unlock.
 * P1+P3 page_schema remains a run-time gate, not the step-list entry key.
 */

export const BOOK_ASSEMBLE_STEP_KEY = "book.assemble";

export type CompanionEntryLockInput = {
  /** full_pipeline UI: true while Stage1–3 still owns the lab */
  delivery_steps_locked?: boolean;
  /** book.assemble step status from lab.steps */
  assemble_status?: string | null;
  /** approved_order includes book.assemble */
  assemble_in_approved_order?: boolean;
  /**
   * cursor_index past assemble index (approve Assemble advances cursor to
   * companion.seal). Optional; status / approved_order are enough.
   */
  cursor_index?: number;
  assemble_step_index?: number;
};

/** True when book.assemble has passed per Lab SSOT. */
export function isAssemblePassed(input: {
  assemble_status?: string | null;
  assemble_in_approved_order?: boolean;
  cursor_index?: number;
  assemble_step_index?: number;
}): boolean {
  if (input.assemble_status === "approved") return true;
  if (input.assemble_in_approved_order) return true;
  if (
    typeof input.cursor_index === "number" &&
    typeof input.assemble_step_index === "number" &&
    input.cursor_index > input.assemble_step_index
  ) {
    return true;
  }
  return false;
}

/**
 * Companion step-list / entry unlock.
 * - Locked while delivery_steps_locked (full_pipeline pre-unlock).
 * - Locked until Assemble passes.
 * - Unlocked once Assemble passes and delivery is not locked.
 */
export function isCompanionEntryUnlocked(input: CompanionEntryLockInput): boolean {
  if (input.delivery_steps_locked) return false;
  return isAssemblePassed(input);
}

/**
 * Step-list disabled predicate for a Companion def.
 * Entry requires Assemble; later Companion kinds also need seal brief.
 */
export function isCompanionStepListLocked(input: {
  delivery_steps_locked?: boolean;
  assemble_status?: string | null;
  assemble_in_approved_order?: boolean;
  cursor_index?: number;
  assemble_step_index?: number;
  kind: string;
  companion_seal_ready: boolean;
}): boolean {
  if (
    !isCompanionEntryUnlocked({
      delivery_steps_locked: input.delivery_steps_locked,
      assemble_status: input.assemble_status,
      assemble_in_approved_order: input.assemble_in_approved_order,
      cursor_index: input.cursor_index,
      assemble_step_index: input.assemble_step_index,
    })
  ) {
    return true;
  }
  if (input.kind !== "companion_seal" && !input.companion_seal_ready) {
    return true;
  }
  return false;
}
