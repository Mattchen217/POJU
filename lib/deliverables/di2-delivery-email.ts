/**
 * Unit F-R2 Repair — server-side DI2 delivery email.
 * Never trusts client html_attachment as the report body.
 */

import { getDecisionReportMailCopy } from "@/lib/email/report-mail-copy";
import { getResendFromReports } from "@/lib/email/from-addresses";
import { sendEmail, type SendEmailResult } from "@/lib/email/resend-client";
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
  fillDi2AuthorityHtml,
} from "@/lib/deliverables/di2-html-authority";

export type Di2DeliveryEmailRequest = {
  session_id: string;
  job_id: string;
  writer_token: string;
  locale: string;
  to: string;
  title?: string;
  /** Ignored for report body — kept only so clients can stop sending it gradually. */
  html_attachment?: string;
  expected_execution_generation?: number;
  expected_report_job_id?: string;
  expected_freeze_id?: string;
  expected_context_hash?: string;
};

export type Di2DeliveryEmailResult =
  | {
      ok: true;
      html: string;
      send: SendEmailResult;
      report_job_id: string;
      execution_generation: number;
      template_version: string;
    }
  | { ok: false; status: number; code: string; error: string };

export type Di2DeliveryEmailDeps = {
  getUser: () => Promise<{ id: string; email?: string | null } | null>;
  isAuthConfigured: () => boolean;
  assertWriter: (session_id: string, writer_token: unknown) => Promise<string>;
  loadCompletedReport: (
    session_id: string,
    job_id: string,
  ) => Promise<CompletedReportRecord | null>;
  verifyDelivery: typeof verifyDecisionReportDelivery;
  sendEmail: typeof sendEmail;
};

const defaultDeps: Di2DeliveryEmailDeps = {
  getUser: async () => {
    const u = await getServerUser();
    return u ? { id: u.id, email: u.email } : null;
  },
  isAuthConfigured: isSupabaseConfigured,
  assertWriter,
  loadCompletedReport,
  verifyDelivery: verifyDecisionReportDelivery,
  sendEmail,
};

let __depsForTests: Di2DeliveryEmailDeps | null = null;

/** @internal tests only */
export function __setDi2DeliveryEmailDepsForTests(deps: Di2DeliveryEmailDeps | null): void {
  __depsForTests = deps;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmailShape(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

/**
 * Authorize + load CompletedReport + build HTML + send.
 * Client-supplied html_attachment is never used as the report artifact.
 */
export async function sendAuthorizedDi2DeliveryEmail(
  req: Di2DeliveryEmailRequest,
  deps: Di2DeliveryEmailDeps = __depsForTests ?? defaultDeps,
): Promise<Di2DeliveryEmailResult> {
  const session_id = req.session_id?.trim() ?? "";
  const job_id = req.job_id?.trim() ?? "";
  const writer_token = req.writer_token?.trim() ?? "";
  const locale = (req.locale || "en").trim() || "en";
  const to = normalizeEmail(req.to ?? "");

  if (!session_id || !job_id) {
    return { ok: false, status: 400, code: "invalid_request", error: "session_id and job_id required" };
  }
  if (!writer_token) {
    return { ok: false, status: 401, code: "writer_required", error: "writer_token required" };
  }
  if (!isEmailShape(to)) {
    return { ok: false, status: 400, code: "invalid_recipient", error: "invalid recipient email" };
  }

  if (deps.isAuthConfigured()) {
    const user = await deps.getUser();
    if (!user?.id) {
      return { ok: false, status: 401, code: "unauthorized", error: "login required" };
    }
    const accountEmail = user.email ? normalizeEmail(user.email) : "";
    if (!accountEmail || accountEmail !== to) {
      return {
        ok: false,
        status: 403,
        code: "recipient_forbidden",
        error: "recipient must match the signed-in account email",
      };
    }
  } else {
    // Local / test without Supabase: still require an explicit authenticated principal.
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

  let html: string;
  try {
    html = fillDi2AuthorityHtml(fullText, locale, record.pages, {
      title: req.title?.trim() || undefined,
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

  const copy = getDecisionReportMailCopy(locale, req.title?.trim() || record.report_job_id);
  const bodyHtml = `<div style="font-family:Arial,sans-serif;color:#1a1525;max-width:720px">
  <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(req.title?.trim() || copy.subject)}</h1>
  <p style="color:#444;font-size:14px;line-height:1.65;margin:0 0 20px">${copy.introHtml}</p>
  <p style="color:#999;font-size:11px;margin-top:28px">${escapeHtml(copy.footerHtml)}</p>
</div>`;

  const send = await deps.sendEmail({
    from: getResendFromReports(),
    to,
    subject: copy.subject,
    html: bodyHtml,
    text: `${req.title?.trim() || copy.subject}\n\n${copy.introText}\n\n${copy.footerText}`,
    attachments: [
      {
        filename: copy.filename,
        content: html,
      },
    ],
    logTag: "delivery-email",
  });

  if (!send.ok) {
    return {
      ok: false,
      status: 502,
      code: send.error,
      error: send.detail || "email send failed",
    };
  }

  return {
    ok: true,
    html,
    send,
    report_job_id: record.report_job_id,
    execution_generation: record.execution_generation,
    template_version: DI2_HTML_TEMPLATE_VERSION,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
