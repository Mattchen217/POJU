import { createHash } from "node:crypto";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

/** Recursively sort object keys for byte-stable JSON. */
function stableSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortKeys);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = stableSortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Slice of ProfileStructured fields that affect thesis judgments.
 * Order of keys in the payload is stabilized before hashing.
 */
export function extractThesisFingerprintPayload(structured: ProfileStructured): Record<string, unknown> {
  const detail = structured.pillars_detail;
  const tenGods = detail
    ? {
        year: String(detail.year?.ten_god ?? ""),
        month: String(detail.month?.ten_god ?? ""),
        day: String(detail.day?.ten_god ?? ""),
        hour: String(detail.hour?.ten_god ?? ""),
      }
    : null;

  return {
    day_master: String(structured.day_master ?? ""),
    strength: String(structured.strength ?? ""),
    pattern: String(structured.pattern ?? ""),
    yong_shen: String(structured.yong_shen ?? ""),
    xi_shen: [...(structured.xi_shen ?? [])].map(String),
    ji_shen: [...(structured.ji_shen ?? [])].map(String),
    pillars_detail_ten_gods: tenGods,
    da_yun_ganzi: (structured.da_yun ?? []).map((d) => String(d.ganzhi ?? "")),
  };
}

/** Stable SHA-256 hex (first 32 chars) of judgment-affecting structured fields. */
export function fingerprintThesisStructured(structured: ProfileStructured): string {
  const payload = extractThesisFingerprintPayload(structured);
  const json = JSON.stringify(stableSortKeys(payload));
  return createHash("sha256").update(json, "utf8").digest("hex").slice(0, 32);
}
