/**
 * 四产品共用 · 关系闭集注入（实例清单 + 守卫 + 审计 allowlist）。
 * 数据源：lib/calculations/relation-engine.ts
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildDirectedDynamicRelationInventoryBlock,
  buildMatchRelationInventoryBlock,
  computeDirectedDynamicRelations,
  computeMatchRelationAuditAllowlist,
  computeNatalChartRelations,
  computeRelationAuditAllowlist,
  getCurrentLiunian,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { POJU_OUTPUT_DATA_DISCIPLINE } from "@/lib/llm/prompts/poju-base";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";

/** breakthrough-core / opening conversion — 与聊天侧同源的定向关系 + 审计闭集。 */
export function resolveAgendaRelationContext(
  structured: ProfileStructured,
  questionCategory: string | null | undefined,
): {
  directedDynamic: RelationLabel[];
  auditAllowlist: RelationLabel[];
  directedInventoryBlock: string;
} {
  const liunian = getCurrentLiunian();
  const directedDynamic = computeDirectedDynamicRelations(structured, liunian, questionCategory);
  return {
    directedDynamic,
    auditAllowlist: computeRelationAuditAllowlist(structured, liunian, questionCategory),
    directedInventoryBlock: buildDirectedDynamicRelationInventoryBlock(
      structured,
      liunian,
      questionCategory,
    ),
  };
}

/** 定向为空时回退本命关系（供守卫提示，审计仍用完整 allowlist）。 */
export function resolveDirectedOrNatalRelations(
  structured: ProfileStructured,
  questionCategory: string | null | undefined,
): RelationLabel[] {
  const { directedDynamic } = resolveAgendaRelationContext(structured, questionCategory);
  return directedDynamic.length > 0 ? directedDynamic : computeNatalChartRelations(structured);
}

/** 本地粗分类（无 LLM）— 供 Glyph/Syncro/Match 定向过滤。 */
export function inferQuestionCategoryFromText(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/感情|婚姻|恋爱|分手|复合|对象|配偶|relationship|marriage|dating|partner|love|breakup/.test(t)) {
    return "relationship";
  }
  if (/事业|职业|工作|升职|跳槽|career|job|work|promotion|quit/.test(t)) {
    return "career";
  }
  if (/财|投资|收入|wealth|money|finance|invest/.test(t)) {
    return "wealth";
  }
  if (/健康|身体|health|wellness/.test(t)) {
    return "health";
  }
  if (/家人|父母|亲子|family|parent/.test(t)) {
    return "family";
  }
  return null;
}

export type SingleProfileRelationClosedSet = {
  inventoryBlock: string;
  guardBlock: string;
  directedInventoryBlock: string;
  auditAllowlist: RelationLabel[];
  disciplineBlock: string;
};

/** Glyph / Syncro / 单盘场景。 */
export function buildSingleProfileRelationClosedSet(
  structured: ProfileStructured,
  opts?: { questionCategory?: string | null; questionText?: string },
): SingleProfileRelationClosedSet {
  const category = opts?.questionCategory ?? inferQuestionCategoryFromText(opts?.questionText ?? "") ?? null;
  const liunian = getCurrentLiunian();
  const directedDynamic = computeDirectedDynamicRelations(structured, liunian, category);
  return {
    inventoryBlock: buildStructuredInstanceInventory(structured),
    guardBlock: buildChatFactGuardBlock(structured, { directedRelations: directedDynamic }),
    directedInventoryBlock: buildDirectedDynamicRelationInventoryBlock(structured, liunian, category),
    auditAllowlist: computeRelationAuditAllowlist(structured, liunian, category),
    disciplineBlock: POJU_OUTPUT_DATA_DISCIPLINE,
  };
}

export function stitchSingleProfileRelationClosedSet(
  structured: ProfileStructured,
  opts?: { questionCategory?: string | null; questionText?: string },
): string {
  const blocks = buildSingleProfileRelationClosedSet(structured, opts);
  return stitchPromptSections(
    blocks.guardBlock,
    blocks.inventoryBlock,
    blocks.directedInventoryBlock,
    blocks.disciplineBlock,
  );
}

export type MatchRelationClosedSet = {
  inventoryBlock: string;
  guardBlockA: string;
  guardBlockB: string;
  matchRelationBlock: string;
  auditAllowlist: RelationLabel[];
  disciplineBlock: string;
};

export function buildMatchRelationClosedSet(
  structuredA: ProfileStructured,
  structuredB: ProfileStructured,
  relationshipDescription?: string,
): MatchRelationClosedSet {
  const category = inferQuestionCategoryFromText(relationshipDescription ?? "") ?? "relationship";
  const liunian = getCurrentLiunian();
  const dynA = computeDirectedDynamicRelations(structuredA, liunian, category);
  const dynB = computeDirectedDynamicRelations(structuredB, liunian, category);
  return {
    inventoryBlock: stitchPromptSections(
      "## 命主 A 实例闭集",
      buildStructuredInstanceInventory(structuredA),
      "## 命主 B 实例闭集",
      buildStructuredInstanceInventory(structuredB),
    ),
    guardBlockA: buildChatFactGuardBlock(structuredA, { directedRelations: dynA }),
    guardBlockB: buildChatFactGuardBlock(structuredB, { directedRelations: dynB }),
    matchRelationBlock: buildMatchRelationInventoryBlock(structuredA, structuredB, category),
    auditAllowlist: computeMatchRelationAuditAllowlist(structuredA, structuredB, category),
    disciplineBlock: POJU_OUTPUT_DATA_DISCIPLINE,
  };
}

export function stitchMatchRelationClosedSet(
  structuredA: ProfileStructured,
  structuredB: ProfileStructured,
  relationshipDescription?: string,
): string {
  const blocks = buildMatchRelationClosedSet(structuredA, structuredB, relationshipDescription);
  return stitchPromptSections(
    blocks.guardBlockA,
    blocks.guardBlockB,
    blocks.inventoryBlock,
    blocks.matchRelationBlock,
    blocks.disciplineBlock,
  );
}
