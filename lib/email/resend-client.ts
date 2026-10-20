/**
 * Single Resend send path via official `resend` SDK.
 * All product email must go through here.
 */

import { Resend } from "resend";

export type ResendAttachment = {
  filename: string;
  /** UTF-8 string or already-base64 string; Buffer preferred for binary. */
  content: string | Buffer;
  /** When true, `content` is treated as base64 (API legacy callers). */
  contentIsBase64?: boolean;
};

export type SendEmailParams = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: ResendAttachment[];
  /** Structured log tag, e.g. delivery-email / companion */
  logTag?: string;
};

export type SendEmailResult =
  | { ok: true; mocked: true }
  | { ok: true; mocked: false; id: string | null }
  | { ok: false; error: "missing_api_key" | "resend_failed" | "network_error"; detail?: string };

let client: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const tag = params.logTag ?? "email";
  const toList = Array.isArray(params.to) ? params.to : [params.to];
  const resend = getResend();

  if (!resend) {
    console.info(`[${tag}] resend mocked`, {
      to: toList.map((t) => t.replace(/(.{2}).+(@.+)/, "$1***$2")),
      subject: params.subject.slice(0, 80),
      from: params.from,
      attachments: params.attachments?.length ?? 0,
    });
    return { ok: true, mocked: true };
  }

  try {
    const attachments = params.attachments?.map((a) => {
      const content =
        typeof a.content === "string" && a.contentIsBase64
          ? Buffer.from(a.content, "base64")
          : typeof a.content === "string"
            ? Buffer.from(a.content, "utf8")
            : a.content;
      return {
        filename: a.filename,
        content,
      };
    });

    const { data, error } = await resend.emails.send({
      from: params.from,
      to: toList,
      subject: params.subject,
      html: params.html,
      ...(params.text != null ? { text: params.text } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });

    if (error) {
      const detail = [error.name, error.message].filter(Boolean).join(": ").slice(0, 200);
      console.error(`[${tag}] resend_failed`, detail);
      return { ok: false, error: "resend_failed", detail };
    }

    return { ok: true, mocked: false, id: data?.id ?? null };
  } catch (e) {
    console.error(`[${tag}] network_error`, e instanceof Error ? e.message : "unknown");
    return { ok: false, error: "network_error" };
  }
}

/** @deprecated Prefer passing UTF-8 string/Buffer to `sendEmail` attachments. Kept for callers that already base64-encode. */
export function toBase64Utf8(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}
