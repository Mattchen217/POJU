/**
 * M4 — server signatures for ledger writer tokens, Freeze receipts and profile receipts.
 * HMAC-SHA256 under a server-only secret; the device can hold receipts but cannot mint them.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalStringify } from "@/lib/poju/decision-context/normalize";
import { normalizeJson } from "../hash";
import type { FreezeReceipt, ProfileReceipt } from "../types";

const DEV_FALLBACK_SECRET = "poju-decision-authority-dev-only";

export class AuthoritySigningUnavailableError extends Error {
  readonly code = "DC_AUTHORITY_SIGNING_UNAVAILABLE";
  constructor() {
    super("Decision authority signing secret is not configured");
    this.name = "AuthoritySigningUnavailableError";
  }
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_ENV?.trim());
}

function resolveSecret(): string {
  const configured =
    process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim() ||
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    "";
  if (configured) return configured;
  if (isProductionRuntime()) throw new AuthoritySigningUnavailableError();
  return DEV_FALLBACK_SECRET;
}

/** Non-secret identifier of the active key (rotation diagnostics). */
export function authorityKeyId(): string {
  return createHash("sha256").update(`poju-authority-key|${resolveSecret()}`).digest("hex").slice(0, 12);
}

function hmac(domain: string, payload: string): string {
  return createHmac("sha256", resolveSecret()).update(`${domain}\n${payload}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function issueWriterToken(session_id: string, genesis_entry_hash: string): string {
  return hmac("poju-dc-ledger-writer", `${session_id}|${genesis_entry_hash}`);
}

export function verifyWriterToken(session_id: string, genesis_entry_hash: string, token: unknown): boolean {
  return typeof token === "string" && safeEqualHex(issueWriterToken(session_id, genesis_entry_hash), token);
}

type Unsigned<T extends { signature: string }> = Omit<T, "signature">;

function signedPayload<T extends { signature: string }>(r: Unsigned<T> | T): string {
  const { signature: _s, ...rest } = normalizeJson(r) as T;
  return canonicalStringify(rest);
}

export function signFreezeReceipt(r: Unsigned<FreezeReceipt>): FreezeReceipt {
  return { ...r, signature: hmac("poju-freeze-receipt", signedPayload<FreezeReceipt>(r)) };
}

export function verifyFreezeReceiptSignature(r: FreezeReceipt): boolean {
  return Boolean(r?.signature) && safeEqualHex(hmac("poju-freeze-receipt", signedPayload(r)), r.signature);
}

export function signProfileReceipt(r: Unsigned<ProfileReceipt>): ProfileReceipt {
  return { ...r, signature: hmac("poju-profile-receipt", signedPayload<ProfileReceipt>(r)) };
}

export function verifyProfileReceiptSignature(r: ProfileReceipt): boolean {
  return Boolean(r?.signature) && safeEqualHex(hmac("poju-profile-receipt", signedPayload(r)), r.signature);
}
