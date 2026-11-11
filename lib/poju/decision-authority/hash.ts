/**
 * Deterministic hashes shared by the device mirror and the server ledger.
 * Values are JSON-normalised first so a snapshot hashes the same before and
 * after crossing the wire (undefined fields dropped, key order canonical).
 */

import { sha256 } from "@noble/hashes/sha2.js";

import { canonicalStringify } from "@/lib/poju/decision-context/normalize";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";

const textEncoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function sha256Hex(text: string): string {
  return hex(sha256(textEncoder.encode(text)));
}

export function normalizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalStringify(normalizeJson(value)));
}

/** Full DC snapshot (lifecycle fields included). */
export function dcSnapshotHash(dc: DecisionContext): string {
  return canonicalHash(dc);
}

export function blueprintHash(bp: DecisionBlueprint | null | undefined): string | null {
  return bp ? canonicalHash(bp) : null;
}
