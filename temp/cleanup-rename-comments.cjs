const fs = require("fs");

function fixFile(path, replacements) {
  let s = fs.readFileSync(path, "utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  for (const [a, b] of replacements) {
    if (!s.includes(a)) {
      console.error("missing in", path, ":", JSON.stringify(a).slice(0, 80));
      process.exit(1);
    }
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
  console.log("fixed", path);
}

// Fix rename: only update UI rows after successful core persist; ASCII comments
fixFile("components/poju/POJUChatUI.tsx", [
  [
`  async function handleRenameSession(targetSessionId: string, newTitle: string) {
    const value = newTitle.trim();
    if (!value) return;

    // Rename must commit only through savePOJUSessionCore (C1): plaintext index
    // + encrypted blob stay consistent `,
`  async function handleRenameSession(targetSessionId: string, newTitle: string) {
    const value = newTitle.trim();
    if (!value) return;

    // Rename commits only through savePOJUSessionCore (C1) so plaintext index
    // + encrypted blob stay consistent `,
  ],
]);

// Re-read and do a more robust replace for the whole function body
{
  let s = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
  const start = s.indexOf("  async function handleRenameSession(targetSessionId: string, newTitle: string) {");
  const endMarker = "  async function handleDeleteSession(targetSessionId: string) {";
  const end = s.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    console.error("rename/delete markers not found");
    process.exit(1);
  }
  const neu = `  async function handleRenameSession(targetSessionId: string, newTitle: string) {
    const value = newTitle.trim();
    if (!value) return;

    // Rename commits only through savePOJUSessionCore (C1) so plaintext index
    // + encrypted blob stay consistent -- no independent pre-save index update.
    const state = await loadPOJUSession(targetSessionId);
    if (!state) return;
    // loadPOJUSession already applied DC restore authority.
    const next = { ...state, original_question: value };
    if (targetSessionId === sessionRef.current.session_id) {
      // C1: confirm UI memory only after core blob+cycle persist succeeds.
      await confirmSessionAfterCorePersist(next, onSessionUpdate);
    } else {
      await savePOJUSessionCore(next);
      void runPOJUSessionPostCommitSideEffects(next);
    }
    setSessionRows((prev) =>
      prev.map((x) => (x.session_id === targetSessionId ? { ...x, original_question: value } : x)),
    );
  }

`;
  s = s.slice(0, start) + neu + s.slice(end);
  fs.writeFileSync("components/poju/POJUChatUI.tsx", s);
  console.log("rewrote handleRenameSession cleanly");
}

// Normalize em-dash-ish corruption in cycle-db-sync comments to ASCII
{
  let s = fs.readFileSync("lib/poju/cycle-db-sync.ts", "utf8");
  s = s.replace(/Always clear prior index rows in the same transaction[^\n]*/g,
    "Always clear prior index rows in the same transaction -- including when");
  // fix following line if broken
  s = s.replace(
    /Always clear prior index rows in the same transaction -- including when\n  \/\/ cycles were emptied[^\n]*/g,
    "Always clear prior index rows in the same transaction -- including when\n  // cycles were emptied -- so stale cycle/suggestion indexes cannot survive.",
  );
  fs.writeFileSync("lib/poju/cycle-db-sync.ts", s);
  console.log("normalized cycle-db-sync comments");
}

// Normalize session-manager comment
{
  let s = fs.readFileSync("lib/poju/session-manager.ts", "utf8");
  s = s.replace(
    /\/\/ Dexie update returns modified count; 0 means missing row[^\n]*/g,
    "// Dexie update returns modified count; 0 means missing row -- throw so the",
  );
  fs.writeFileSync("lib/poju/session-manager.ts", s);
  console.log("normalized session-manager comment");
}
