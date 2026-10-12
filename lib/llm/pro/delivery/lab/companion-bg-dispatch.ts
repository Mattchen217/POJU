/**
 * Companion Lab long LLM — must not share the browser HTTP connection.
 * Same idea as delivery continue: QStash (preferred) or in-process after()/waitUntil.
 */

import { continueOrigin } from "@/lib/poju/delivery-continue-dispatch";

export const LAB_COMPANION_BG_HEADER = "x-lab-companion-bg";

export function companionBgSecret(): string | null {
  const s = process.env.OPS_SESSION_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export function verifyCompanionBgSecret(header: string | null): boolean {
  const expected = companionBgSecret();
  if (!expected || !header) return false;
  return header === expected;
}

function qstashToken(): string | null {
  const t = process.env.QSTASH_TOKEN?.trim();
  return t || null;
}

export type CompanionBgPayload = {
  lab_id: string;
  step_key: string;
  polish_locale?: string;
  skip_polish?: boolean;
  day_index?: number;
};

/** External hop → fresh Vercel invoke with its own maxDuration=300. */
export async function publishCompanionBgViaQStash(
  payload: CompanionBgPayload,
): Promise<"published" | "failed" | "no_qstash"> {
  const token = qstashToken();
  const secret = companionBgSecret();
  const origin = continueOrigin();
  if (!token) return "no_qstash";
  if (!secret || !origin) return "failed";

  const destination = `${origin}/api/ops/delivery-lab/${encodeURIComponent(payload.lab_id)}/companion-bg`;
  const publishUrl = `https://qstash.upstash.io/v2/publish/${destination}`;

  try {
    const res = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Forward-Content-Type": "application/json",
        [`Upstash-Forward-${LAB_COMPANION_BG_HEADER}`]: secret,
        "Upstash-Retries": "2",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[lab-companion] QStash publish non-ok", {
        status: res.status,
        body: text.slice(0, 300),
      });
      return "failed";
    }
    console.info("[lab-companion] QStash companion-bg published", {
      lab_id: payload.lab_id,
      step_key: payload.step_key,
      day_index: payload.day_index,
    });
    return "published";
  } catch (e) {
    console.warn("[lab-companion] QStash publish failed", e);
    return "failed";
  }
}
