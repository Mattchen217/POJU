/**
 * Phase 3 S4 — Fingerprint over the unique Normalized Object (Contract §13.5).
 * SHA-256(fingerprint_version + canonical_json(normalized_object)).
 * Different fingerprint_version ⇒ different fingerprint identity (GI-23 / P3-127).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./normalize";
import {
  normalizeCallAInput,
  type NormalizedCallAInput,
} from "./normalize-call-a";
import {
  normalizeCallBInput,
  type NormalizedCallBInput,
} from "./normalize-call-b";

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Call A fingerprint algorithm version.
 * Bump when Mapper-read field set or normalization rules for Call A change (P3-127).
 */
export const CALL_A_FINGERPRINT_VERSION = "call_a_fp_v1";

/**
 * Call B fingerprint algorithm version.
 * Bump when Mapper-read field set or normalization rules for Call B change (P3-127).
 */
export const CALL_B_FINGERPRINT_VERSION = "call_b_fp_v1";

/**
 * Fingerprint = SHA-256( fingerprint_version + canonical_json(normalized_object) ).
 * Must use the SAME Normalized Object instance/value that Mapper consumes.
 */
export function fingerprintNormalizedObject(
  fingerprint_version: string,
  normalized_object: unknown,
): string {
  if (!fingerprint_version || typeof fingerprint_version !== "string") {
    throw new Error("fingerprint_version is required");
  }
  const payload = fingerprint_version + canonicalJson(normalized_object);
  return bytesToHex(sha256(textEncoder.encode(payload)));
}

export function fingerprintCallA(normalized: NormalizedCallAInput): {
  fingerprint: string;
  fingerprint_version: string;
} {
  return {
    fingerprint_version: CALL_A_FINGERPRINT_VERSION,
    fingerprint: fingerprintNormalizedObject(
      CALL_A_FINGERPRINT_VERSION,
      normalized,
    ),
  };
}

export function fingerprintCallB(normalized: NormalizedCallBInput): {
  fingerprint: string;
  fingerprint_version: string;
} {
  return {
    fingerprint_version: CALL_B_FINGERPRINT_VERSION,
    fingerprint: fingerprintNormalizedObject(
      CALL_B_FINGERPRINT_VERSION,
      normalized,
    ),
  };
}

/**
 * Validate → Normalize → one Normalized Object → Fingerprint (+ ready for Mapper).
 * Callers MUST pass `normalized` to Mapper without re-normalizing / filtering.
 */
export function prepareCallAGeneration(raw: unknown): {
  normalized: NormalizedCallAInput;
  fingerprint: string;
  fingerprint_version: string;
} {
  const normalized = normalizeCallAInput(raw);
  const fp = fingerprintCallA(normalized);
  return { normalized, ...fp };
}

export function prepareCallBGeneration(raw: unknown): {
  normalized: NormalizedCallBInput;
  fingerprint: string;
  fingerprint_version: string;
} {
  const normalized = normalizeCallBInput(raw);
  const fp = fingerprintCallB(normalized);
  return { normalized, ...fp };
}
