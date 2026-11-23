/**
 * Face02 validation — schema + evidence role/provenance + body compliance.
 * Fail-closed: ID existence alone is not enough — type/domain/claim ownership required.
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
  /核心卡点|真正瓶颈|若硬顶|forced\s+through|bottleneck_name|关键障碍诊断/i;

const PAGE05_06_RE =
  /路径排序|首选路径完整|次选方案对比|七日内行动甘特|verification_experiment|near_step_principle/i;

const HYPOTHESIS_AS_FACT_RE =
  /已经证实|科学证明了命理|被现代科学验证|empirically\s+proven\s+by\s+bazi|science\s+confirms\s+(?:the\s+)?(?:chart|destiny)/i;

const CONFIRM_UPGRADE_RE =
  /已确认|已经确认|confirmed\s+fact|definitely\s+true|已经证实该事实|确凿事实|as\s+confirmed/i;

function evidenceSupportsClaim(
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
    // Unique-ish fragment of the fact statement appears alongside confirmation language.
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

  // --- relevant_personal_factors: strict domain + role ---
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
        const expectedVer =
          factor.source_domain === "bazi"
            ? domainVersions.bazi
            : domainVersions.ziwei;
        if (
          expectedVer &&
          ev.source_version &&
          ev.source_version !== expectedVer
        ) {
          issues.push({
            code: "evidence_version_mismatch",
            detail: `${basePath} 证据「${eid}」version=${ev.source_version} ≠ profile ${expectedVer}`,
            path: basePath,
          });
        }
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
        // Must still pass role checks — no bypass.
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
        if (
          ev.source_type === "personal_reading" &&
          ev.source_domain &&
          !domains.has(String(ev.source_domain).toLowerCase())
        ) {
          issues.push({
            code: "personal_domain_unavailable",
            detail: `${basePath} convergence 引用不可用个人域证据「${eid}」`,
            path: basePath,
          });
        }
      }
    }
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

  // --- personal_reality_interplay: role-separated slots ---
  for (const [i, row] of page.personal_reality_interplay.entries()) {
    const basePath = `personal_reality_interplay[${i}]`;
    issues.push(...assertClaimIdsExist(input.registry, row.claim_ids));

    for (const eid of row.personal_evidence_ids) {
      requireEvidenceRole(
        issues,
        input.registry,
        eid,
        "personal_reading",
        `${basePath}.personal_evidence_ids`,
      );
    }
    for (const eid of row.mechanism_evidence_ids ?? []) {
      requireEvidenceRole(
        issues,
        input.registry,
        eid,
        "reality_mechanism",
        `${basePath}.mechanism_evidence_ids`,
      );
    }

    const interplayText = `${row.text}\n${row.conditionality}`;
    for (const fid of row.reality_fact_ids) {
      const known =
        input.knownFactIds?.has(fid) ||
        input.knownFactIds?.has(`ev_fact_${fid}`) ||
        Boolean(input.factStatusById?.has(fid));
      if (!known) {
        issues.push({
          code: "missing_fact_id",
          detail: `${basePath} reality_fact_id「${fid}」不在 Page02 slice`,
          path: basePath,
        });
        continue;
      }
      const status = input.factStatusById?.get(fid);
      if (
        status &&
        status !== "confirmed" &&
        CONFIRM_UPGRADE_RE.test(interplayText)
      ) {
        issues.push({
          code: "fact_status_upgrade",
          detail: `${basePath} 将 ${status} 事实「${fid}」表述为已确认`,
          path: basePath,
        });
      }
    }

    scanStatusUpgradeInText(
      issues,
      interplayText,
      basePath,
      input.factStatusById,
      input.factContentById,
    );
  }

  // --- why_judgment_fits: claim↔evidence ownership ---
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
    if (!input.registry.evidence[eid]) continue;
    const owned = page.why_judgment_fits.claim_ids.some((cid) =>
      evidenceSupportsClaim(input.registry, cid, eid),
    );
    if (!owned) {
      issues.push({
        code: "claim_evidence_orphan",
        detail: `why_judgment_fits 证据「${eid}」与所列 claim_ids 无归属关系`,
        path: "why_judgment_fits",
      });
    }
  }

  // --- explanation_boundary: structured refs + empty-ok ---
  const boundary = page.explanation_boundary;
  for (const eid of boundary.personal_analysis_evidence_ids ?? []) {
    requireEvidenceRole(
      issues,
      input.registry,
      eid,
      "personal_reading",
      "explanation_boundary.personal_analysis_evidence_ids",
    );
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

  for (const fid of boundary.confirmed_fact_ids ?? []) {
    const known =
      input.knownFactIds?.has(fid) ||
      input.knownFactIds?.has(`ev_fact_${fid}`) ||
      Boolean(input.factStatusById?.has(fid));
    if (!known) {
      issues.push({
        code: "missing_fact_id",
        detail: `confirmed_fact_ids「${fid}」不在 Page02 slice`,
        path: "explanation_boundary.confirmed_fact_ids",
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (status && status !== "confirmed") {
      issues.push({
        code: "fact_status_upgrade",
        detail: `confirmed_fact_ids「${fid}」原始 status=${status}，不得列入已确认依据`,
        path: "explanation_boundary.confirmed_fact_ids",
      });
    }
  }
  if (
    (boundary.confirmed_fact_basis?.length ?? 0) > 0 &&
    (boundary.confirmed_fact_ids?.length ?? 0) === 0
  ) {
    issues.push({
      code: "boundary_confirmed_unlinked",
      detail: "confirmed_fact_basis 有正文却无 confirmed_fact_ids",
      path: "explanation_boundary.confirmed_fact_basis",
    });
  }

  const hasAnyConfirmed = [...(input.factStatusById?.entries() ?? [])].some(
    ([, s]) => s === "confirmed",
  );
  if (
    !hasAnyConfirmed &&
    ((boundary.confirmed_fact_basis?.length ?? 0) > 0 ||
      (boundary.confirmed_fact_ids?.length ?? 0) > 0)
  ) {
    issues.push({
      code: "invented_confirmed_fact",
      detail: "无 confirmed DC 事实时 confirmed_fact_basis 必须为空",
      path: "explanation_boundary",
    });
  }

  for (const fid of boundary.hypothesis_fact_ids ?? []) {
    const known =
      input.knownFactIds?.has(fid) ||
      input.knownFactIds?.has(`ev_fact_${fid}`) ||
      Boolean(input.factStatusById?.has(fid));
    if (!known) {
      issues.push({
        code: "missing_fact_id",
        detail: `hypothesis_fact_ids「${fid}」不在 Page02 slice`,
        path: "explanation_boundary.hypothesis_fact_ids",
      });
      continue;
    }
    const status = input.factStatusById?.get(fid);
    if (status === "confirmed") {
      issues.push({
        code: "hypothesis_confirmed_collision",
        detail: `hypothesis_fact_ids「${fid}」是 confirmed，不得标为假设`,
        path: "explanation_boundary.hypothesis_fact_ids",
      });
    }
  }

  // Status upgrade across all visible fields
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

  // At least one explanatory cite when registry has evidence.
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
  return { ok: true, page };
}
