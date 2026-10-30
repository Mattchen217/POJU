/**
 * Phase 4 — Shensha 24/51 disposition registry.
 *
 * public_glossary: safe user/prompt display via POJU_TERMS slug
 * internal_redline: may be computed; strip from prompt + user output
 * unknown_blocked: unregistered token; never raw-fallback
 *
 * 飞刃/羊刃: semantic SSOT treats as synonym → both public → fei_ren
 * (JSON execution_edge + tactical_impulse collapse to the same slug).
 */

import { createHash } from "node:crypto";
import { CLOSED_SHEN_SHA } from "@/lib/glossary/term-closed-set";
import { forbiddenTokensForNamespace } from "@/lib/glossary/term-forbidden-registry";
import { termHanVariants } from "@/lib/glossary/term-han-normalize";

export type ShenshaDisposition =
  | { status: "public_glossary"; termSlug: string; jsonId?: string; note?: string }
  | { status: "internal_redline"; reasonCode: string; jsonId?: string }
  | { status: "unknown_blocked"; reasonCode: string };

/** CLOSED_SHEN_SHA → POJU_TERMS slug (engine closed set is public by default). */
export const CLOSED_SHENSHA_TO_SLUG: Readonly<Record<string, string>> = {
  天乙贵人: "tian_yi_gui_ren",
  禄神: "lu_shen",
  飞刃: "fei_ren",
  文昌: "wen_chang",
  桃花: "tao_hua",
  驿马: "yi_ma",
  华盖: "hua_gai",
  孤辰: "gu_chen",
  寡宿: "gua_su",
  将星: "jiang_xing",
  劫煞: "jie_sha",
  亡神: "wang_shen",
  灾煞: "zai_sha",
  国印: "guo_yin",
  金舆: "jin_yu",
  天德: "tian_de",
  月德: "yue_de",
  福星贵人: "fu_xing_gui_ren",
  太极贵人: "tai_ji_gui_ren",
  天医: "tian_yi_star",
  学堂: "xue_tang",
  词馆: "ci_guan",
  红鸾: "hong_luan",
  天喜: "tian_xi",
};

/** Extra glossary-backed surfaces outside the 24 closed set (still public). */
const EXTRA_PUBLIC: Readonly<Record<string, string>> = {
  羊刃: "fei_ren", // synonym of 飞刃 (semantic SSOT)
  文昌贵人: "wen_chang",
  红艳煞: "ss_hongyan",
  披麻: "ss_pima",
  天厨贵人: "ss_tianchu",
  天厨: "ss_tianchu",
  德秀贵人: "ss_dexiu",
  金神: "ss_jinshen",
  天赦日: "ss_tianshe",
  正学堂: "ss_xuetang",
};

/** JSON map id → disposition (audit of 51 vs 24 + forbidden). */
export const SHENSHA_JSON_ID_DISPOSITION: Readonly<
  Record<string, ShenshaDisposition>
> = {
  // --- public (closed 24 + extras with glossary) ---
  execution_edge: { status: "public_glossary", termSlug: "fei_ren", note: "羊刃→fei_ren synonym" },
  tactical_impulse: { status: "public_glossary", termSlug: "fei_ren", note: "飞刃→fei_ren; collapse dual JSON ids" },
  provision_anchor: { status: "public_glossary", termSlug: "lu_shen", jsonId: "provision_anchor" },
  prime_mentor_node: { status: "public_glossary", termSlug: "tian_yi_gui_ren" },
  fortune_buffer: { status: "public_glossary", termSlug: "fu_xing_gui_ren" },
  insight_catalyst: { status: "public_glossary", termSlug: "tai_ji_gui_ren" },
  institutional_authority_node: { status: "public_glossary", termSlug: "guo_yin" },
  cognitive_advantage: { status: "public_glossary", termSlug: "wen_chang", note: "文昌贵人" },
  cognitive_advantage_local: { status: "public_glossary", termSlug: "wen_chang" },
  resource_provisioning: { status: "public_glossary", termSlug: "ss_tianchu" },
  mobility_capital: { status: "public_glossary", termSlug: "jin_yu" },
  social_magnetism: { status: "public_glossary", termSlug: "tao_hua" },
  velocity_vector: { status: "public_glossary", termSlug: "yi_ma" },
  signature_originality: { status: "public_glossary", termSlug: "hua_gai" },
  command_authority: { status: "public_glossary", termSlug: "jiang_xing" },
  disruption_friction: { status: "public_glossary", termSlug: "jie_sha" },
  vigilance_load: { status: "public_glossary", termSlug: "wang_shen", note: "亡神: tension/close-out, not death prophecy" },
  adversity_shock: { status: "public_glossary", termSlug: "zai_sha" },
  momentum_tailwind: { status: "public_glossary", termSlug: "tian_xi" },
  recovery_capacity: { status: "public_glossary", termSlug: "tian_yi_star" },
  relational_catalyst: { status: "public_glossary", termSlug: "hong_luan" },
  low_coupling_preference: { status: "public_glossary", termSlug: "gu_chen" },
  autonomy_index: { status: "public_glossary", termSlug: "gua_su" },
  grounded_support: { status: "public_glossary", termSlug: "yue_de" },
  systemic_support_core: { status: "public_glossary", termSlug: "tian_de" },
  articulation_strength: { status: "public_glossary", termSlug: "ci_guan" },
  learning_foundation: { status: "public_glossary", termSlug: "xue_tang" },
  magnetic_appeal: { status: "public_glossary", termSlug: "ss_hongyan" },
  transition_strain: { status: "public_glossary", termSlug: "ss_pima" },
  resonant_alignment_vector: { status: "public_glossary", termSlug: "ss_dexiu" },
  high_intensity_drive: { status: "public_glossary", termSlug: "ss_jinshen" },
  reset_window: { status: "public_glossary", termSlug: "ss_tianshe" },

  // --- internal_redline (forbidden registry / fear-frame; may exist in JSON) ---
  flow_volatility: { status: "internal_redline", reasonCode: "forbidden_bazi_流霞" },
  impact_exposure: { status: "internal_redline", reasonCode: "forbidden_bazi_血刃" },
  sentiment_drawdown: { status: "internal_redline", reasonCode: "forbidden_bazi_丧门" },
  external_drain: { status: "internal_redline", reasonCode: "forbidden_bazi_吊客" },
  entanglement_risk: { status: "internal_redline", reasonCode: "forbidden_bazi_勾绞煞" },
  baseline_volatility: { status: "internal_redline", reasonCode: "forbidden_bazi_元辰" },
  refined_talent: { status: "internal_redline", reasonCode: "forbidden_bazi_六秀日" },
  reputational_sensitivity: { status: "internal_redline", reasonCode: "forbidden_bazi_九丑日" },
  decisive_authority: { status: "internal_redline", reasonCode: "forbidden_bazi_魁罡" },
  structural_vulnerability: { status: "internal_redline", reasonCode: "forbidden_bazi_十恶大败" },
  timing_misalignment: { status: "internal_redline", reasonCode: "forbidden_bazi_阴差阳错" },
  independent_operating_mode: { status: "internal_redline", reasonCode: "forbidden_bazi_孤鸾煞" },
  concentrated_focus: { status: "internal_redline", reasonCode: "forbidden_bazi_八专日" },
  adaptive_acumen: { status: "internal_redline", reasonCode: "forbidden_bazi_十灵日" },
  constraint_field: { status: "internal_redline", reasonCode: "forbidden_bazi_地网" },
  perceptual_sensitivity: { status: "internal_redline", reasonCode: "forbidden_bazi_童子煞" },
  strategic_latency: { status: "internal_redline", reasonCode: "forbidden_bazi_空亡" },

  // compound/support variants without closed-set seat — keep internal until product names
  support_coupling: { status: "internal_redline", reasonCode: "no_closed_set_月德合" },
  synergistic_dynamic: { status: "internal_redline", reasonCode: "no_closed_set_天德合" },
};

const HAN_TO_DISPOSITION = new Map<string, ShenshaDisposition>();

function indexHan(han: string, d: ShenshaDisposition) {
  const key = han.trim();
  if (!key) return;
  if (!HAN_TO_DISPOSITION.has(key)) HAN_TO_DISPOSITION.set(key, d);
}

for (const [han, slug] of Object.entries(CLOSED_SHENSHA_TO_SLUG)) {
  indexHan(han, { status: "public_glossary", termSlug: slug });
}
for (const [han, slug] of Object.entries(EXTRA_PUBLIC)) {
  indexHan(han, { status: "public_glossary", termSlug: slug });
}
for (const tok of forbiddenTokensForNamespace("bazi")) {
  indexHan(tok, { status: "internal_redline", reasonCode: `forbidden_bazi_${tok}` });
}

/** Audit rows for 24 vs 51 diff (machine-readable). */
export type ShenshaDiffRow = {
  key: string;
  kind: "closed_24" | "json_51" | "forbidden";
  disposition: ShenshaDisposition["status"];
  detail: string;
};

export function buildShenshaDiffAudit(): ShenshaDiffRow[] {
  const rows: ShenshaDiffRow[] = [];
  for (const han of CLOSED_SHEN_SHA) {
    const d = resolveShenshaDisposition(han);
    rows.push({
      key: han,
      kind: "closed_24",
      disposition: d.status,
      detail: d.status === "public_glossary" ? d.termSlug : "reason" in d ? d.reasonCode : "",
    });
  }
  for (const [id, d] of Object.entries(SHENSHA_JSON_ID_DISPOSITION)) {
    rows.push({
      key: id,
      kind: "json_51",
      disposition: d.status,
      detail: d.status === "public_glossary" ? d.termSlug : "reasonCode" in d ? d.reasonCode : "",
    });
  }
  for (const tok of forbiddenTokensForNamespace("bazi")) {
    rows.push({
      key: tok,
      kind: "forbidden",
      disposition: "internal_redline",
      detail: `forbidden_bazi_${tok}`,
    });
  }
  return rows;
}

export function resolveShenshaDisposition(
  tokenOrId: string,
): ShenshaDisposition {
  const raw = tokenOrId.trim();
  if (!raw) return { status: "unknown_blocked", reasonCode: "empty_token" };

  const byJson = SHENSHA_JSON_ID_DISPOSITION[raw];
  if (byJson) return byJson;

  for (const v of termHanVariants(raw)) {
    const byHan = HAN_TO_DISPOSITION.get(v);
    if (byHan) return byHan;
  }

  return { status: "unknown_blocked", reasonCode: "unregistered_shensha_token" };
}

export function isShenshaInternalRedline(tokenOrId: string): boolean {
  return resolveShenshaDisposition(tokenOrId).status === "internal_redline";
}

export function hashShenshaToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex").slice(0, 12);
}

/** Safe user-facing placeholder — never the raw traditional token. */
export const SHENSHA_BLOCKED_PLACEHOLDER = "";
