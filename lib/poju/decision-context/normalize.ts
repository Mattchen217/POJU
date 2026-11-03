/**
 * Phase 3 S4 — unique Normalization primitives (Contract §13.2).
 * Fingerprint and Mapper MUST consume the same Normalized Object produced here.
 * Ban: dual normalize stacks; coerce non-string → string; filter-then-renumber arrays.
 */

export const NORMALIZE_ILLEGAL_TYPE = "NORMALIZE_ILLEGAL_TYPE" as const;
export const NORMALIZE_VALIDATION_FAILED = "NORMALIZE_VALIDATION_FAILED" as const;

export class NormalizeError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = "NormalizeError";
    this.code = code;
    this.field = field;
  }
}

/**
 * String normalization for Mapper-read fields (Contract §13.2):
 * 1. Unicode NFC
 * 2. CRLF / CR → LF
 * 3. trim
 * 4. collapse contiguous whitespace to one ASCII space
 * 5. empty / whitespace-only → null
 * 6. non-string (except null/undefined) → FAIL (no coerce)
 */
export function normalizeMapperString(
  value: unknown,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Mapper field "${field}" must be string|null|undefined; got ${typeof value}`,
      field,
    );
  }
  // NFC
  let s = value.normalize("NFC");
  // CRLF / CR → LF
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // trim
  s = s.trim();
  // collapse whitespace (space, tab, LF, etc.) to single ASCII space
  s = s.replace(/\s+/g, " ");
  if (s.length === 0) return null;
  return s;
}

/** Boolean: keep; null/undefined → null; other → FAIL. */
export function normalizeMapperBoolean(
  value: unknown,
  field: string,
): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Mapper field "${field}" must be boolean|null|undefined; got ${typeof value}`,
      field,
    );
  }
  return value;
}

/**
 * Deterministic number for canonical JSON (Contract §13.2).
 * Non-finite → FAIL. -0 → 0.
 */
export function normalizeMapperNumber(
  value: unknown,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number") {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Mapper field "${field}" must be number|null|undefined; got ${typeof value}`,
      field,
    );
  }
  if (!Number.isFinite(value)) {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Mapper field "${field}" must be finite number`,
      field,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Preserve array order + original indices. Empty slots / holes / undefined → null.
 * MUST NOT filter-then-renumber (Hypothesis slots stay stable).
 */
export function mapArrayPreservingSlots<T>(
  raw: unknown,
  field: string,
  mapElem: (elem: unknown, index: number) => T | null,
): Array<T | null> {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Mapper field "${field}" must be array|null|undefined; got ${typeof raw}`,
      field,
    );
  }
  const out: Array<T | null> = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    // holes and undefined → null
    if (!(i in raw) || raw[i] === undefined || raw[i] === null) {
      out[i] = null;
      continue;
    }
    out[i] = mapElem(raw[i], i);
  }
  return out;
}

/** Normalize a string[] preserving slots (each elem string|null). */
export function normalizeStringArrayPreservingSlots(
  raw: unknown,
  field: string,
): Array<string | null> {
  return mapArrayPreservingSlots(raw, field, (elem, i) =>
    normalizeMapperString(elem, `${field}[${i}]`),
  );
}

/**
 * Stable canonical JSON: sorted object keys; arrays preserve order;
 * undefined object values omitted; null retained.
 * Numbers already normalized by callers for mapper payloads.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && Object.is(value, -0)) return 0;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : sortKeysDeep(v)));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = sortKeysDeep(v);
  }
  return out;
}

/** Re-export alias used by content-hash / fingerprint. */
export const canonicalStringify = canonicalJson;
