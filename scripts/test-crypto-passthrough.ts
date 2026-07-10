/**
 * Local crypto passthrough + legacy read compatibility.
 *
 *   pnpm exec tsx scripts/test-crypto-passthrough.ts
 */
import {
  decryptJson,
  encryptJson,
  isPlaintextPayload,
  legacyDecryptJson,
  legacyEncryptJson,
} from "@/lib/crypto";

const SECRET = "pojulife_v4_poju_session";

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("\n=== crypto passthrough ===\n");

  const sample = { session_id: "s1", messages: [{ role: "user", content: "hi" }] };
  const encoded = await encryptJson(SECRET, sample);
  assert("encrypt uses empty iv", encoded.iv === "");
  assert("encrypt stores plain json", isPlaintextPayload(encoded));
  const roundTrip = await decryptJson<typeof sample>(SECRET, encoded);
  assert("round-trip matches", roundTrip.session_id === "s1");

  const legacy = await legacyEncryptJson(SECRET, sample);
  assert("legacy has iv", legacy.iv.length > 0);
  const fromLegacy = await decryptJson<typeof sample>(SECRET, legacy);
  assert("legacy decrypt via decryptJson", fromLegacy.session_id === "s1");
  const fromLegacyDirect = await legacyDecryptJson<typeof sample>(SECRET, legacy);
  assert("legacy decrypt direct", fromLegacyDirect.session_id === "s1");

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
