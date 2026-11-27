/**
 * Unit F-R2-R3 — single server HTML artifact authority for DI2 download + email.
 *
 * Both delivery paths must call buildAuthorizedDi2HtmlArtifact() so the final
 * .html bytes are identical for the same CompletedReport + locale + title.
 * No client fullText / pages; no audio embed in this artifact (consistent offline pack).
 */

import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { getServerUser } from "@/lib/auth/supabase-server";
import { assertWriter } from "@/lib/poju/decision-authority/server/ledger-store";
import { verifyDecisionReportDelivery } from "@/lib/poju/decision-intake/decision-report-charge";
import {
  loadCompletedReport,
  verifyCompletedReportRecord,
  type CompletedReportRecord,
} from "@/lib/poju/decision-intake/decision-report-store";
import {
  DI2_HTML_TEMPLATE_VERSION,
  Di2HtmlExportError,
  di2HtmlContentIdentity,
  fillDi2AuthorityHtml,
  type Di2HtmlPackIdentity,
} from "@/lib/deliverables/di2-html-authority";

export type Di2HtmlArtifactRequest = {
  session_id: string;
  job_id: string;
  writer_token: string;
  locale: string;
  /** Optional display title; download + email must pass the same value for byte identity. */
  title?: string;
  expected_execution_generation?: number;
  expected_report_job_id?: string;
  expected_freeze_id?: string;
  expected_context_hash?: string;
};

export type Di2HtmlArtifactSuccess = {
  ok: true;
  html: string;
  record: CompletedReportRecord;
  identity: Di2HtmlPackIdentity;
  title: string;
  report_job_id: string;
  execution_generation: number;
  job_id: string;
  session_id: string;
  template_version: string;
};

export type Di2HtmlArtifactFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
};

export type Di2HtmlArtifactResult = Di2HtmlArtifactSuccess | Di2HtmlArtifactFailure;

export type Di2HtmlArtifactDeps = {
  getUser: () => Promise<{ id: string; email?: string | null } | null>;
  isAuthConfigured: () => boolean;
  assertWriter: (session_id: string, writer_token: unknown) => Promise<string>;
  loadCompletedReport: (
    session_id: string,
    job_id: string,
  ) => Promise<CompletedReportRecord | null>;
  verifyDelivery: typeof verifyDecisionReportDelivery;
  /** When true, require a signed-in user. Default true for download/email. */
  requireLogin?: boolean;
};

const defaultDeps: Di2HtmlArtifactDeps = {
  getUser: async () => {
    const u = await getServerUser();
    return u ? { id: u.id, email: u.email } : null;
  },
  isAuthConfigured: isSupabaseConfigured,
  assertWriter,
  loadCompletedReport,
  verifyDelivery: verifyDecisionReportDelivery,
  requireLogin: true,
};

let __depsForTests: Di2HtmlArtifactDeps | null = null;

/** @internal tests only */
export function __setDi2HtmlArtifactDepsForTests(deps: Di2HtmlArtifactDeps | null): void {
  __depsForTests = deps;
}

function canonicalTitle(record: CompletedReportRecord, preferred?: string): string {
  const fromClient = preferred?.trim();
  if (fromClient) return fromClient;
  const m = record.result.full_text.match(/^#\s+(.+)$/m);
  const fromMd = m?.[1]?.trim();
  if (fromMd) return fromMd;
  return record.report_job_id;
}

/**
 * Authorize Session writer + load/verify CompletedReport + build standalone HTML.
 * Deterministic: no audio; reportDate = committed_at date; reportId = report_job_id.
 */
export async function buildAuthorizedDi2HtmlArtifact(
  req: Di2HtmlArtifactRequest,
  deps: Di2HtmlArtifactDeps = __depsForTests ?? defaultDeps,
): Promise<Di2HtmlArtifactResult> {
  const session_id = req.session_id?.trim() ?? "";
  const job_id = req.job_id?.trim() ?? "";
  const writer_token = req.writer_token?.trim() ?? "";
  const locale = (req.locale || "en").trim() || "en";

  if (!session_id || !job_id) {
    return { ok: false, status: 400, code: "invalid_request", error: "session_id and job_id required" };
  }
  if (!writer_token) {
    return { ok: false, status: 401, code: "writer_required", error: "writer_token required" };
  }

  if (deps.requireLogin !== false) {
    const user = await deps.getUser();
    if (!user?.id) {
      return { ok: false, status: 401, code: "unauthorized", error: "login required" };
    }
  }

  try {
    await deps.assertWriter(session_id, writer_token);
  } catch {
    return {
      ok: false,
      status: 403,
      code: "session_forbidden",
      error: "writer_token does not authorize this session",
    };
  }

  let record: CompletedReportRecord | null;
  try {
    record = await deps.loadCompletedReport(session_id, job_id);
  } catch (e) {
    return {
      ok: false,
      status: 409,
      code: "report_invalid",
      error: e instanceof Error ? e.message : "CompletedReport invalid",
    };
  }
  if (!record) {
    return { ok: false, status: 404, code: "report_missing", error: "CompletedReport not found" };
  }

  try {
    verifyCompletedReportRecord(record);
  } catch (e) {
    return {
      ok: false,
      status: 409,
      code: "report_incomplete",
      error: e instanceof Error ? e.message : "CompletedReport incomplete",
    };
  }

  if (
    typeof req.expected_execution_generation === "number" &&
    req.expected_execution_generation !== record.execution_generation
  ) {
    return {
      ok: false,
      status: 409,
      code: "generation_mismatch",
      error: "execution_generation does not match CompletedReport",
    };
  }
  if (
    req.expected_report_job_id?.trim() &&
    req.expected_report_job_id.trim() !== record.report_job_id
  ) {
    return {
      ok: false,
      status: 409,
      code: "report_job_mismatch",
      error: "report_job_id does not match CompletedReport",
    };
  }
  if (req.expected_freeze_id?.trim() && req.expected_freeze_id.trim() !== record.freeze_id) {
    return {
      ok: false,
      status: 409,
      code: "freeze_mismatch",
      error: "freeze_id does not match CompletedReport",
    };
  }
  if (
    req.expected_context_hash?.trim() &&
    req.expected_context_hash.trim() !== record.context_hash
  ) {
    return {
      ok: false,
      status: 409,
      code: "context_mismatch",
      error: "context_hash does not match CompletedReport",
    };
  }

  const delivery = await deps.verifyDelivery({
    job_id: record.job_id,
    session_id: record.session_id,
    execution_generation: record.execution_generation,
  });
  if (!delivery.ok) {
    return {
      ok: false,
      status: 403,
      code: "delivery_denied",
      error: `Delivery Authorization failed (${delivery.reason})`,
    };
  }

  const fullText = record.result.full_text?.trim() ?? "";
  if (!fullText) {
    return { ok: false, status: 409, code: "report_empty", error: "CompletedReport has empty full_text" };
  }

  const title = canonicalTitle(record, req.title);
  let html: string;
  try {
    // Unified offline pack: never embed audio (download ≡ email bytes).
    html = fillDi2AuthorityHtml(fullText, locale, record.pages, {
      title,
      reportId: record.report_job_id,
      reportDate: record.committed_at.slice(0, 10),
    });
  } catch (e) {
    if (e instanceof Di2HtmlExportError) {
      return { ok: false, status: 409, code: e.code, error: e.message };
    }
    return {
      ok: false,
      status: 500,
      code: "html_build_failed",
      error: e instanceof Error ? e.message : "HTML build failed",
    };
  }

  const identity: Di2HtmlPackIdentity = {
    report_job_id: record.report_job_id,
    execution_generation: record.execution_generation,
    content_identity: di2HtmlContentIdentity(fullText),
    locale,
    template_version: DI2_HTML_TEMPLATE_VERSION,
  };

  return {
    ok: true,
    html,
    record,
    identity,
    title,
    report_job_id: record.report_job_id,
    execution_generation: record.execution_generation,
    job_id: record.job_id,
    session_id: record.session_id,
    template_version: DI2_HTML_TEMPLATE_VERSION,
  };
}
