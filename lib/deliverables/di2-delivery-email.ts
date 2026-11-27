/**
 * DI2 delivery email — attaches the same server HTML artifact as download (F-R2-R3).
 * Client html_attachment is ignored for pack=delivery.
 */

import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { getServerUser } from "@/lib/auth/supabase-server";
import { getResendFromReports } from "@/lib/email/from-addresses";
import { sendEmail, type SendEmailResult } from "@/lib/email/resend-client";
import { getDecisionReportMailCopy } from "@/lib/email/report-mail-copy";
import {
  buildAuthorizedDi2HtmlArtifact,
  type Di2HtmlArtifactDeps,
  type Di2HtmlArtifactRequest,
  __setDi2HtmlArtifactDepsForTests,
} from "@/lib/deliverables/di2-html-artifact";
import { DI2_HTML_TEMPLATE_VERSION } from "@/lib/deliverables/di2-html-authority";
import { assertWriter } from "@/lib/poju/decision-authority/server/ledger-store";
import { verifyDecisionReportDelivery } from "@/lib/poju/decision-intake/decision-report-charge";
import { loadCompletedReport } from "@/lib/poju/decision-intake/decision-report-store";

export type Di2DeliveryEmailRequest = Di2HtmlArtifactRequest & {
  to: string;
  body_text?: string;
  /** Ignored for DI2 — server regenerates HTML from CompletedReport. */
  html_attachment?: string;
  pack?: string;
};

export type Di2DeliveryEmailSuccess = {
  ok: true;
  html: string;
  send: SendEmailResult & { ok: true };
  report_job_id: string;
  execution_generation: number;
  template_version: string;
};

export type Di2DeliveryEmailFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
};

export type Di2DeliveryEmailResult = Di2DeliveryEmailSuccess | Di2DeliveryEmailFailure;

export type Di2DeliveryEmailDeps = Di2HtmlArtifactDeps & {
  sendEmail: typeof sendEmail;
};

const defaultEmailDeps: Di2DeliveryEmailDeps = {
  getUser: async () => {
    const u = await getServerUser();
    return u ? { id: u.id, email: u.email } : null;
  },
  isAuthConfigured: isSupabaseConfigured,
  assertWriter,
  loadCompletedReport,
  verifyDelivery: verifyDecisionReportDelivery,
  requireLogin: true,
  sendEmail,
};

let __emailDepsForTests: Di2DeliveryEmailDeps | null = null;

/** @internal tests only */
export function __setDi2DeliveryEmailDepsForTests(deps: Di2DeliveryEmailDeps | null): void {
  __emailDepsForTests = deps;
  if (deps) {
    const { sendEmail: _s, ...artifactDeps } = deps;
    __setDi2HtmlArtifactDepsForTests({ ...artifactDeps, requireLogin: deps.requireLogin ?? true });
  } else {
    __setDi2HtmlArtifactDepsForTests(null);
  }
}

export async function sendAuthorizedDi2DeliveryEmail(
  req: Di2DeliveryEmailRequest,
  deps: Di2DeliveryEmailDeps = __emailDepsForTests ?? defaultEmailDeps,
): Promise<Di2DeliveryEmailResult> {
  const to = req.to?.trim() ?? "";
  if (!to || !to.includes("@")) {
    return { ok: false, status: 400, code: "invalid_to", error: "valid to email required" };
  }

  // Recipient must match signed-in account when auth is configured.
  if (deps.isAuthConfigured()) {
    const user = await deps.getUser();
    if (!user?.id) {
      return { ok: false, status: 401, code: "unauthorized", error: "login required" };
    }
    const accountEmail = (user.email ?? "").trim().toLowerCase();
    if (!accountEmail || accountEmail !== to.toLowerCase()) {
      return {
        ok: false,
        status: 403,
        code: "recipient_forbidden",
        error: "recipient must match the signed-in account email",
      };
    }
  } else {
    const user = await deps.getUser();
    if (!user?.id) {
      return { ok: false, status: 401, code: "unauthorized", error: "login required" };
    }
  }

  const artifact = await buildAuthorizedDi2HtmlArtifact(
    {
      session_id: req.session_id,
      job_id: req.job_id,
      writer_token: req.writer_token,
      locale: req.locale,
      title: req.title,
      expected_execution_generation: req.expected_execution_generation,
      expected_report_job_id: req.expected_report_job_id,
      expected_freeze_id: req.expected_freeze_id,
      expected_context_hash: req.expected_context_hash,
    },
    { ...deps, requireLogin: false }, // login already checked above with recipient bind
  );

  if (!artifact.ok) {
    return {
      ok: false,
      status: artifact.status,
      code: artifact.code,
      error: artifact.error,
    };
  }

  const locale = (req.locale || "en").trim() || "en";
  const copy = getDecisionReportMailCopy(locale, artifact.title);
  const bodyHtml = `<div style="font-family:Arial,sans-serif;color:#1a1525;max-width:720px">
  <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(artifact.title || copy.subject)}</h1>
  <p style="color:#444;font-size:14px;line-height:1.65;margin:0 0 20px">${copy.introHtml}</p>
  <p style="color:#999;font-size:11px;margin-top:28px">${escapeHtml(copy.footerHtml)}</p>
</div>`;

  const send = await deps.sendEmail({
    from: getResendFromReports(),
    to,
    subject: copy.subject,
    html: bodyHtml,
    text: `${artifact.title || copy.subject}\n\n${copy.introText}\n\n${copy.footerText}`,
    attachments: [
      {
        filename: copy.filename,
        content: artifact.html,
      },
    ],
    logTag: "delivery-email",
  });

  if (!send.ok) {
    return {
      ok: false,
      status: 502,
      code: "send_failed",
      error: "email send failed",
    };
  }

  return {
    ok: true,
    html: artifact.html,
    send,
    report_job_id: artifact.report_job_id,
    execution_generation: artifact.execution_generation,
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
