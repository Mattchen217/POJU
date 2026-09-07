/**
 * Compress-mode vernacular jargon repair (Batch 3.5).
 * Auto-replace via mark plain-fallback map (zero LLM); unmapped → structural fail for existing fill retry.
 * Off-lock gate: body 命理专名 must ⊆ deep-evidence lock (chart_anchors ∪ ⟦w:⟧).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";
import { CLOSED_SHEN_SHA, CLOSED_TEN_GODS } from "@/lib/glossary/term-closed-set";
import {
  findConnectiveShortJargonOutsideSlots,
  MARK_CONNECTIVE_SHORT_JARGON_ZH,
  repairMarkConnectivePlainJargon,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { WORD_SLOT_PATTERN } from "@/lib/llm/sanitize/term-marking";
import type { DeepEvidencePlan } from "./deep-evidence-prompt";

type ProseSlot = {
  path: string;
  get: () => string;
  set: (v: string) => void;
};

function strField(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): ProseSlot | null {
  if (typeof obj[key] !== "string") return null;
  return {
    path,
    get: () => String(obj[key] ?? ""),
    set: (v: string) => {
      obj[key] = v;
    },
  };
}

function collectCompressProseSlots(
  pageKey: DeliverySegmentKey,
  candidate: Record<string, unknown>,
): ProseSlot[] {
  const slots: ProseSlot[] = [];
  const push = (s: ProseSlot | null) => {
    if (s) slots.push(s);
  };

  push(strField(candidate, "page_title", "page_title"));
  push(strField(candidate, "page_subtitle", "page_subtitle"));

  switch (pageKey) {
    case "direct_answer": {
      push(strField(candidate, "core_judgment", "core_judgment"));
      for (const role of ["primary", "backup"] as const) {
        const t = candidate[role];
        if (!t || typeof t !== "object") continue;
        const o = t as Record<string, unknown>;
        push(strField(o, "name", `${role}.name`));
        push(strField(o, "core_logic", `${role}.core_logic`));
        push(strField(o, "why", `${role}.why`));
        push(strField(o, "when", `${role}.when`));
        push(strField(o, "strategic_goal", `${role}.strategic_goal`));
        push(strField(o, "leverage_chip", `${role}.leverage_chip`));
      }
      break;
    }
    case "foundation": {
      const cards = Array.isArray(candidate.why_cards) ? candidate.why_cards : [];
      cards.forEach((c, i) => {
        if (!c || typeof c !== "object") return;
        const o = c as Record<string, unknown>;
        push(strField(o, "title", `why_cards[${i}].title`));
        push(strField(o, "surface", `why_cards[${i}].surface`));
        push(strField(o, "essence", `why_cards[${i}].essence`));
      });
      break;
    }
    case "science_action": {
      push(strField(candidate, "opening", "opening"));
      push(strField(candidate, "alert", "alert"));
      for (const role of ["primary_toolkit", "backup_toolkit"] as const) {
        const tk = candidate[role];
        if (!tk || typeof tk !== "object") continue;
        const tko = tk as Record<string, unknown>;
        push(strField(tko, "title", `${role}.title`));
        const angles = Array.isArray(tko.angles) ? tko.angles : [];
        angles.forEach((a, i) => {
          if (!a || typeof a !== "object") return;
          const ao = a as Record<string, unknown>;
          push(strField(ao, "name", `${role}.angles[${i}].name`));
          push(strField(ao, "strategy", `${role}.angles[${i}].strategy`));
          if (Array.isArray(ao.means)) {
            ao.means.forEach((m, mi) => {
              if (typeof m !== "string") return;
              slots.push({
                path: `${role}.angles[${i}].means[${mi}]`,
                get: () => String((ao.means as unknown[])[mi] ?? ""),
                set: (v: string) => {
                  (ao.means as unknown[])[mi] = v;
                },
              });
            });
          }
        });
      }
      break;
    }
    case "metaphysics_action": {
      push(strField(candidate, "question_anchor", "question_anchor"));
      push(strField(candidate, "desired_outcome", "desired_outcome"));
      const dims = Array.isArray(candidate.dimensions) ? candidate.dimensions : [];
      dims.forEach((d, i) => {
        if (!d || typeof d !== "object") return;
        const o = d as Record<string, unknown>;
        push(strField(o, "name", `dimensions[${i}].name`));
        push(strField(o, "strategy", `dimensions[${i}].strategy`));
        if (Array.isArray(o.means)) {
          o.means.forEach((m, mi) => {
            if (typeof m !== "string") return;
            slots.push({
              path: `dimensions[${i}].means[${mi}]`,
              get: () => String((o.means as unknown[])[mi] ?? ""),
              set: (v: string) => {
                (o.means as unknown[])[mi] = v;
              },
            });
          });
        }
      });
      break;
    }
    case "risk_guard": {
      const bags: Array<[string, unknown]> = [
        ["red_lights", candidate.red_lights],
        ["traps", candidate.traps],
        ["protection_rules", candidate.protection_rules],
      ];
      for (const [name, list] of bags) {
        if (!Array.isArray(list)) continue;
        list.forEach((item, i) => {
          if (!item || typeof item !== "object") return;
          const o = item as Record<string, unknown>;
          for (const f of ["situation", "then_do", "watch", "forbid", "narrative"] as const) {
            push(strField(o, f, `${name}[${i}].${f}`));
          }
        });
      }
      if (candidate.switch_to_backup && typeof candidate.switch_to_backup === "object") {
        const o = candidate.switch_to_backup as Record<string, unknown>;
        for (const f of ["situation", "then_do", "watch", "forbid", "narrative"] as const) {
          push(strField(o, f, `switch_to_backup.${f}`));
        }
      }
      break;
    }
    case "signals_close": {
      for (const f of [
        "identity_before",
        "identity_after",
        "identity_shift",
        "quote",
        "quote_use",
        "immediate_action",
        "tonight_done_looks_like",
        "tonight_why",
      ] as const) {
        push(strField(candidate, f, f));
      }
      const day7 = Array.isArray(candidate.day7_micro_actions)
        ? candidate.day7_micro_actions
        : [];
      day7.forEach((d, i) => {
        if (!d || typeof d !== "object") return;
        const o = d as Record<string, unknown>;
        push(strField(o, "action", `day7_micro_actions[${i}].action`));
        push(strField(o, "why", `day7_micro_actions[${i}].why`));
        push(strField(o, "done_when", `day7_micro_actions[${i}].done_when`));
      });
      if (Array.isArray(candidate.takeaways)) {
        candidate.takeaways.forEach((t, i) => {
          if (typeof t !== "string") return;
          slots.push({
            path: `takeaways[${i}]`,
            get: () => String((candidate.takeaways as unknown[])[i] ?? ""),
            set: (v: string) => {
              (candidate.takeaways as unknown[])[i] = v;
            },
          });
        });
      }
      break;
    }
    default:
      break;
  }
  return slots;
}

export type CompressJargonRepairResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Extra compounds often invented off-lock but not always in short-jargon / ban lists. */
const OFF_LOCK_EXTRA_TERMS_ZH = ["官杀", "杀印", "财官", "伤官配印", "从格", "化气"] as const;

/** Ranked dictionary for off-lock body scan (longer first). */
const OFF_LOCK_SCAN_TERMS_ZH: readonly string[] = (() => {
  const merged = new Set<string>();
  for (const t of BANNED_TERMS_ZH) {
    if (t.length >= 2) merged.add(t);
  }
  for (const t of MARK_CONNECTIVE_SHORT_JARGON_ZH) merged.add(t);
  for (const t of CLOSED_TEN_GODS) merged.add(t);
  for (const t of CLOSED_SHEN_SHA) merged.add(t);
  for (const t of OFF_LOCK_EXTRA_TERMS_ZH) merged.add(t);
  return [...merged].sort((a, b) => b.length - a.length);
})();

/** Allowlist = chart_anchors ∪ ⟦w:⟧ / ⟦词:⟧ inners from locked deep-evidence plan. */
export function lockedTermsFromDeepEvidencePlan(
  plan: DeepEvidencePlan | null | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!plan?.units?.length) return out;
  for (const u of plan.units) {
    for (const a of u.chart_anchors ?? []) {
      const t = String(a ?? "").trim();
      if (t) out.add(t);
    }
    const evidence = String(u.evidence ?? "");
    WORD_SLOT_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD_SLOT_PATTERN.exec(evidence)) !== null) {
      const inner = String(m[1] ?? "").trim();
      if (inner) out.add(inner);
    }
  }
  return out;
}

function termCoveredByAllowlist(term: string, allowlist: Set<string>): boolean {
  if (allowlist.has(term)) return true;
  for (const a of allowlist) {
    if (!a) continue;
    if (a.includes(term) || term.includes(a)) return true;
  }
  return false;
}

/**
 * First body 命理专名 not covered by lock allowlist, or null.
 * Skips when allowlist empty (no plan → do not invent a new fail mode).
 */
export function findCompressBodyOffLockTerm(
  pageKey: DeliverySegmentKey,
  candidate: Record<string, unknown>,
  allowlist: Set<string>,
): { term: string; path: string } | null {
  if (allowlist.size === 0) return null;
  for (const slot of collectCompressProseSlots(pageKey, candidate)) {
    const text = slot.get();
    if (!text.trim()) continue;
    for (const term of OFF_LOCK_SCAN_TERMS_ZH) {
      if (!text.includes(term)) continue;
      if (termCoveredByAllowlist(term, allowlist)) continue;
      return { term, path: slot.path };
    }
  }
  return null;
}

/**
 * Local auto-repair of short 命理 jargon in compress vernacular.
 * Unmapped hits → structural fail so existing fill attempt budget retries (no new counter).
 * When `deepEvidencePlan` is set: also enforce body 专名 ⊆ lock (compress_body_off_lock).
 */
export function repairCompressPageJargon(
  pageKey: DeliverySegmentKey,
  candidate: Record<string, unknown>,
  notes: string[],
  deepEvidencePlan?: DeepEvidencePlan | null,
): CompressJargonRepairResult {
  for (const slot of collectCompressProseSlots(pageKey, candidate)) {
    const raw = slot.get();
    if (!raw.trim()) continue;
    const { text: fixed, repaired_terms } = repairMarkConnectivePlainJargon(raw);
    if (repaired_terms.length > 0) {
      slot.set(fixed);
      for (const t of repaired_terms) {
        notes.push(`compress_body_jargon_auto_repaired:${t}@${slot.path}`);
      }
    }
    const leaked = findConnectiveShortJargonOutsideSlots(slot.get());
    if (leaked) {
      notes.push(`compress_body_jargon_unmapped:${leaked}@${slot.path}`);
      return { ok: false, reason: `compress_body_jargon:${leaked}` };
    }
  }

  const allowlist = lockedTermsFromDeepEvidencePlan(deepEvidencePlan);
  const off = findCompressBodyOffLockTerm(pageKey, candidate, allowlist);
  if (off) {
    notes.push(`compress_body_off_lock:${off.term}@${off.path}`);
    return { ok: false, reason: `compress_body_off_lock:${off.term}` };
  }
  return { ok: true };
}
