/**
 * Face02 validation — schema + evidence role/provenance + claim ownership +
 * canonical DC fact status. Fail-closed: ID existence alone is never enough.
 */

import { Face02V2Schema, type Face02V2 } from "../schemas";
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
import { face02BodyTextBlob } from "./body-blob";
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

function requireEvidenceRole(
  issues: Face02Issue[],
  registry: EvidenceRegistry,
  evidenceId: string,
  expected: ReportEvidence["source_type"],
  path: string,
): ReportEvidence | null {
  const ev = registry.evidence[evidenceId];
  if (!ev) {
    issues.push({
      code: "missing_evidence_id",
      detail: `${path} 引用不存在的 evidence_id「${evidenceId}」`,
      path,
    });
    return null;
  }
  if (ev.source_type !== expected) {
    issues.push({
      code: "evidence_role_mismatch",
      detail: `${path}「${evidenceId}」source_type=${ev.source_type}，要求 ${expected}`,
      path,
    });
    return null;
  }
  return ev;
}

/**
 * Strict personal-reading provenance: domain available + both versions
 * non-empty + exact equality. Missing either side is a reject.
 */
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
      detail: `${path} 事实「${factId}」与所列 claim_ids 无可信 DC 关联（禁止全量自动授权）`,
      path,
    });
  }
}

function assertRealityFactRefsComplete(
  issues: Face02Issue[],
  text: string,
  declaredFactIds: readonly string[],
  path: string,
  factContentById: ReadonlyMap<string, string> | undefined,
  factCtx: Page02FactIdContext,
): void {
  const asserted = detectAssertedFactIdsInText(text, factContentById);
  if (!asserted.length) return;
  const declared = new Set<string>();
  for (const id of declaredFactIds) {
    const r = resolveCanonicalPage02FactId(id, factCtx);
    if (r.ok) declared.add(r.fact_id);
  }
  for (const factId of asserted) {
    if (!declared.has(factId)) {
      issues.push({
        code: "reality_fact_ref_omitted",
        detail: `${path} 正文陈述了 DC 事实「${factId}」却未提供结构化 reality_fact_ids`,
        path,
      });
    }
  }
}

type FactStatusMode = "any" | "require_confirmed" | "reject_confirmed";

function resolveAndCheckFactId(
  issues: Face02Issue[],
  inputId: string,
  path: string,
  factCtx: Page02FactIdContext,
  factStatusById: ReadonlyMap<string, string> | undefined,
  mode: FactStatusMode,
  opts?: { confirmLanguage?: boolean; textPath?: string },
): string | null {
  const resolved = resolveCanonicalPage02FactId(inputId, factCtx);
  if (!resolved.ok) {
    issues.push({
      code:
        resolved.reason === "ambiguous"
          ? "fact_id_ambiguous"
          : "missing_fact_id",
      detail: `${path} ${resolved.detail}`,
      path,
    });
    return null;
  }
  const status = factStatusById?.get(resolved.fact_id);
  if (status === undefined) {
    issues.push({
      code: "fact_status_unresolved",
      detail: `${path}「${inputId}」解析为「${resolved.fact_id}」但无原始 status（禁止别名跳过）`,
      path,
    });
    return null;
  }
  if (mode === "require_confirmed" && status !== "confirmed") {
    issues.push({
      code: "fact_status_upgrade",
      detail: `${path}「${resolved.fact_id}」原始 status=${status}，不得列入已确认依据`,
      path,
    });
    return null;
  }
  if (mode === "reject_confirmed" && status === "confirmed") {
    issues.push({
      code: "hypothesis_confirmed_collision",
      detail: `${path}「${resolved.fact_id}」是 confirmed，不得标为假设`,
      path,
    });
    return null;
  }
  if (
    opts?.confirmLanguage &&
    status !== "confirmed" &&
    mode === "any"
  ) {
    issues.push({
      code: "fact_status_upgrade",
      detail: `${opts.textPath ?? path} 将 ${status} 事实「${resolved.fact_id}」表述为已确认`,
      path: opts.textPath ?? path,
    });
  }
  return resolved.fact_id;
}

function scanStatusUpgradeInText(
  issues: Face02Issue[],
  text: string,
  path: string,
  factStatusById: ReadonlyMap<string, string> | undefined,
  factContentById: ReadonlyMap<string, string> | undefined,
): void {
  // Secondary defense only — structured fact refs are the primary integrity mechanism.
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

/**
 * Rewrite Face02 fact-id slots to canonical raw DC fact_ids (no ev_fact_ aliases).
 */
export function normalizeFace02FactIds(
  page: Face02V2,
  factCtx: Page02FactIdContext,
): Face02V2 {
  const canon = (ids: readonly string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      const r = resolveCanonicalPage02FactId(id, factCtx);
      if (!r.ok) {
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
        continue;
      }
      if (seen.has(r.fact_id)) continue;
      seen.add(r.fact_id);
      out.push(r.fact_id);
    }
    return out;
  };
  return {
    ...page,
    page_summary_reality_fact_ids: canon(page.page_summary_reality_fact_ids ?? []),
    relevant_personal_factors: page.relevant_personal_factors.map((f) => ({
      ...f,
      reality_fact_ids: canon(f.reality_fact_ids ?? []),
    })),
    personal_reality_interplay: page.personal_reality_interplay.map((r) => ({
      ...r,
      reality_fact_ids: canon(r.reality_fact_ids),
    })),
    why_judgment_fits: {
      ...page.why_judgment_fits,
      reality_fact_ids: canon(page.why_judgment_fits.reality_fact_ids ?? []),
    },
    explanation_boundary: {
      ...page.explanation_boundary,
      confirmed_fact_ids: canon(
        page.explanation_boundary.confirmed_fact_ids ?? [],
      ),
      hypothesis_fact_ids: canon(
        page.explanation_boundary.hypothesis_fact_ids ?? [],
      ),
    },
  };
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
  /** Read-only DC-credible claim↔fact keys; never from bulk auto-link. */
  credibleFactClaimKeys?: ReadonlySet<string>;
}): Face02ValidationResult {
  const parsed = Face02V2Schema.safeParse(input.raw);
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

  const bodyBlob = face02BodyTextBlob(page);
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
    if (
      norm(page.why_judgment_fits.text).includes(norm(page01Core).slice(0, 48)) ||
      norm(page.page_summary).includes(norm(page01Core).slice(0, 48))
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

  const credibleKeys = input.credibleFactClaimKeys;

  // --- page_summary: claim + fact refs (field must be present; [] = explicit empty) ---
  {
    issues.push(
      ...assertClaimIdsExist(input.registry, page.page_summary_claim_ids),
    );
    const summaryConfirm = CONFIRM_UPGRADE_RE.test(page.page_summary);
    const declared = page.page_summary_reality_fact_ids ?? [];
    for (const fid of declared) {
      const canonical = resolveAndCheckFactId(
        issues,
        fid,
        "page_summary_reality_fact_ids",
        factCtx,
        input.factStatusById,
        "any",
        { confirmLanguage: summaryConfirm, textPath: "page_summary" },
      );
      if (!canonical) continue;
      // Evidence record must exist in restricted registry.
      if (!input.registry.evidence[factEvidenceIdFor(canonical)]) {
        issues.push({
          code: "missing_evidence_id",
          detail: `page_summary_reality_fact_ids「${canonical}」无对应 reality_fact evidence`,
          path: "page_summary_reality_fact_ids",
        });
        continue;
      }
      assertFactOwnedByClaims(
        issues,
        page.page_summary_claim_ids,
        canonical,
        "page_summary_reality_fact_ids",
        credibleKeys,
      );
    }
    assertRealityFactRefsComplete(
      issues,
      page.page_summary,
      declared,
      "page_summary",
      input.factContentById,
      factCtx,
    );
  }

  // --- relevant_personal_factors ---
  for (const [i, factor] of page.relevant_personal_factors.entries()) {
    const basePath = `relevant_personal_factors[${i}]`;
    issues.push(...assertClaimIdsExist(input.registry, factor.claim_ids));
    issues.push(...assertEvidenceIdsExist(input.registry, factor.evidence_ids));

    if (
      (factor.source_domain === "bazi" || factor.source_domain === "ziwei") &&
      !domains.has(factor.source_domain)
    ) {
      issues.push({
        code: "personal_domain_unavailable",
        detail: `${basePath} source_domain=${factor.source_domain} 不可用`,
        path: `${basePath}.source_domain`,
      });
    }

    for (const eid of factor.evidence_ids) {
      const ev = input.registry.evidence[eid];
      if (!ev) continue;

      if (factor.source_domain === "bazi" || factor.source_domain === "ziwei") {
        if (ev.source_type !== "personal_reading") {
          issues.push({
            code: "evidence_role_mismatch",
            detail: `${basePath} 要求 personal_reading，得到 ${ev.source_type}（${eid}）`,
            path: basePath,
          });
          continue;
        }
        const trusted = (ev.source_domain ?? "").toLowerCase();
        if (trusted !== factor.source_domain) {
          issues.push({
            code: "evidence_domain_mismatch",
            detail: `${basePath} 声明 ${factor.source_domain}，证据「${eid}」可信域=${ev.source_domain ?? "null"}`,
            path: basePath,
          });
        }
        assertPersonalReadingProvenance(
          issues,
          ev,
          basePath,
          domains,
          domainVersions,
        );
      } else if (factor.source_domain === "science") {
        if (ev.source_type === "personal_reading") {
          issues.push({
            code: "evidence_role_mismatch",
            detail: `${basePath} science 不得把 personal_reading「${eid}」当机制依据`,
            path: basePath,
          });
        } else if (ev.source_type !== "reality_mechanism") {
          issues.push({
            code: "evidence_role_mismatch",
            detail: `${basePath} science 要求 reality_mechanism，得到 ${ev.source_type}`,
            path: basePath,
          });
        } else if (
          ev.mechanism_kind &&
          ev.mechanism_kind !== "science" &&
          ev.source_domain !== "science"
        ) {
          issues.push({
            code: "evidence_domain_mismatch",
            detail: `${basePath} science 与证据「${eid}」mechanism_kind=${ev.mechanism_kind}`,
            path: basePath,
          });
        }
      } else if (factor.source_domain === "convergence") {
        if (
          ev.source_type !== "personal_reading" &&
          ev.source_type !== "reality_mechanism"
        ) {
          issues.push({
            code: "evidence_role_mismatch",
            detail: `${basePath} convergence 证据「${eid}」类型 ${ev.source_type} 非法`,
            path: basePath,
          });
        }
        if (ev.source_type === "personal_reading") {
          assertPersonalReadingProvenance(
            issues,
            ev,
            `${basePath}.convergence`,
            domains,
            domainVersions,
          );
        }
      }

      assertEvidenceOwnedByClaims(
        issues,
        input.registry,
        factor.claim_ids,
        eid,
        basePath,
      );
    }

    const factorConfirm = CONFIRM_UPGRADE_RE.test(
      `${factor.title}\n${factor.text}`,
    );
    const factorFacts = factor.reality_fact_ids ?? [];
    for (const fid of factorFacts) {
      const canonical = resolveAndCheckFactId(
        issues,
        fid,
        `${basePath}.reality_fact_ids`,
        factCtx,
        input.factStatusById,
        "any",
        { confirmLanguage: factorConfirm, textPath: basePath },
      );
      if (!canonical) continue;
      if (!input.registry.evidence[factEvidenceIdFor(canonical)]) {
        issues.push({
          code: "missing_evidence_id",
          detail: `${basePath}.reality_fact_ids「${canonical}」无对应 reality_fact evidence`,
          path: `${basePath}.reality_fact_ids`,
        });
        continue;
      }
      assertFactOwnedByClaims(
        issues,
        factor.claim_ids,
        canonical,
        `${basePath}.reality_fact_ids`,
        credibleKeys,
      );
    }
    assertRealityFactRefsComplete(
      issues,
      `${factor.title}\n${factor.text}`,
      factorFacts,
      basePath,
      input.factContentById,
      factCtx,
    );
  }

  if (!hasPersonalDomain && page.relevant_personal_factors.length > 0) {
    const destinyFactors = page.relevant_personal_factors.filter(
      (f) => f.source_domain === "bazi" || f.source_domain === "ziwei",
    );
    if (destinyFactors.length) {
      issues.push({
        code: "invented_personal_judgment",
        detail: "无可用个人资料域时不得生成八字/紫微个人批断内容",
      });
    }
  }

  // --- personal_reality_interplay ---
  for (const [i, row] of page.personal_reality_interplay.entries()) {
    const basePath = `personal_reality_interplay[${i}]`;
    issues.push(...assertClaimIdsExist(input.registry, row.claim_ids));

    for (const eid of row.personal_evidence_ids) {
      const ev = requireEvidenceRole(
        issues,
        input.registry,
        eid,
        "personal_reading",
        `${basePath}.personal_evidence_ids`,
      );
      if (ev) {
        assertPersonalReadingProvenance(
          issues,
          ev,
          `${basePath}.personal_evidence_ids`,
          domains,
          domainVersions,
        );
        assertEvidenceOwnedByClaims(
          issues,
          input.registry,
          row.claim_ids,
          eid,
          `${basePath}.personal_evidence_ids`,
        );
      }
    }
    for (const eid of row.mechanism_evidence_ids ?? []) {
      const ev = requireEvidenceRole(
        issues,
        input.registry,
        eid,
        "reality_mechanism",
        `${basePath}.mechanism_evidence_ids`,
      );
      if (ev) {
        assertEvidenceOwnedByClaims(
          issues,
          input.registry,
          row.claim_ids,
          eid,
          `${basePath}.mechanism_evidence_ids`,
        );
      }
    }

    const interplayText = `${row.text}\n${row.conditionality}`;
    const interplayConfirm = CONFIRM_UPGRADE_RE.test(interplayText);
    for (const fid of row.reality_fact_ids) {
      const canonical = resolveAndCheckFactId(
        issues,
        fid,
        `${basePath}.reality_fact_ids`,
        factCtx,
        input.factStatusById,
        "any",
        { confirmLanguage: interplayConfirm, textPath: basePath },
      );
      if (!canonical) continue;
      if (!input.registry.evidence[factEvidenceIdFor(canonical)]) {
        issues.push({
          code: "missing_evidence_id",
          detail: `${basePath}.reality_fact_ids「${canonical}」无对应 reality_fact evidence`,
          path: `${basePath}.reality_fact_ids`,
        });
        continue;
      }
      assertFactOwnedByClaims(
        issues,
        row.claim_ids,
        canonical,
        `${basePath}.reality_fact_ids`,
        credibleKeys,
      );
    }
    assertRealityFactRefsComplete(
      issues,
      interplayText,
      row.reality_fact_ids,
      basePath,
      input.factContentById,
      factCtx,
    );

    scanStatusUpgradeInText(
      issues,
      interplayText,
      basePath,
      input.factStatusById,
      input.factContentById,
    );
  }

  // --- why_judgment_fits ---
  issues.push(
    ...assertClaimIdsExist(input.registry, page.why_judgment_fits.claim_ids),
  );
  issues.push(
    ...assertEvidenceIdsExist(
      input.registry,
      page.why_judgment_fits.evidence_ids,
    ),
  );
  for (const eid of page.why_judgment_fits.evidence_ids) {
    const ev = input.registry.evidence[eid];
    if (!ev) continue;
    assertEvidenceOwnedByClaims(
      issues,
      input.registry,
      page.why_judgment_fits.claim_ids,
      eid,
      "why_judgment_fits",
    );
    if (ev.source_type === "personal_reading") {
      assertPersonalReadingProvenance(
        issues,
        ev,
        "why_judgment_fits.evidence_ids",
        domains,
        domainVersions,
      );
    }
  }
  {
    const whyConfirm = CONFIRM_UPGRADE_RE.test(page.why_judgment_fits.text);
    const whyFacts = page.why_judgment_fits.reality_fact_ids ?? [];
    for (const fid of whyFacts) {
      const canonical = resolveAndCheckFactId(
        issues,
        fid,
        "why_judgment_fits.reality_fact_ids",
        factCtx,
        input.factStatusById,
        "any",
        { confirmLanguage: whyConfirm, textPath: "why_judgment_fits.text" },
      );
      if (!canonical) continue;
      if (!input.registry.evidence[factEvidenceIdFor(canonical)]) {
        issues.push({
          code: "missing_evidence_id",
          detail: `why_judgment_fits.reality_fact_ids「${canonical}」无对应 reality_fact evidence`,
          path: "why_judgment_fits.reality_fact_ids",
        });
        continue;
      }
      assertFactOwnedByClaims(
        issues,
        page.why_judgment_fits.claim_ids,
        canonical,
        "why_judgment_fits.reality_fact_ids",
        credibleKeys,
      );
    }
    assertRealityFactRefsComplete(
      issues,
      page.why_judgment_fits.text,
      whyFacts,
      "why_judgment_fits",
      input.factContentById,
      factCtx,
    );
  }

  // --- explanation_boundary (ownership vs boundary.claim_ids only) ---
  const boundary = page.explanation_boundary;
  issues.push(...assertClaimIdsExist(input.registry, boundary.claim_ids));
  for (const eid of boundary.personal_analysis_evidence_ids ?? []) {
    const ev = requireEvidenceRole(
      issues,
      input.registry,
      eid,
      "personal_reading",
      "explanation_boundary.personal_analysis_evidence_ids",
    );
    if (ev) {
      assertPersonalReadingProvenance(
        issues,
        ev,
        "explanation_boundary.personal_analysis_evidence_ids",
        domains,
        domainVersions,
      );
      assertEvidenceOwnedByClaims(
        issues,
        input.registry,
        boundary.claim_ids,
        eid,
        "explanation_boundary.personal_analysis_evidence_ids",
      );
    }
  }
  if (
    (boundary.personal_analysis_basis?.length ?? 0) > 0 &&
    (boundary.personal_analysis_evidence_ids?.length ?? 0) === 0
  ) {
    issues.push({
      code: "boundary_personal_unlinked",
      detail: "personal_analysis_basis 有正文却无 personal_analysis_evidence_ids",
      path: "explanation_boundary.personal_analysis_basis",
    });
  }
  if (
    !hasPersonalDomain &&
    ((boundary.personal_analysis_basis?.length ?? 0) > 0 ||
      (boundary.personal_analysis_evidence_ids?.length ?? 0) > 0)
  ) {
    issues.push({
      code: "invented_personal_judgment",
      detail: "无可用个人资料时 personal_analysis_basis 必须为空",
      path: "explanation_boundary",
    });
  }

  const boundaryConfirmed = boundary.confirmed_fact_ids ?? [];
  for (const fid of boundaryConfirmed) {
    const canonical = resolveAndCheckFactId(
      issues,
      fid,
      "explanation_boundary.confirmed_fact_ids",
      factCtx,
      input.factStatusById,
      "require_confirmed",
    );
    if (!canonical) continue;
    if (!input.registry.evidence[factEvidenceIdFor(canonical)]) {
      issues.push({
        code: "missing_evidence_id",
        detail: `confirmed_fact_ids「${canonical}」无对应 reality_fact evidence`,
        path: "explanation_boundary.confirmed_fact_ids",
      });
      continue;
    }
    assertFactOwnedByClaims(
      issues,
      boundary.claim_ids,
      canonical,
      "explanation_boundary.confirmed_fact_ids",
      credibleKeys,
    );
  }
  if (
    (boundary.confirmed_fact_basis?.length ?? 0) > 0 &&
    boundaryConfirmed.length === 0
  ) {
    issues.push({
      code: "boundary_confirmed_unlinked",
      detail: "confirmed_fact_basis 有正文却无 confirmed_fact_ids",
      path: "explanation_boundary.confirmed_fact_basis",
    });
  }
  assertRealityFactRefsComplete(
    issues,
    (boundary.confirmed_fact_basis ?? []).join("\n"),
    boundaryConfirmed,
    "explanation_boundary.confirmed_fact_basis",
    input.factContentById,
    factCtx,
  );

  const hasAnyConfirmed = [...(input.factStatusById?.entries() ?? [])].some(
    ([, s]) => s === "confirmed",
  );
  if (
    !hasAnyConfirmed &&
    ((boundary.confirmed_fact_basis?.length ?? 0) > 0 ||
      boundaryConfirmed.length > 0)
  ) {
    issues.push({
      code: "invented_confirmed_fact",
      detail: "无 confirmed DC 事实时 confirmed_fact_basis 必须为空",
      path: "explanation_boundary",
    });
  }

  const boundaryHyp = boundary.hypothesis_fact_ids ?? [];
  for (const fid of boundaryHyp) {
    const canonical = resolveAndCheckFactId(
      issues,
      fid,
      "explanation_boundary.hypothesis_fact_ids",
      factCtx,
      input.factStatusById,
      "reject_confirmed",
    );
    if (!canonical) continue;
    if (!input.registry.evidence[factEvidenceIdFor(canonical)]) {
      issues.push({
        code: "missing_evidence_id",
        detail: `hypothesis_fact_ids「${canonical}」无对应 reality_fact evidence`,
        path: "explanation_boundary.hypothesis_fact_ids",
      });
      continue;
    }
    assertFactOwnedByClaims(
      issues,
      boundary.claim_ids,
      canonical,
      "explanation_boundary.hypothesis_fact_ids",
      credibleKeys,
    );
  }

  // Secondary text heuristic across visible fields
  const visiblePaths: Array<{ text: string; path: string }> = [
    { text: page.page_summary, path: "page_summary" },
    ...page.relevant_personal_factors.map((f, i) => ({
      text: `${f.title}\n${f.text}`,
      path: `relevant_personal_factors[${i}]`,
    })),
    {
      text: page.why_judgment_fits.text,
      path: "why_judgment_fits.text",
    },
    ...(boundary.personal_analysis_basis ?? []).map((t, i) => ({
      text: t,
      path: `explanation_boundary.personal_analysis_basis[${i}]`,
    })),
    ...(boundary.confirmed_fact_basis ?? []).map((t, i) => ({
      text: t,
      path: `explanation_boundary.confirmed_fact_basis[${i}]`,
    })),
    ...(boundary.hypothesis_notes ?? []).map((t, i) => ({
      text: t,
      path: `explanation_boundary.hypothesis_notes[${i}]`,
    })),
    ...(boundary.uncertainty_notes ?? []).map((t, i) => ({
      text: t,
      path: `explanation_boundary.uncertainty_notes[${i}]`,
    })),
  ];
  for (const row of visiblePaths) {
    scanStatusUpgradeInText(
      issues,
      row.text,
      row.path,
      input.factStatusById,
      input.factContentById,
    );
  }

  const registryEvCount = Object.keys(input.registry.evidence).length;
  const cited = new Set([
    ...page.relevant_personal_factors.flatMap((f) => f.evidence_ids),
    ...page.personal_reality_interplay.flatMap((r) => r.personal_evidence_ids),
    ...page.why_judgment_fits.evidence_ids,
  ]);
  if (registryEvCount > 0 && cited.size === 0) {
    issues.push({
      code: "no_evidence_cited",
      detail: "Page02 有可用依据却未引用任何 evidence_id",
    });
  }

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    page: normalizeFace02FactIds(page, factCtx),
  };
}
