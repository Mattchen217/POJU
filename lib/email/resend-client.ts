/**
 * Single Resend send path (fetch). All product email must go through here.
 */

export type ResendAttachment = {
  filename: string;
  /** Base64 content (Resend API). */
  content: string;
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

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const tag = params.logTag ?? "email";
  const toList = Array.isArray(params.to) ? params.to : [params.to];
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    console.info(`[${tag}] resend mocked`, {
      to: toList.map((t) => t.replace(/(.{2}).+(@.+)/, "$1***$2")),
      subject: params.subject.slice(0, 80),
      from: params.from,
      attachments: params.attachments?.length ?? 0,
    });
    return { ok: true, mocked: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: toList,
        subject: params.subject,
        html: params.html,
        ...(params.text != null ? { text: params.text } : {}),
        ...(params.attachments?.length ? { attachments: params.attachments } : {}),
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      console.error(`[${tag}] resend_failed`, detail);
      return { ok: false, error: "resend_failed", detail };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, mocked: false, id: data.id ?? null };
  } catch (e) {
    console.error(`[${tag}] network_error`, e instanceof Error ? e.message : "unknown");
    return { ok: false, error: "network_error" };
  }
}

export function toBase64Utf8(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}
