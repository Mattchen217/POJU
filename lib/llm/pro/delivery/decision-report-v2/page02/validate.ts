/**
 * Face02 validation — schema + evidence refs + body compliance + page boundaries.
 * Fail-closed: do not strip and display.
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
import type { EvidenceRegistry } from "../types";
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

/** Page04 bottleneck diagnosis stems — category ban, not case phrases. */
const PAGE04_BOTTLENECK_RE =
  /核心卡点|真正瓶颈|若硬顶|forced\s+through|bottleneck_name|关键障碍诊断/i;

/** Page05/06 duty stems. */
const PAGE05_06_RE =
  /路径排序|首选路径完整|次选方案对比|七日内行动甘特|verification_experiment|near_step_principle/i;

const HYPOTHESIS_AS_FACT_RE =
  /已经证实|科学证明了命理|被现代科学验证|empirically\s+proven\s+by\s+bazi|science\s+confirms\s+(?:the\s+)?(?:chart|destiny)/i;

export function validateFace02Output(input: {
  raw: unknown;
  locale: string;
  registry: EvidenceRegistry;
  knownFactIds?: ReadonlySet<string>;
  /** Fact status map from slice — reject upgrades. */
  factStatusById?: ReadonlyMap<string, string>;
  /** Available personal domains for this report. */
  available_domains?: readonly string[];
  /** Page01 core judgment text — detect copy. */
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

  for (const [i, factor] of page.relevant_personal_factors.entries()) {
    issues.push(...assertClaimIdsExist(input.registry, factor.claim_ids));
    issues.push(...assertEvidenceIdsExist(input.registry, factor.evidence_ids));
    if (
      (factor.source_domain === "bazi" || factor.source_domain === "ziwei") &&
      !domains.has(factor.source_domain)
    ) {
      issues.push({
        code: "personal_domain_unavailable",
        detail: `relevant_personal_factors[${i}] source_domain=${factor.source_domain} 不可用`,
        path: `relevant_personal_factors[${i}].source_domain`,
      });
    }
    for (const eid of factor.evidence_ids) {
      const ev = input.registry.evidence[eid];
      if (!ev) continue;
      if (
        factor.source_domain === "bazi" ||
        factor.source_domain === "ziwei"
      ) {
        if (ev.source_type !== "personal_reading") {
          issues.push({
            code: "personal_evidence_type_mismatch",
            detail: `factor ${factor.factor_id} 引用非个人批断证据 ${eid}`,
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

  for (const [i, row] of page.personal_reality_interplay.entries()) {
    issues.push(...assertClaimIdsExist(input.registry, row.claim_ids));
    issues.push(
      ...assertEvidenceIdsExist(input.registry, row.personal_evidence_ids),
    );
    if (row.mechanism_evidence_ids?.length) {
      issues.push(
        ...assertEvidenceIdsExist(input.registry, row.mechanism_evidence_ids),
      );
    }
    for (const fid of row.reality_fact_ids) {
      const known =
        input.knownFactIds?.has(fid) ||
        input.knownFactIds?.has(`ev_fact_${fid}`) ||
        Boolean(input.factStatusById?.has(fid));
      if (!known) {
        issues.push({
          code: "missing_fact_id",
          detail: `personal_reality_interplay[${i}] reality_fact_id「${fid}」不在 Page02 slice`,
        });
        continue;
      }
      const status = input.factStatusById?.get(fid);
      if (
        status &&
        (status === "unverified" ||
          status === "unknown" ||
          status === "hypothesis")
      ) {
        // Allowed to cite, but text must not treat as confirmed — checked loosely via boundary.
        const blob = `${row.text} ${row.conditionality}`.toLowerCase();
        if (
          /已确认|confirmed\s+fact|definitely\s+true|已经证实该事实/.test(blob)
        ) {
          issues.push({
            code: "fact_status_upgrade",
            detail: `不得将 ${status} 事实「${fid}」升级为已确认`,
          });
        }
      }
    }
  }

  issues.push(
    ...assertClaimIdsExist(input.registry, page.why_judgment_fits.claim_ids),
  );
  issues.push(
    ...assertEvidenceIdsExist(
      input.registry,
      page.why_judgment_fits.evidence_ids,
    ),
  );

  // At least one explanatory block must cite something when registry has evidence.
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
