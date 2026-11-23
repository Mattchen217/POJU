/**
 * Face02 validation — content units + structured DC fact↔claim ownership.
 * Fail-closed. Free-text substring matching is auxiliary only.
 */

import { Face02V2Schema, type Face02ContentUnit, type Face02V2 } from "../schemas";
import {
  validateFace02BodyCompliance,
  type BodyComplianceIssue,
} from "../body-compliance";
import {
  assertClaimIdsExist,
  assertEvidenceIdsExist,
  type EvidenceRegistryError,
} from "../evidence-registry";
import type { EvidenceRegistry, ReportEvidence } from "../types";
import {
  buildPage02FactIdContext,
  factEvidenceIdFor,
  resolveCanonicalPage02FactId,
  type Page02FactIdContext,
} from "./fact-id";
import {
  claimOwnsFactCredibly,
  detectAssertedFactIdsInText,
} from "./credible-fact-claim";
import {
  assembleFace02ClaimOwnershipSlots,
  face02AssembledBodyBlob,
  indexFace02ContentUnits,
} from "./content-units";

export type Face02Issue =
  | BodyComplianceIssue
  | EvidenceRegistryError
  | { code: string; detail: string; path?: string };

export type Face02ValidationResult =
  | { ok: true; page: Face02V2 }
  | { ok: false; issues: Face02Issue[] };

const INVENTED_NUMBER_RE =
  /\b(?:\d{1,3}\s*%|\d+\s*分|成功率|胜率|probability\s*(?:of|=)\s*\d)/i;

const SCARE_FATE_RE =
  /必死|注定失败|无可挽回|永远没有机会|一定会毁灭|宿命已定|inevitable\s+doom|you\s+will\s+definitely\s+fail/i;

const PAGE04_BOTTLENECK_RE =
  /核心卡点|真正瓶颈|若硬顶|forced\s+through|bottleneck_name|核心障碍诊断/i;

const PAGE05_06_RE =
  /路径排序|首选路径完整|次选方案对比|七日内行动甘特|verification_experiment|near_step_principle/i;

const HYPOTHESIS_AS_FACT_RE =
  /已经证实|科学证明了命理|被现代科学验证|empirically\s+proven\s+by\s+bazi|science\s+confirms\s+(?:the\s+)?(?:chart|destiny)/i;

const CONFIRM_UPGRADE_RE =
  /已确认|已经确认|confirmed\s+fact|definitely\s+true|已经证实该事实|确凿事实|as\s+confirmed/i;

export function evidenceSupportsClaim(
  registry: EvidenceRegistry,
  claimId: string,
  evidenceId: string,
): boolean {
  const claim = registry.claims[claimId];
  if (claim?.evidence_ids.includes(evidenceId)) return true;
  const ev = registry.evidence[evidenceId];
  if (!ev) return false;
  return (
    ev.supports_claim_ids.includes(claimId) ||
    ev.limits_claim_ids.includes(claimId)
  );
}

export function assertPersonalReadingProvenance(
  issues: Face02Issue[],
  ev: ReportEvidence,
  path: string,
  availableDomains: ReadonlySet<string>,
  domainVersions: { bazi?: string; ziwei?: string },
): void {
  const domain = (ev.source_domain ?? "").toLowerCase().trim();
  if (!domain) {
    issues.push({
      code: "evidence_domain_missing",
      detail: `${path} 个人依据「${ev.evidence_id}」缺少可信 source_domain`,
      path,
    });
    return;
  }
  if (domain !== "bazi" && domain !== "ziwei") {
    issues.push({
      code: "evidence_domain_mismatch",
      detail: `${path} 个人依据「${ev.evidence_id}」可信域=${ev.source_domain}，须为 bazi/ziwei`,
      path,
    });
    return;
  }
  if (!availableDomains.has(domain)) {
    issues.push({
      code: "personal_domain_unavailable",
      detail: `${path} 个人依据「${ev.evidence_id}」域 ${domain} 当前不可用`,
      path,
    });
    return;
  }
  const expectedRaw =
    domain === "bazi" ? domainVersions.bazi : domainVersions.ziwei;
  const expected = (expectedRaw ?? "").trim();
  if (!expected) {
    issues.push({
      code: "evidence_version_missing",
      detail: `${path} 个人域 ${domain} 缺少 profile source_version`,
      path,
    });
    return;
  }
  const got = (ev.source_version ?? "").trim();
  if (!got) {
    issues.push({
      code: "evidence_version_missing",
      detail: `${path} 个人依据「${ev.evidence_id}」缺少 source_version`,
      path,
    });
    return;
  }
  if (got !== expected) {
    issues.push({
      code: "evidence_version_mismatch",
      detail: `${path} 证据「${ev.evidence_id}」version=${got} ≠ profile ${expected}`,
      path,
    });
  }
}

function assertEvidenceOwnedByClaims(
  issues: Face02Issue[],
  registry: EvidenceRegistry,
  claimIds: readonly string[],
  evidenceId: string,
  path: string,
): void {
  if (!registry.evidence[evidenceId]) return;
  const owned = claimIds.some((cid) =>
    evidenceSupportsClaim(registry, cid, evidenceId),
  );
  if (!owned) {
    issues.push({
      code: "claim_evidence_orphan",
      detail: `${path} 证据「${evidenceId}」与所列 claim_ids 无归属关系`,
      path,
    });
  }
}

function buildFactIdContext(input: {
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
}): Page02FactIdContext {
  const raw = new Set<string>();
  if (input.factStatusById) {
    for (const id of input.factStatusById.keys()) raw.add(id);
  }
  if (input.knownFactIds) {
    for (const id of input.knownFactIds) {
      if (id.startsWith("ev_fact_")) {
        const candidate = id.slice("ev_fact_".length);
        if (candidate) raw.add(candidate);
      } else {
        raw.add(id);
      }
    }
  }
  return buildPage02FactIdContext({ factIds: raw });
}

function requireUnitIdsExist(
  issues: Face02Issue[],
  index: Map<string, Face02ContentUnit>,
  unitIds: readonly string[],
  path: string,
  expectedKinds?: readonly Face02ContentUnit["kind"][],
): void {
  for (const id of unitIds) {
    const u = index.get(id);
    if (!u) {
      issues.push({
        code: "missing_content_unit",
        detail: `${path} 引用不存在的 unit_id「${id}」`,
        path,
      });
      continue;
    }
    if (expectedKinds && !expectedKinds.includes(u.kind)) {
      issues.push({
        code: "content_unit_kind_mismatch",
        detail: `${path} unit「${id}」kind=${u.kind}，要求 ${expectedKinds.join("|")}`,
        path,
      });
    }
  }
}

function validateContentUnit(
  issues: Face02Issue[],
  unit: Face02ContentUnit,
  input: {
    registry: EvidenceRegistry;
    factCtx: Page02FactIdContext;
    factStatusById?: ReadonlyMap<string, string>;
    availableDomains: ReadonlySet<string>;
    domainVersions: { bazi?: string; ziwei?: string };
    credibleFactClaimKeys?: ReadonlySet<string>;
    unitIndex: Map<string, Face02ContentUnit>;
  },
): void {
  const path = `content_units[${unit.unit_id}]`;
  issues.push(...assertClaimIdsExist(input.registry, unit.claim_ids));
  issues.push(...assertEvidenceIdsExist(input.registry, unit.evidence_ids));

  if (unit.kind === "personal_interpretation") {
    if (
      (unit.source_domain === "bazi" || unit.source_domain === "ziwei") &&
      !input.availableDomains.has(unit.source_domain)
    ) {
      issues.push({
        code: "personal_domain_unavailable",
        detail: `${path} source_domain=${unit.source_domain} 不可用`,
        path,
      });
    }
    for (const eid of unit.evidence_ids) {
      const ev = input.registry.evidence[eid];
      if (!ev) continue;
      if (ev.source_type !== "personal_reading") {
        issues.push({
          code: "evidence_role_mismatch",
          detail: `${path} 要求 personal_reading，得到 ${ev.source_type}`,
          path,
        });
        continue;
      }
      if (
        (unit.source_domain === "bazi" || unit.source_domain === "ziwei") &&
        (ev.source_domain ?? "").toLowerCase() !== unit.source_domain
      ) {
        issues.push({
          code: "evidence_domain_mismatch",
          detail: `${path} 声明 ${unit.source_domain}，证据域=${ev.source_domain}`,
          path,
        });
      }
      if (unit.source_domain === "bazi" || unit.source_domain === "ziwei") {
        assertPersonalReadingProvenance(
          issues,
          ev,
          path,
          input.availableDomains,
          input.domainVersions,
        );
      }
      if (unit.source_domain === "science" && ev.source_type === "personal_reading") {
        issues.push({
          code: "evidence_role_mismatch",
          detail: `${path} science 不得引用 personal_reading`,
          path,
        });
      }
      assertEvidenceOwnedByClaims(
        issues,
        input.registry,
        unit.claim_ids,
        eid,
        path,
      );
    }
    return;
  }

  if (unit.kind === "reality_mechanism") {
    for (const eid of unit.evidence_ids) {
      const ev = input.registry.evidence[eid];
      if (!ev) continue;
      if (ev.source_type !== "reality_mechanism") {
        issues.push({
          code: "evidence_role_mismatch",
          detail: `${path} 要求 reality_mechanism，得到 ${ev.source_type}`,
          path,
        });
        continue;
      }
      assertEvidenceOwnedByClaims(
        issues,
        input.registry,
        unit.claim_ids,
        eid,
        path,
      );
    }
    return;
  }

  if (unit.kind === "reality_fact") {
    const confirmLang = CONFIRM_UPGRADE_RE.test(unit.text);
    for (const rawFid of unit.fact_ids) {
      const resolved = resolveCanonicalPage02FactId(rawFid, input.factCtx);
      if (!resolved.ok) {
        issues.push({
          code:
            resolved.reason === "ambiguous"
              ? "fact_id_ambiguous"
              : "missing_fact_id",
          detail: `${path} ${resolved.detail}`,
          path,
        });
        continue;
      }
      const status = input.factStatusById?.get(resolved.fact_id);
      if (status === undefined) {
        issues.push({
          code: "fact_status_unresolved",
          detail: `${path}「${rawFid}」无原始 status`,
          path,
        });
        continue;
      }
      if (confirmLang && status !== "confirmed") {
        issues.push({
          code: "fact_status_upgrade",
          detail: `${path} 将 ${status} 事实「${resolved.fact_id}」表述为已确认`,
          path,
        });
      }
      const evId = factEvidenceIdFor(resolved.fact_id);
      if (!input.registry.evidence[evId]) {
        issues.push({
          code: "missing_evidence_id",
          detail: `${path} 缺少 reality_fact evidence「${evId}」`,
          path,
        });
        continue;
      }
      if (!unit.evidence_ids.includes(evId)) {
        issues.push({
          code: "fact_evidence_unlinked",
          detail: `${path} fact「${resolved.fact_id}」未列入 evidence_ids`,
          path,
        });
      }
      assertFactOwnedByClaims(
        issues,
        unit.claim_ids,
        resolved.fact_id,
        path,
        input.credibleFactClaimKeys,
      );
    }
    for (const eid of unit.evidence_ids) {
      const ev = input.registry.evidence[eid];
      if (!ev) continue;
      if (ev.source_type !== "reality_fact") {
        issues.push({
          code: "evidence_role_mismatch",
          detail: `${path} evidence「${eid}」须为 reality_fact`,
          path,
        });
      }
    }
    return;
  }

  if (unit.kind === "conditional_explanation") {
    for (const eid of unit.evidence_ids) {
      assertEvidenceOwnedByClaims(
        issues,
        input.registry,
        unit.claim_ids,
        eid,
        path,
      );
    }
    for (const rid of unit.related_reality_fact_unit_ids) {
      const dep = input.unitIndex.get(rid);
      if (!dep) {
        issues.push({
          code: "missing_content_unit",
          detail: `${path} related_reality_fact_unit_ids「${rid}」不存在`,
          path,
        });
        continue;
      }
      if (dep.kind !== "reality_fact") {
        issues.push({
          code: "content_unit_kind_mismatch",
          detail: `${path} related unit「${rid}」必须是 reality_fact`,
          path,
        });
      }
    }
  }
}

function assertFactOwnedByClaims(
  issues: Face02Issue[],
  claimIds: readonly string[],
  factId: string,
  path: string,
  credibleFactClaimKeys: ReadonlySet<string> | undefined,
): void {
  const owned = claimIds.some((cid) =>
    claimOwnsFactCredibly(credibleFactClaimKeys, cid, factId),
  );
  if (!owned) {
    issues.push({
      code: "claim_fact_orphan",
      detail: `${path} 事实「${factId}」与所列 claim_ids 无可信结构化 DIR 关联`,
      path,
    });
  }
}

function scanStatusUpgradeInText(
  issues: Face02Issue[],
  text: string,
  path: string,
  factStatusById: ReadonlyMap<string, string> | undefined,
  factContentById: ReadonlyMap<string, string> | undefined,
): void {
  if (!text.trim() || !factStatusById || !factContentById) return;
  if (!CONFIRM_UPGRADE_RE.test(text)) return;
  for (const [factId, status] of factStatusById) {
    if (status === "confirmed") continue;
    const content = (factContentById.get(factId) ?? "").trim();
    if (content.length < 12) continue;
    const fragment = content.slice(0, Math.min(24, content.length));
    if (text.includes(fragment) || text.includes(factId)) {
      issues.push({
        code: "fact_status_upgrade",
        detail: `${path} 将 ${status} 事实「${factId}」表述为已确认`,
        path,
      });
    }
  }
}

export function validateFace02Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  factStatusById?: ReadonlyMap<string, string>;
  factContentById?: ReadonlyMap<string, string>;
  available_domains?: readonly string[];
  domain_versions?: { bazi?: string; ziwei?: string };
  page01_core_judgment?: string | null;
  credibleFactClaimKeys?: ReadonlySet<string>;
}): Face02ValidationResult {
  // Deterministic B-assembly: empty claim_ids ← evidence ownership / credible pairs.
  const assembled = assembleFace02ClaimOwnershipSlots({
    raw: input.raw,
    registry: input.registry,
    credibleFactClaimKeys: input.credibleFactClaimKeys,
  });
  const parsed = Face02V2Schema.safeParse(assembled);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: "gate_face_zod_fail",
          detail: parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".")}:${i.message}`)
            .join("; "),
        },
      ],
    };
  }
  const page = parsed.data;
  const issues: Face02Issue[] = [];

  const body = validateFace02BodyCompliance(page, input.locale);
  issues.push(...body.issues);

  const bodyBlob = face02AssembledBodyBlob(page);
  if (INVENTED_NUMBER_RE.test(bodyBlob)) {
    issues.push({
      code: "invented_metric",
      detail: "正文疑似虚构概率/评分/量化指标",
    });
  }
  if (SCARE_FATE_RE.test(bodyBlob)) {
    issues.push({
      code: "scare_or_fatalism",
      detail: "正文含恐吓/宿命论表述",
    });
  }
  if (PAGE04_BOTTLENECK_RE.test(bodyBlob)) {
    issues.push({
      code: "page04_boundary_leak",
      detail: "正文疑似提前生成 Page04 核心障碍诊断",
    });
  }
  if (PAGE05_06_RE.test(bodyBlob)) {
    issues.push({
      code: "downstream_page_leak",
      detail: "正文疑似侵入 Page05/Page06 职责",
    });
  }
  if (HYPOTHESIS_AS_FACT_RE.test(bodyBlob)) {
    issues.push({
      code: "science_validates_metaphysics",
      detail: "不得把科学解释用作命理体系的验证",
    });
  }

  const page01Core = (input.page01_core_judgment ?? "").trim();
  if (page01Core.length >= 40) {
    const norm = (s: string) => s.replace(/\s+/g, "").slice(0, 120);
    const whyText = page.content_units
      .filter((u) => page.why_judgment_fits_unit_ids.includes(u.unit_id))
      .map((u) => u.text)
      .join("\n");
    const summaryText = page.content_units
      .filter((u) => page.page_summary_unit_ids.includes(u.unit_id))
      .map((u) => u.text)
      .join("\n");
    if (
      norm(whyText).includes(norm(page01Core).slice(0, 48)) ||
      norm(summaryText).includes(norm(page01Core).slice(0, 48))
    ) {
      issues.push({
        code: "page01_conclusion_copy",
        detail: "Page02 不得复制 Page01 结论段落作为主要正文",
      });
    }
  }

  const domains = new Set(
    (input.available_domains ?? []).map((d) => d.toLowerCase()),
  );
  const hasPersonalDomain =
    domains.has("bazi") || domains.has("ziwei") || domains.has("personal");
  const domainVersions = input.domain_versions ?? {};
  const factCtx = buildFactIdContext({
    knownFactIds: input.knownFactIds,
    factStatusById: input.factStatusById,
  });
  const unitIndex = indexFace02ContentUnits(page.content_units);
  const seenUnitIds = new Set<string>();
  for (const unit of page.content_units) {
    if (seenUnitIds.has(unit.unit_id)) {
      issues.push({
        code: "duplicate_content_unit",
        detail: `重复 unit_id「${unit.unit_id}」`,
        path: `content_units[${unit.unit_id}]`,
      });
    }
    seenUnitIds.add(unit.unit_id);
    validateContentUnit(issues, unit, {
      registry: input.registry,
      factCtx,
      factStatusById: input.factStatusById,
      availableDomains: domains,
      domainVersions,
      credibleFactClaimKeys: input.credibleFactClaimKeys,
      unitIndex,
    });
  }

  requireUnitIdsExist(
    issues,
    unitIndex,
    page.page_summary_unit_ids,
    "page_summary_unit_ids",
  );
  requireUnitIdsExist(
    issues,
    unitIndex,
    page.relevant_personal_factor_unit_ids,
    "relevant_personal_factor_unit_ids",
    ["personal_interpretation", "reality_mechanism"],
  );
  requireUnitIdsExist(
    issues,
    unitIndex,
    page.personal_reality_interplay_unit_ids,
    "personal_reality_interplay_unit_ids",
  );
  requireUnitIdsExist(
    issues,
    unitIndex,
    page.why_judgment_fits_unit_ids,
    "why_judgment_fits_unit_ids",
  );

  if (!hasPersonalDomain) {
    const personalUnits = page.content_units.filter(
      (u) =>
        u.kind === "personal_interpretation" &&
        (u.source_domain === "bazi" || u.source_domain === "ziwei"),
    );
    if (personalUnits.length || page.relevant_personal_factor_unit_ids.length) {
      issues.push({
        code: "invented_personal_judgment",
        detail: "无可用个人资料域时不得生成八字/紫微个人批断内容",
      });
    }
  }

  // --- explanation_boundary via unit ids ---
  const boundary = page.explanation_boundary;
  issues.push(...assertClaimIdsExist(input.registry, boundary.claim_ids));
  requireUnitIdsExist(
    issues,
    unitIndex,
    boundary.personal_unit_ids,
    "explanation_boundary.personal_unit_ids",
    ["personal_interpretation"],
  );
  requireUnitIdsExist(
    issues,
    unitIndex,
    boundary.confirmed_fact_unit_ids,
    "explanation_boundary.confirmed_fact_unit_ids",
    ["reality_fact"],
  );
  requireUnitIdsExist(
    issues,
    unitIndex,
    boundary.hypothesis_unit_ids,
    "explanation_boundary.hypothesis_unit_ids",
  );

  for (const uid of boundary.personal_unit_ids) {
    const u = unitIndex.get(uid);
    if (!u || u.kind !== "personal_interpretation") continue;
    const claimOk = u.claim_ids.some((c) => boundary.claim_ids.includes(c));
    if (!claimOk) {
      issues.push({
        code: "boundary_claim_mismatch",
        detail: `personal unit「${uid}」claim_ids 与 boundary.claim_ids 无交集`,
        path: "explanation_boundary.personal_unit_ids",
      });
    }
  }

  const hasAnyConfirmed = [...(input.factStatusById?.entries() ?? [])].some(
    ([, s]) => s === "confirmed",
  );
  for (const uid of boundary.confirmed_fact_unit_ids) {
    const u = unitIndex.get(uid);
    if (!u || u.kind !== "reality_fact") continue;
    const claimOk = u.claim_ids.some((c) => boundary.claim_ids.includes(c));
    if (!claimOk) {
      issues.push({
        code: "boundary_claim_mismatch",
        detail: `confirmed fact unit「${uid}」claim_ids 与 boundary.claim_ids 无交集`,
        path: "explanation_boundary.confirmed_fact_unit_ids",
      });
    }
    for (const fid of u.fact_ids) {
      const resolved = resolveCanonicalPage02FactId(fid, factCtx);
      if (!resolved.ok) continue;
      const status = input.factStatusById?.get(resolved.fact_id);
      if (status !== "confirmed") {
        issues.push({
          code: "fact_status_upgrade",
          detail: `confirmed_fact_unit「${uid}」事实「${resolved.fact_id}」status=${status}`,
          path: "explanation_boundary.confirmed_fact_unit_ids",
        });
      }
    }
  }
  if (!hasAnyConfirmed && boundary.confirmed_fact_unit_ids.length > 0) {
    issues.push({
      code: "invented_confirmed_fact",
      detail: "无 confirmed DC 事实时 confirmed_fact_unit_ids 必须为空",
      path: "explanation_boundary",
    });
  }
  if (
    !hasPersonalDomain &&
    boundary.personal_unit_ids.length > 0
  ) {
    issues.push({
      code: "invented_personal_judgment",
      detail: "无可用个人资料时 personal_unit_ids 必须为空",
      path: "explanation_boundary",
    });
  }

  for (const uid of boundary.hypothesis_unit_ids) {
    const u = unitIndex.get(uid);
    if (!u) continue;
    const claimOk = u.claim_ids.some((c) => boundary.claim_ids.includes(c));
    if (!claimOk) {
      issues.push({
        code: "boundary_claim_mismatch",
        detail: `hypothesis unit「${uid}」claim_ids 与 boundary.claim_ids 无交集`,
        path: "explanation_boundary.hypothesis_unit_ids",
      });
    }
    if (u.kind === "reality_fact") {
      for (const fid of u.fact_ids) {
        const resolved = resolveCanonicalPage02FactId(fid, factCtx);
        if (!resolved.ok) continue;
        if (input.factStatusById?.get(resolved.fact_id) === "confirmed") {
          issues.push({
            code: "hypothesis_confirmed_collision",
            detail: `hypothesis unit「${uid}」不得引用 confirmed 事实「${resolved.fact_id}」`,
            path: "explanation_boundary.hypothesis_unit_ids",
          });
        }
      }
    }
  }

  // Auxiliary: copy-paste of DC fact text outside reality_fact units
  const realityFactUnitTexts = new Set(
    page.content_units
      .filter((u) => u.kind === "reality_fact")
      .map((u) => u.unit_id),
  );
  for (const u of page.content_units) {
    if (realityFactUnitTexts.has(u.unit_id)) continue;
    const asserted = detectAssertedFactIdsInText(u.text, input.factContentById);
    if (asserted.length) {
      issues.push({
        code: "free_text_fact_masquerade",
        detail: `unit「${u.unit_id}」(${u.kind}) 含 DC 事实原文却非 reality_fact unit`,
        path: `content_units[${u.unit_id}]`,
      });
    }
    scanStatusUpgradeInText(
      issues,
      u.text,
      `content_units[${u.unit_id}]`,
      input.factStatusById,
      input.factContentById,
    );
  }

  const registryEvCount = Object.keys(input.registry.evidence).length;
  const cited = new Set(
    page.content_units.flatMap((u) => u.evidence_ids),
  );
  if (registryEvCount > 0 && cited.size === 0) {
    issues.push({
      code: "no_evidence_cited",
      detail: "Page02 有可用依据却未引用任何 evidence_id",
    });
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}
