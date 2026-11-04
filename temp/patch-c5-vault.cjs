const fs = require("fs");

function mustReplaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(`PATCH FAIL (${label}):\n${from.slice(0, 240)}`);
  if (src.indexOf(from, i + 1) >= 0) throw new Error(`not unique: ${label}`);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "lib/archive/poju-session-vault.ts";
  let s = fs.readFileSync(p, "utf8");

  s = mustReplaceOnce(
    s,
    `/** Rename display title for a live POJU session (updates question + vault title). */
export async function renamePojuSessionHistory(
  sessionId: string,
  title: string,
  locale = "en",
): Promise<void> {
  const next = title.trim();
  if (!next) return;
  const { loadPOJUSession, savePOJUSession } = await import("@/lib/poju/session-manager");
  const state = await loadPOJUSession(sessionId);
  if (state) {
    await savePOJUSession({ ...state, original_question: next });
    return;
  }
  const ownerKey = await resolveLocalOwnerKey();
  const db = await ensurePojuDbReady();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) return;
  await db.pojuSessionRecords.update(sessionId, { original_question: next });
  const existing = await findPojuVaultRecordForSession(sessionId);
  if (existing) {
    await db.archive.update(existing.archive_id, {
      title: formatVaultTitle(next, locale),
    });
  }
  notifyArchiveUpdated();
}`,
    `/**
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
  void locale; // retained for call-site compat; vault title comes from CAS post-commit sync
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

  // Snapshot index + cipher before any write — C5 proofs compare against these.
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
    // Revision mirror / hard load errors — same fail-closed rule as decrypt null.
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
    // Row exists but blob unverifiable (decrypt fail). Do NOT write original_question
    // or archive title — that would make a wrong plaintext index the new authority.
    const rowAfter = await db.pojuSessionRecords.get(sessionId);
    if (
      rowAfter &&
      (rowAfter.original_question !== indexBefore ||
        rowAfter.encrypted_data !== cipherBefore ||
        rowAfter.iv !== ivBefore)
    ) {
      // Defensive: we did not write; if something else raced, still report fail-closed.
    }
    if (existingVault && vaultTitleBefore !== undefined) {
      const vaultNow = await db.archive.get(existingVault.archive_id);
      if (vaultNow && vaultNow.title !== vaultTitleBefore) {
        // No vault title write on this path either.
      }
    }
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
    // CAS/core failed — encrypted blob and index must remain prior values (CAS abort).
    return {
      ok: false,
      code: "CAS_FAILED",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true, path: "cas" };
}`,
    "rewrite renamePojuSessionHistory C5",
  );

  fs.writeFileSync(p, s);
  console.log("patched vault rename");
}

// Sidebar: honor result.ok before onChanged
{
  const p = "components/workspace/WorkspaceSidebar.tsx";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("await renamePojuSessionHistory(row.session_id, trimmed, locale);")) {
    s = mustReplaceOnce(
      s,
      `        await renamePojuSessionHistory(row.session_id, trimmed, locale);
      } else {
        await renameArchiveItem(row.archive_id, trimmed);
      }
      onChanged();`,
      `        const renamed = await renamePojuSessionHistory(row.session_id, trimmed, locale);
        if (!renamed.ok) {
          // C5: decrypt/load fail refuses index rewrite — do not refresh as success.
          throw new Error(renamed.message);
        }
      } else {
        await renameArchiveItem(row.archive_id, trimmed);
      }
      onChanged();`,
      "sidebar honor rename result",
    );
    fs.writeFileSync(p, s);
    console.log("patched sidebar");
  } else {
    console.log("sidebar anchor not found — check manually");
  }
}
