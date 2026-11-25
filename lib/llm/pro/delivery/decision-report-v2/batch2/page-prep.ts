/**
 * Shared production-context + fingerprint prep (orchestrator + workers). No LLM.
 */

import {
  buildFace01ProductionContext,
  type Face01ProductionContext,
} from "../page01/production";
import {
  buildFace02ProductionContext,
  type Face02ProductionContext,
} from "../page02/production";
import { buildFace04ProductionContext } from "../page04/production";
import { buildFace05ProductionContext } from "../page05/production";
import { buildFace06ProductionContext } from "../page06/production";
import { buildFace07ProductionContext } from "../page07/production";
import { buildFace08ProductionContext } from "../page08/production";
import {
  computePageInputFingerprintFromProductionContext,
  missingRequiredUpstream,
  page02ConsumesPage01Alignment,
  requireUpstreamFingerprintsForPage,
  selectUpstreamFingerprintsForPage,
} from "../orchestration";
import type {
  ReportPage07ApplicabilityStatus,
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import type { ReportBatch2JobRecord } from "./types";

export type PageProductionPrep = {
  ctx: unknown;
  system: string;
  user: string;
  may_invoke_llm: boolean;
  prompt_version: string;
  build_fail?: { code: string; detail: string };
};

function pageSchema(job: ReportBatch2JobRecord, page_id: ReportPageId): unknown {
  return job.page_outputs[page_id] ?? undefined;
}

function upstreamFromStates(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): ReportUpstreamOutputFingerprints {
  const required = requireUpstreamFingerprintsForPage(
    page_id,
    collectOutputFingerprints(job),
  );
  if (!required.ok) {
    return selectUpstreamFingerprintsForPage(page_id, collectOutputFingerprints(job));
  }
  return required.upstream;
}

export function collectOutputFingerprints(
  job: ReportBatch2JobRecord,
): ReportUpstreamOutputFingerprints {
  const out: ReportUpstreamOutputFingerprints = {};
  for (const st of job.page_states) {
    if (st.output_fingerprint?.trim()) {
      out[st.page_id] = st.output_fingerprint.trim();
    }
  }
  return out;
}

export function buildPageProductionPrep(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): PageProductionPrep {
  const base = {
    report_id: job.inputs.report_id,
    locale: job.locale,
    dc: job.inputs.dc,
    pack: job.inputs.pack,
    chart_fact_pack: job.inputs.chart_fact_pack ?? null,
  };

  switch (page_id) {
    case "01": {
      const built = buildFace01ProductionContext({
        ...base,
        ziwei_fact_pack: job.inputs.ziwei_fact_pack ?? null,
        bazi_available: job.inputs.bazi_available,
        ziwei_available: job.inputs.ziwei_available,
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: true,
        prompt_version: ctx.prompt_version,
      };
    }
    case "02": {
      const built = buildFace02ProductionContext({
        ...base,
        ziwei_fact_pack: job.inputs.ziwei_fact_pack ?? null,
        bazi_available: job.inputs.bazi_available,
        ziwei_available: job.inputs.ziwei_available,
        page01: pageSchema(job, "01"),
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: ctx.may_invoke_llm,
        prompt_version: ctx.prompt_version,
      };
    }
    case "04": {
      const built = buildFace04ProductionContext({
        ...base,
        page01: pageSchema(job, "01"),
        page02: pageSchema(job, "02"),
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: ctx.may_invoke_llm,
        prompt_version: ctx.prompt_version,
      };
    }
    case "05": {
      const built = buildFace05ProductionContext({
        ...base,
        page01: pageSchema(job, "01"),
        page02: pageSchema(job, "02"),
        page04: pageSchema(job, "04"),
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: ctx.may_invoke_llm,
        prompt_version: ctx.prompt_version,
      };
    }
    case "06": {
      const built = buildFace06ProductionContext({
        ...base,
        page01: pageSchema(job, "01"),
        page02: pageSchema(job, "02"),
        page04: pageSchema(job, "04"),
        page05: pageSchema(job, "05"),
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: ctx.may_invoke_llm,
        prompt_version: ctx.prompt_version,
      };
    }
    case "07": {
      const built = buildFace07ProductionContext({
        ...base,
        page01: pageSchema(job, "01"),
        page02: pageSchema(job, "02"),
        page04: pageSchema(job, "04"),
        page05: pageSchema(job, "05"),
        page06: pageSchema(job, "06"),
        authorized_partner_profile: job.inputs.authorized_partner_profile,
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: ctx.may_invoke_llm,
        prompt_version: ctx.prompt_version,
      };
    }
    case "08": {
      const built = buildFace08ProductionContext({
        ...base,
        page01: pageSchema(job, "01"),
        page02: pageSchema(job, "02"),
        page04: pageSchema(job, "04"),
        page05: pageSchema(job, "05"),
        page06: pageSchema(job, "06"),
        page07: pageSchema(job, "07"),
      });
      if (!built.ok) {
        return {
          ctx: null,
          system: "",
          user: "",
          may_invoke_llm: false,
          prompt_version: "",
          build_fail: { code: built.reason, detail: built.detail ?? built.reason },
        };
      }
      const ctx = built.ctx;
      return {
        ctx,
        system: ctx.system,
        user: ctx.user,
        may_invoke_llm: ctx.may_invoke_llm,
        prompt_version: ctx.prompt_version,
      };
    }
    default:
      return {
        ctx: null,
        system: "",
        user: "",
        may_invoke_llm: false,
        prompt_version: "",
        build_fail: { code: "invalid_page", detail: String(page_id) },
      };
  }
}

export function upstreamFingerprintsForPage(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  production_ctx: unknown,
): ReportUpstreamOutputFingerprints {
  let upstream = upstreamFromStates(job, page_id);
  if (page_id === "02" && page02ConsumesPage01Alignment(production_ctx as Face02ProductionContext)) {
    const fp01 = job.page_states.find((s) => s.page_id === "01")?.output_fingerprint;
    if (fp01?.trim()) {
      upstream = { ...upstream, "01": fp01.trim() };
    }
  }
  return upstream;
}

export function computePageInputFingerprintForJob(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  prep: PageProductionPrep,
): ReturnType<typeof computePageInputFingerprintFromProductionContext> {
  const upstream = upstreamFingerprintsForPage(job, page_id, prep.ctx);
  const page07_app =
    page_id === "07" || page_id === "08"
      ? (job.page_states.find((s) => s.page_id === "07")
          ?.applicability_status as ReportPage07ApplicabilityStatus | null | undefined)
      : undefined;
  return computePageInputFingerprintFromProductionContext({
    page_id,
    production_context: prep.ctx,
    upstream_output_fingerprints: upstream,
    page07_applicability_status: page07_app,
  });
}

export function assertPageDepsReady(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): { ok: true } | { ok: false; code: string; detail: string } {
  const missing = missingRequiredUpstream(page_id, job.page_states);
  if (missing.length) {
    return {
      ok: false,
      code: "missing_required_upstream",
      detail: `missing upstream: ${missing.join(", ")}`,
    };
  }
  const req = requireUpstreamFingerprintsForPage(page_id, collectOutputFingerprints(job));
  if (!req.ok) {
    return {
      ok: false,
      code: req.code,
      detail: req.detail,
    };
  }
  return { ok: true };
}

export function isFace01Ctx(ctx: unknown): ctx is Face01ProductionContext {
  return !!ctx && typeof ctx === "object" && "knownFactIds" in ctx;
}