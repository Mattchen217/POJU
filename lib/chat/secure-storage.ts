import Dexie, { type Table } from "dexie";
import type { ChatMessage, ChatSession } from "@/lib/chat/types";

const LEGACY_STORE_KEY = "poju_chat_store_v1";
const ENC_KEY_STORAGE = "pojulife_chat_enc_key_v1";
const SNAPSHOT_ID = "chat_snapshot";

type ChatSnapshot = {
  sessions: ChatSession[];
  messages: ChatMessage[];
  activeSessionId: string;
};

type SnapshotRecord = {
  id: string;
  iv: string;
  cipher: string;
  updatedAt: number;
};

class PojuChatDb extends Dexie {
  snapshots!: Table<SnapshotRecord, string>;

  constructor() {
    super("poju_chat_encrypted_v1");
    this.version(1).stores({
      snapshots: "id,updatedAt",
    });
  }
}

const db = new PojuChatDb();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(ENC_KEY_STORAGE);
  if (existing) {
    return crypto.subtle.importKey("raw", fromBase64(existing).buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  localStorage.setItem(ENC_KEY_STORAGE, toBase64(raw));
  return key;
}

async function encryptText(plain: string): Promise<{ iv: string; cipher: string }> {
  const key = await getOrCreateKey();
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plain);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, encoded);
  return {
    iv: toBase64(ivBytes),
    cipher: toBase64(new Uint8Array(encrypted)),
  };
}

async function decryptText(iv: string, cipher: string): Promise<string> {
  const key = await getOrCreateKey();
  
  // 使用 as any 彻底平息参数 1 和参数 3 的类型纠葛
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) } as any,
    key,
    fromBase64(cipher) as any
  );
  
  // 这里的 decrypted 返回的是 ArrayBuffer
  return new TextDecoder().decode(new Uint8Array(decrypted as ArrayBuffer));
}

function canUseSecureStorage(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined" && typeof crypto !== "undefined";
}

export async function loadSecureChatSnapshot(): Promise<ChatSnapshot | null> {
  if (!canUseSecureStorage()) return null;
  const row = await db.snapshots.get(SNAPSHOT_ID);
  if (!row) return null;
  try {
    const plain = await decryptText(row.iv, row.cipher);
    return JSON.parse(plain) as ChatSnapshot;
  } catch {
    return null;
  }
}

export async function saveSecureChatSnapshot(snapshot: ChatSnapshot): Promise<void> {
  if (!canUseSecureStorage()) return;
  const payload = JSON.stringify(snapshot);
  const encrypted = await encryptText(payload);
  await db.snapshots.put({
    id: SNAPSHOT_ID,
    iv: encrypted.iv,
    cipher: encrypted.cipher,
    updatedAt: Date.now(),
  });
}

export async function clearSecureChatSnapshot(): Promise<void> {
  if (!canUseSecureStorage()) return;
  await db.snapshots.delete(SNAPSHOT_ID);
}

export function loadLegacySnapshot(): ChatSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChatSnapshot;
  } catch {
    return null;
  }
}

export function clearLegacySnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORE_KEY);
  } catch {
    // ignore
  }
}
