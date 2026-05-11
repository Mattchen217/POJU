import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { getPojuDb } from "@/lib/db/poju-db";
import { getUserProfile } from "@/lib/profile/storage";

const FP_CACHE_KEY = "pojulife_v4_fp";
let started = false;

export async function initApp(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;

  getPojuDb();
  void getUserProfile();

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    localStorage.setItem(FP_CACHE_KEY, result.visitorId);
  } catch {
    // ignore fingerprint failures in private mode / strict browsers
  }
}
