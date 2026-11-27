/**
 * Baseline pack email authorization (F-R2-R4).
 *
 * Baseline has no server CompletedReport. Authority basis (documented):
 * - Signed-in account (getServerUser) — required.
 * - Recipient must match account email (same product policy as DI2 delivery email).
 * - Attachment must be a baseline deliverable (meta marker), not arbitrary HTML.
 * - Optional POJU Session writer: when session_id/writer_token are supplied,
 *   assertWriter must pass. Do not invent a new Baseline identity store.
 * - Never routes through DI2 CompletedReport verification.
 */

import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { getServerUser } from "@/lib/auth/supabase-server";
import { getResendFromReports } from "@/lib/email/from-addresses";
import { sendEmail, type SendEmailResult } from "@/lib/email/resend-client";
import { getBaselinePackMailCopy } from "@/lib/email/report-mail-copy";
import { assertWriter } from "@/lib/poju/decision-authority/server/ledger-store";

export type BaselineDeliveryEmailRequest = {
  to: string;
  title: string;
  locale?: string;
  html_attachment: string;
  /** Optional POJU session binding when the vault has an active ledger session. */
  session_id?: string;
  writer_token?: string;
};

export type BaselineDeliveryEmailResult =
  | { ok: true; send: SendEmailResult & { ok: true }; pack: "baseline" }
  | { ok: false; status: number; code: string; error: string };

export type BaselineDeliveryEmailDeps = {
  getUser: () => Promise<{ id: string; email?: string | null } | null>;
  isAuthConfigured: () => boolean;
  assertWriter: (session_id: string, writer_token: unknown) => Promise<string>;
  sendEmail: typeof sendEmail;
};

const defaultDeps: BaselineDeliveryEmailDeps = {
  getUser: async () => {
    const u = await getServerUser();
    return u ? { id: u.id, email: u.email } : null;
  },
  isAuthConfigured: isSupabaseConfigured,
  assertWriter,
  sendEmail,
};

let __depsForTests: BaselineDeliveryEmailDeps | null = null;

/** @internal tests only */
export function __setBaselineDeliveryEmailDepsForTests(
  deps: BaselineDeliveryEmailDeps | null,
): void {
  __depsForTests = deps;
}

/** Live + blank baseline offline HTML share this deliverable family. */
export function isBaselineDeliverableHtml(html: string): boolean {
  const s = html.trim();
  if (s.length < 100) return false;
  return (
    /name=["']eastern-os-deliverable["']\s+content=["']baseline-profile(?:-live)?["']/i.test(s) ||
    /content=["']baseline-profile(?:-live)?["']\s+name=["']eastern-os-deliverable["']/i.test(s)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Authorize + send Baseline pack email. Does not call DI2 CompletedReport APIs.
 */
export async function sendAuthorizedBaselineDeliveryEmail(
  req: BaselineDeliveryEmailRequest,
  deps: BaselineDeliveryEmailDeps = __depsForTests ?? defaultDeps,
): Promise<BaselineDeliveryEmailResult> {
  const to = req.to?.trim() ?? "";
  const title = req.title?.trim() ?? "";
  const attachment = req.html_attachment?.trim() ?? "";
  const session_id = req.session_id?.trim() ?? "";
  const writer_token = req.writer_token?.trim() ?? "";

  if (!to || !to.includes("@")) {
    return { ok: false, status: 400, code: "invalid_to", error: "valid to email required" };
  }
  if (!title) {
    return { ok: false, status: 400, code: "title_required", error: "title required" };
  }
  if (attachment.length < 100) {
    return {
      ok: false,
      status: 400,
      code: "attachment_required",
      error: "baseline html_attachment required",
    };
  }
  if (!isBaselineDeliverableHtml(attachment)) {
    return {
      ok: false,
      status: 400,
      code: "attachment_not_baseline",
      error: "html_attachment is not a baseline deliverable",
    };
  }

  // Login required (not middleware-only; not client-only).
  const user = await deps.getUser();
  if (!user?.id) {
    return { ok: false, status: 401, code: "unauthorized", error: "login required" };
  }

  if (deps.isAuthConfigured()) {
    const accountEmail = (user.email ?? "").trim().toLowerCase();
    if (!accountEmail || accountEmail !== to.toLowerCase()) {
      return {
        ok: false,
        status: 403,
        code: "recipient_forbidden",
        error: "recipient must match the signed-in account email",
      };
    }
  }

  // Optional Session writer when the client supplies a POJU session binding.
  // Missing both is allowed (vault profile-only open has no Decision ledger).
  // One without the other, or failed assertWriter → refuse.
  if (session_id || writer_token) {
    if (!session_id || !writer_token) {
      return {
        ok: false,
        status: 401,
        code: "writer_required",
        error: "session_id and writer_token required together",
      };
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
  }

  // Never loads DI2 CompletedReport — Baseline attachment stays client-built after auth.

  const locale = (req.locale || "en").trim() || "en";
  const copy = getBaselinePackMailCopy(locale, title);
  const bodyHtml = `<div style="font-family:Arial,sans-serif;color:#1a1525;max-width:720px">
  <h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1>
  <p style="color:#444;font-size:14px;line-height:1.65;margin:0 0 20px">${copy.introHtml}</p>
  <p style="color:#999;font-size:11px;margin-top:28px">${escapeHtml(copy.footerHtml)}</p>
</div>`;

  const send = await deps.sendEmail({
    from: getResendFromReports(),
    to,
    subject: copy.subject,
    html: bodyHtml,
    text: `${title}\n\n${copy.introText}\n\n${copy.footerText}`,
    attachments: [
      {
        filename: copy.filename,
        content: attachment,
      },
    ],
    logTag: "delivery-email-baseline",
  });

  if (!send.ok) {
    return { ok: false, status: 502, code: "send_failed", error: "email send failed" };
  }

  return { ok: true, send, pack: "baseline" };
}
