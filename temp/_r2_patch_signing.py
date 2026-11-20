from pathlib import Path

p = Path(r"lib/poju/decision-authority/server/signing.ts")
text = p.read_text(encoding="utf-8")
addition = """

/** Domain-separated HMAC under the same server-only authority secret. */
export function signAuthorityDomain(domain: string, payload: string): string {
  return hmac(domain, payload);
}

export function verifyAuthorityDomain(domain: string, payload: string, signature: unknown): boolean {
  if (typeof signature !== "string" || signature.length === 0) return false;
  try {
    return safeEqualHex(hmac(domain, payload), signature);
  } catch (error) {
    if (error instanceof AuthoritySigningUnavailableError) return false;
    throw error;
  }
}
"""
if "export function signAuthorityDomain" not in text:
    p.write_text(text.rstrip() + addition + "\n", encoding="utf-8", newline="\n")
    print("patched signing.ts")
else:
    print("signing.ts already patched")
