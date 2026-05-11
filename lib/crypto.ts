const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function requireCrypto(): Crypto {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto is not available");
  }
  return crypto;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const c = requireCrypto();
  const material = await c.subtle.importKey("raw", textEncoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return c.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textEncoder.encode("pojulife-v4-salt"),
      iterations: 120_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EncryptedPayload = {
  iv: string;
  cipher: string;
};

export async function encryptJson<T>(secret: string, payload: T): Promise<EncryptedPayload> {
  const c = requireCrypto();
  const key = await deriveKey(secret);
  const iv = c.getRandomValues(new Uint8Array(12));
  const cipherBuf = await c.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );

  return {
    iv: toBase64(iv),
    cipher: toBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptJson<T>(secret: string, payload: EncryptedPayload): Promise<T> {
  const c = requireCrypto();
  const key = await deriveKey(secret);
  const plain = await c.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(fromBase64(payload.iv)) },
    key,
    asArrayBuffer(fromBase64(payload.cipher)),
  );
  return JSON.parse(textDecoder.decode(plain)) as T;
}
