# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\pending-answer-resolution.ts")
text = p.read_text(encoding="utf-8")

# 1) Extend AuthorizedRoleOption + helpers + rewrite parsers
old_opt = '''export type AuthorizedRoleOption = {
  index: number;
  role_code: string;
  role: string;
  dir_id: string;
  need: string;
};
'''
new_opt = '''export type AuthorizedRoleOption = {
  index: number;
  role_code: string;
  role: string;
  dir_id: string;
  need: string;
  aliases: string[];
};

export function isActivePendingAnswerResolution(
  pending: PendingAnswerResolution | null | undefined,
): boolean {
  if (!pending) return false;
  if (pending.status !== "pending") return false;
  return normalizePendingItems(pending.unresolved_items).length > 0;
}

export function asTerminalRejectedPending(
  pending: PendingAnswerResolution,
): PendingAnswerResolution {
  return {
    ...pending,
    status: "rejected",
    unresolved_items: [],
    clarification_plan: null,
    clarification_plan_id: null,
    resolving_item_id: null,
  };
}

export function isPendingClarificationPlan(
  plan: AdaptiveQuestionPlan | null | undefined,
): boolean {
  if (!plan) return false;
  return (
    String(plan.ask_now_reason ?? "").includes("pending_answer_resolution") ||
    String(plan.scoring_path ?? "").includes("pending_answer_resolution") ||
    /(?:^|_)clarify(?:_|$)/.test(plan.plan_id) ||
    plan.plan_id.startsWith("qp_role_clarify") ||
    plan.plan_id.startsWith("qp_certainty_clarify") ||
    plan.plan_id.startsWith("qp_constraint_clarify") ||
    plan.plan_id.startsWith("qp_defpatch_clarify")
  );
}
'''
if old_opt not in text:
    raise SystemExit("AuthorizedRoleOption block not found")
text = text.replace(old_opt, new_opt, 1)

old_auth = '''    const need =
      dc?.dirs.find((d) => d.dir_id === dir_id)?.need?.trim() || dir_id;
    out.push({ index: i + 1, role_code: code, role, dir_id, need });
'''
new_auth = '''    const need =
      dc?.dirs.find((d) => d.dir_id === dir_id)?.need?.trim() || dir_id;
    const aliases: string[] = [];
    if (isWorkRelatedOption(role, dir_id, need)) aliases.push("工作角色");
    out.push({ index: i + 1, role_code: code, role, dir_id, need, aliases });
'''
if old_auth not in text:
    raise SystemExit("authorizedRoleOptions push not found")
text = text.replace(old_auth, new_auth, 1)

old_parsers = '''export function parseClarificationRoleChoice(
  statement: string,
  options: AuthorizedRoleOption[],
): RoleChoiceParse {
'''
idx = text.find(old_parsers)
if idx < 0:
    raise SystemExit("parseClarificationRoleChoice start not found")
end = text.find("function itemPreview", idx)
if end < 0:
    raise SystemExit("itemPreview after parsers not found")

new_parsers = r'''const CLAUSE_SPLIT_RE = /而是|但是|不过|可是|但|,|，|。|;|；|！|!|？|\?/;

const NEGATION_CUES_RE =
  /不能确认|无法确认|不可以|不能写入|不可写入|不要写入|不确认|不认为|不觉得|不认可|不确定|不明确|不选|不是|并不|并非|没有|不对|排除|否定|未必/;

const UNCERTAINTY_CUES_RE =
  /目前无法确定|暂时无法确定|无法确定|没法确定|不确定|不明确|不清楚|不知道|说不清|暂时不确定|unsure|no\s*idea|i\s*don'?t\s*know/i;

const HEDGE_CUES_RE =
  /我不确定是不是|不确定是不是|是不是|可能|也许|大概|好像|似乎|不一定|不好说|不太确定/;

function isWorkRelatedOption(role: string, dir_id: string, need: string): boolean {
  return /工作|在职|status_quo|STATUS-QUO/i.test(`${role} ${dir_id} ${need}`);
}

function splitClauses(text: string): string[] {
  const parts = text
    .split(CLAUSE_SPLIT_RE)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function standaloneNumber(statement: string): number | null {
  const t = statement.trim();
  const numbered = /^([1-9]\d*)(?:[.、.)）]|\s|$)/.exec(t);
  if (!numbered) return null;
  const rest = t.slice(numbered[0].length).trim();
  if (rest && (NEGATION_CUES_RE.test(rest) || UNCERTAINTY_CUES_RE.test(rest) || HEDGE_CUES_RE.test(rest))) {
    return null;
  }
  return Number(numbered[1]);
}

function hasExplicitCertaintyNegation(t: string): boolean {
  return (
    /不明确/.test(t) ||
    /不认为.{0,16}明确/.test(t) ||
    /不觉得.{0,16}明确/.test(t) ||
    /不是明确/.test(t) ||
    /并非明确/.test(t) ||
    /并不明确/.test(t) ||
    /算不上明确/.test(t) ||
    /不算明确/.test(t)
  );
}

function hasUncertaintyExpression(t: string): boolean {
  return UNCERTAINTY_CUES_RE.test(t) || hasExplicitCertaintyNegation(t);
}

function hasEstimateExpression(t: string): boolean {
  return /(个人估计|仍然只是估计|仍然是估计|只是估计|还是估计|estimated|user_estimate)/i.test(
    t,
  );
}

function estimateNegated(t: string): boolean {
  return /不是.{0,8}估计|不认为.{0,10}估计|并非.{0,8}估计/.test(t);
}

function hasExplicitCertaintyAffirm(t: string): boolean {
  // Never treat a bare 明确 as affirmation — 不明确 would otherwise match.
  return /(明确事实|明确陈述|明确约束|这是明确|explicit|user_asserted)/i.test(t);
}

function confirmNegated(t: string): boolean {
  return (
    /不确认/.test(t) ||
    /不能确认/.test(t) ||
    /无法确认/.test(t) ||
    /不是明确约束/.test(t) ||
    /不是明确/.test(t) ||
    /不可以写入/.test(t) ||
    /不能写入/.test(t) ||
    /不可写入/.test(t) ||
    /不要写入/.test(t) ||
    /不许写入/.test(t)
  );
}

function hasConstraintConfirmAffirm(t: string): boolean {
  if (/^(确认|是的|yes)$/i.test(t.trim())) return true;
  return /(确认这是明确约束|确认为明确|改为明确|可以写入|确认这是明确)/.test(t);
}

function optionMentioned(fragment: string, option: AuthorizedRoleOption): boolean {
  if (!fragment) return false;
  if (fragment === option.role_code || fragment.includes(option.role_code)) return true;
  if (option.role && (fragment === option.role || fragment.includes(option.role))) {
    return true;
  }
  if (fragment.includes(option.dir_id)) return true;
  if (option.need.length >= 4 && fragment.includes(option.need)) return true;
  return option.aliases.some((alias) => alias.length > 0 && fragment.includes(alias));
}

export function parseClarificationRoleChoice(
  statement: string,
  options: AuthorizedRoleOption[],
): RoleChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t)) return { ok: false, reason: "refused" };
  if (
    hasUncertaintyExpression(t) ||
    HEDGE_CUES_RE.test(t) ||
    t === "不确定" ||
    t === "不知道" ||
    t === "不清楚"
  ) {
    return { ok: false, reason: "unclear" };
  }

  const numbered = standaloneNumber(t);
  if (numbered != null) {
    const hit = options.find((o) => o.index === numbered);
    if (hit) return { ok: true, role_code: hit.role_code };
  }

  const exactCodes = options.filter(
    (o) => t === o.role_code || t.includes(o.role_code),
  );
  if (exactCodes.length === 1 && !NEGATION_CUES_RE.test(t)) {
    return { ok: true, role_code: exactCodes[0]!.role_code };
  }
  if (exactCodes.length > 1) return { ok: false, reason: "unclear" };

  const affirmed = new Set<string>();
  const negated = new Set<string>();
  for (const clause of splitClauses(t)) {
    const mentioned = options.filter((o) => optionMentioned(clause, o));
    if (NEGATION_CUES_RE.test(clause)) {
      for (const option of mentioned) negated.add(option.role_code);
      continue;
    }
    for (const option of mentioned) affirmed.add(option.role_code);
  }
  for (const code of [...affirmed]) {
    if (negated.has(code)) affirmed.delete(code);
  }
  if (affirmed.size === 1) {
    const code = [...affirmed][0]!;
    if (options.some((option) => option.role_code === code)) {
      return { ok: true, role_code: code };
    }
    return { ok: false, reason: "unauthorized" };
  }
  return { ok: false, reason: "unclear" };
}

export function parseCertaintyChoice(statement: string): CertaintyChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t)) return { ok: false, reason: "refused" };

  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, certainty: "explicit" };
  if (numbered === 2) return { ok: true, certainty: "estimated" };
  if (numbered === 3) return { ok: true, certainty: "unclear" };

  if (hasUncertaintyExpression(t)) {
    return { ok: true, certainty: "unclear" };
  }
  if (hasEstimateExpression(t) && !estimateNegated(t)) {
    return { ok: true, certainty: "estimated" };
  }
  if (hasExplicitCertaintyAffirm(t) && !hasExplicitCertaintyNegation(t)) {
    return { ok: true, certainty: "explicit" };
  }
  return { ok: false, reason: "unclear" };
}

export function parseConstraintConfirmChoice(
  statement: string,
): ConstraintConfirmParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t)) return { ok: false, reason: "refused" };

  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, confirmed: true, still_uncertain: false };
  if (numbered === 2) return { ok: true, confirmed: false, still_uncertain: false };
  if (numbered === 3) return { ok: true, confirmed: false, still_uncertain: true };

  if (hasUncertaintyExpression(t)) {
    return { ok: true, confirmed: false, still_uncertain: true };
  }
  if (confirmNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasEstimateExpression(t) && !estimateNegated(t)) {
    return { ok: true, confirmed: false, still_uncertain: false };
  }
  if (hasConstraintConfirmAffirm(t)) {
    return { ok: true, confirmed: true, still_uncertain: false };
  }
  return { ok: false, reason: "unclear" };
}

export function parseDefinitionPatchChoice(
  statement: string,
): DefinitionPatchChoiceParse {
  const t = statement.trim();
  if (!t) return { ok: false, reason: "unclear" };
  if (isClarificationRefusal(t) || /暂时不处理|先不处理/.test(t)) {
    return { ok: false, reason: "refused" };
  }
  const numbered = standaloneNumber(t);
  if (numbered === 1) return { ok: true, as_fact: true };
  if (numbered === 2) return { ok: false, reason: "refused" };
  if (hasUncertaintyExpression(t) || HEDGE_CUES_RE.test(t)) {
    return { ok: false, reason: "unclear" };
  }
  if (
    /不作为|不改为|不当作|不记录|不要作为|不要改为/.test(t) ||
    /不是明确事实/.test(t)
  ) {
    return { ok: false, reason: "unclear" };
  }
  if (/(作为明确事实|改为事实|当作事实|记录为事实|作为事实)/i.test(t)) {
    return { ok: true, as_fact: true };
  }
  return { ok: false, reason: "unclear" };
}

'''
text = text[:idx] + new_parsers + text[end:]

# 2) Show 工作角色 alias in the role clarification question.
old_lines = '''  const roleLines = options
    .map((o) => `${o.index}. ${o.role} — ${o.need}（${o.dir_id}）`)
    .join("\\n");
'''
new_lines = '''  const roleLines = options
    .map((o) => {
      const alias = o.aliases.includes("工作角色") ? "（工作角色）" : "";
      return `${o.index}. ${o.role}${alias} — ${o.need}（${o.dir_id}）`;
    })
    .join("\\n");
'''
if old_lines not in text:
    raise SystemExit("roleLines block not found: " + repr(text[text.find("roleLines"):text.find("roleLines")+200] if "roleLines" in text else "missing"))
text = text.replace(old_lines, new_lines, 1)

# 3) mergePendingResolution must not restore a plan when unresolved is empty.
old_merge_status = '''    status: mergedItems.length === 0 && existing.rejected_items.length > 0 ? "rejected" : "pending",
    unresolved_items: mergedItems,
    rejected_items: [...(existing.rejected_items ?? [])],
    authorized_dir_ids:
      existing.authorized_dir_ids.length > 0
        ? existing.authorized_dir_ids
        : incoming.authorized_dir_ids,
    resolving_item_id: resolving?.item_id ?? existing.resolving_item_id,
    clarification_plan: existing.clarification_plan ?? incoming.clarification_plan,
    clarification_plan_id:
      existing.clarification_plan_id ?? incoming.clarification_plan_id,
'''
new_merge_status = '''    status: mergedItems.length === 0 && (existing.rejected_items ?? []).length > 0 ? "rejected" : "pending",
    unresolved_items: mergedItems,
    rejected_items: [...(existing.rejected_items ?? [])],
    authorized_dir_ids:
      existing.authorized_dir_ids.length > 0
        ? existing.authorized_dir_ids
        : incoming.authorized_dir_ids,
    resolving_item_id: resolving?.item_id ?? existing.resolving_item_id,
    clarification_plan:
      mergedItems.length === 0
        ? null
        : existing.clarification_plan ?? incoming.clarification_plan,
    clarification_plan_id:
      mergedItems.length === 0
        ? null
        : existing.clarification_plan_id ?? incoming.clarification_plan_id,
'''
if old_merge_status not in text:
    raise SystemExit("mergePendingResolution status block not found")
text = text.replace(old_merge_status, new_merge_status, 1)

# 4) pendingWithRemainingItems must not restore the old clarification_plan
#    when unresolved_items is empty (terminal rejected state).
old_remain = '''  if (!resolving) {
    return {
      ...seed,
      clarification_plan: remaining.length === 0 ? input.pending.clarification_plan : null,
      clarification_plan_id:
        remaining.length === 0 ? input.pending.clarification_plan_id : null,
    };
  }
'''
new_remain = '''  if (!resolving) {
    // Terminal state: never restore a resendable old clarification_plan
    // merely because unresolved_items is empty.
    return {
      ...seed,
      status: rejected.length > 0 ? "rejected" : seed.status,
      clarification_plan: null,
      clarification_plan_id: null,
      resolving_item_id: null,
    };
  }
'''
if old_remain not in text:
    raise SystemExit("pendingWithRemainingItems empty branch not found")
text = text.replace(old_remain, new_remain, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("pending-answer-resolution.ts patched", len(text))
