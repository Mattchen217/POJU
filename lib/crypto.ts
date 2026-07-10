/**
 * Local persistence encoding — plaintext JSON in IndexedDB for the current local-only phase.
 * Legacy AES-256-GCM payloads (hardcoded secret era) are still readable once for migration.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PBKDF2_SALT = textEncoder.encode("pojulife-v4-salt");
const PBKDF2_ITERATIONS = 120_000;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

function fromBase64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hasSubtle(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle);
}

function randomBytes(length: number): Uint8Array {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random is not available in this environment");
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveKeyWebCrypto(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", textEncoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: PBKDF2_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function deriveKeyNoble(secret: string): Uint8Array {
  return pbkdf2(sha256, textEncoder.encode(secret), PBKDF2_SALT, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

export type EncryptedPayload = {
  iv: string;
  cipher: string;
};

function isPlaintextPayload(payload: EncryptedPayload): boolean {
  if (!payload.iv?.trim()) return true;
  const trimmed = payload.cipher.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function tryParsePlainCipher<T>(cipher: string): T | null {
  try {
    return JSON.parse(cipher) as T;
  } catch {
    return null;
  }
}

async function legacyDecryptJson<T>(secret: string, payload: EncryptedPayload): Promise<T> {
  const iv = fromBase64(payload.iv);
  const cipher = fromBase64(payload.cipher);

  if (hasSubtle()) {
    const key = await deriveKeyWebCrypto(secret);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(iv) },
      key,
      asArrayBuffer(cipher),
    );
    return JSON.parse(textDecoder.decode(plain)) as T;
  }

  const key = deriveKeyNoble(secret);
  const aes = gcm(key, iv);
  const plain = aes.decrypt(cipher);
  return JSON.parse(textDecoder.decode(plain)) as T;
}

/** Store JSON locally — plaintext in `cipher`, empty `iv` (no pseudo-encryption). */
export async function encryptJson<T>(_secret: string, payload: T): Promise<EncryptedPayload> {
  return {
    iv: "",
    cipher: JSON.stringify(payload),
  };
}

/** Read JSON from local storage; falls back to legacy AES payloads once. */
export async function decryptJson<T>(secret: string, payload: EncryptedPayload): Promise<T> {
  if (isPlaintextPayload(payload)) {
    const parsed = tryParsePlainCipher<T>(payload.cipher);
    if (parsed != null) return parsed;
  }

  try {
    return await legacyDecryptJson<T>(secret, payload);
  } catch (error) {
    const parsed = tryParsePlainCipher<T>(payload.cipher);
    if (parsed != null) return parsed;
    throw error;
  }
}

/** @deprecated Retained for tests / one-off migration scripts only. */
export async function legacyEncryptJson<T>(secret: string, payload: T): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const plain = textEncoder.encode(JSON.stringify(payload));

  if (hasSubtle()) {
    const key = await deriveKeyWebCrypto(secret);
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      plain as BufferSource,
    );
    return {
      iv: toBase64(iv),
      cipher: toBase64(new Uint8Array(cipherBuf)),
    };
  }

  const key = deriveKeyNoble(secret);
  const aes = gcm(key, iv);
  const cipher = aes.encrypt(plain);
  return {
    iv: toBase64(iv),
    cipher: toBase64(cipher),
  };
}

export { legacyDecryptJson, isPlaintextPayload };
