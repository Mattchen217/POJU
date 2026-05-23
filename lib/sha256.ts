import { sha256 } from "@noble/hashes/sha2.js";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hex digest — works on http:// LAN (no `crypto.subtle` required). */
export function sha256Hex(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

export async function sha256HexAsync(data: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", data as BufferSource);
    return bytesToHex(new Uint8Array(buf));
  }
  return sha256Hex(data);
}
