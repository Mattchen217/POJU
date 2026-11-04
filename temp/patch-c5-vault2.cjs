const fs = require("fs");

function replaceBetween(src, startMarker, endMarker, replacement, label) {
  const i = src.indexOf(startMarker);
  if (i < 0) throw new Error(`start not found: ${label}`);
  const j = src.indexOf(endMarker, i);
  if (j < 0) throw new Error(`end not found: ${label}`);
  return src.slice(0, i) + replacement + src.slice(j);
}

{
  const p = "lib/archive/poju-session-vault.ts";
  let s = fs.readFileSync(p, "utf8");
  const start = "/** Rename display title for a live POJU session (updates question + vault title). */";
  const end = "export async function loadPojuSessionVault";
  const replacement = `/**
 * Phase 3 C5 — rename result. Decrypt/load failure must NOT rewrite the
 * plaintext \`original_question\` index or vault title (wrong index must not
 * become the new authority). Happy path goes through Session CAS only.
 */
export type RenamePojuSessionHistoryCode =
  | "EMPTY_TITLE"
  | "NOT_FOUND"
  | "DECRYPT_OR_LOAD_FAILED"
  | "CAS_FAILED";

export type RenamePojuSessionHistoryResult =
  | { ok: true; path: "cas" }
  | { ok: false; code: RenamePojuSessionHistoryCode; message: string };

export class RenamePojuSessionHistoryError extends Error {
  readonly code: RenamePojuSessionHistoryCode;
  constructor(code: RenamePojuSessionHistoryCode, message: string) {
    super(message);
    this.name = "RenamePojuSessionHistoryError";
    this.code = code;
  }
}

/**
 * Rename display title for a live POJU session (question + vault title).
 *
 * Phase 3 C5 (Max §8 / S0 W6f):
 * - Success: Session CAS (\`savePOJUSession\`) updates blob + plaintext index together;
 *   vault title follows via post-commit archive sync.
 * - Decrypt/load failure: **fail closed** — preserve \`encrypted_data\` and the
 *   existing \`original_question\` / archive title; return \`DECRYPT_OR_LOAD_FAILED\`.
 * - Must NOT silently overwrite an existing index with an unverifiable rename.
 */
export async function renamePojuSessionHistory(
  sessionId: string,
  title: string,
  locale = "en",
): Promise<RenamePojuSessionHistoryResult> {
  void locale; // call-site compat; vault title comes from CAS post-commit sync
  const next = title.trim();
  if (!next) {
    return {
      ok: false,
      code: "EMPTY_TITLE",
      message: "rename title must be non-empty after trim",
    };
  }

  const ownerKey = await resolveLocalOwnerKey();
  const db = await ensurePojuDbReady();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: \`session row missing or not owned: \${sessionId}\`,
    };
  }

  const indexBefore = row.original_question;
  const cipherBefore = row.encrypted_data;
  const ivBefore = row.iv;
  const existingVault = await findPojuVaultRecordForSession(sessionId);
  const vaultTitleBefore = existingVault?.title;

  const { loadPOJUSession, savePOJUSession } = await import("@/lib/poju/session-manager");

  let state: POJUSessionState | null = null;
  try {
    state = await loadPOJUSession(sessionId);
  } catch (e) {
    return {
      ok: false,
      code: "DECRYPT_OR_LOAD_FAILED",
      message:
        e instanceof Error
          ? e.message
          : "session load failed; refusing plaintext index rename",
    };
  }

  if (!state) {
    // Row exists but blob unverifiable. Fail closed — do not write index or vault title.
    void indexBefore;
    void cipherBefore;
    void ivBefore;
    void vaultTitleBefore;
    return {
      ok: false,
      code: "DECRYPT_OR_LOAD_FAILED",
      message:
        "Session blob could not be decrypted/loaded; refusing plaintext index rename to preserve index↔blob consistency",
    };
  }

  try {
    await savePOJUSession({ ...state, original_question: next });
  } catch (e) {
    return {
      ok: false,
      code: "CAS_FAILED",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true, path: "cas" };
}

`;
  // Keep CRLF if file uses it
  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  const rep = replacement.replace(/\n/g, nl);
  s = replaceBetween(s, start, end, rep, "rename fn");
  fs.writeFileSync(p, s);
  console.log("patched vault");
}

{
  const p = "components/workspace/WorkspaceSidebar.tsx";
  let s = fs.readFileSync(p, "utf8");
  const from = "await renamePojuSessionHistory(row.session_id, trimmed, locale);";
  const i = s.indexOf(from);
  if (i < 0) throw new Error("sidebar call missing");
  const insert = `const renamed = await renamePojuSessionHistory(row.session_id, trimmed, locale);
        if (!renamed.ok) {
          // C5: decrypt/load fail refuses index rewrite — do not refresh as success.
          throw new Error(renamed.message);
        }`;
  s = s.slice(0, i) + insert + s.slice(i + from.length);
  fs.writeFileSync(p, s);
  console.log("patched sidebar");
}
