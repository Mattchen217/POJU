const fs = require("fs");
const p = "scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(p, "utf8");
const old = `    // Server-authoritative Freeze: tampered client snapshot cannot replace.
    const server = loadAuthoritativeFreeze(await durable(frozen.session.session_id), {
      freezeId: frozen.freezeId,
    });
    assert.ok(server.ok);
    if (!server.ok) return;
    const tampered = structuredClone(server.frozen);
    tampered.reality_facts[0] = {
      ...tampered.reality_facts[0]!,
      statement: "TAMPERED_CLIENT_SNAPSHOT",
    };
    const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
    const tamperedHash = computeContentHash(tampered);
    assert.notEqual(tamperedHash, server.contentHash);`;

const neu = `    // Server-authoritative Freeze: tampered client snapshot cannot replace.
    const server = loadAuthoritativeFreeze(await durable(frozen.session.session_id), {
      freezeId: frozen.freezeId,
    });
    assert.ok(server.frozen);
    assert.equal(server.binding.context_hash, frozen.contentHash);
    const tampered = structuredClone(server.frozen);
    tampered.reality_facts[0] = {
      ...tampered.reality_facts[0]!,
      statement: "TAMPERED_CLIENT_SNAPSHOT",
    };
    const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
    const tamperedHash = computeContentHash(tampered);
    assert.notEqual(tamperedHash, server.binding.context_hash);
    // API boundary compares client vs server — mismatch must not replace authority.
    assert.notEqual(tamperedHash, frozen.contentHash);`;

if (!s.includes(old)) {
  // try with CRLF normalized already
  console.log("exact block missing, trying fuzzy");
  if (!s.includes("TAMPERED_CLIENT_SNAPSHOT")) throw new Error("C7 missing");
  s = s.replace(
    /assert\.ok\(server\.ok\);\r?\n\s*if \(!server\.ok\) return;\r?\n/,
    "assert.ok(server.frozen);\n    assert.equal(server.binding.context_hash, frozen.contentHash);\n"
  );
  s = s.replace(
    "assert.notEqual(tamperedHash, server.contentHash);",
    "assert.notEqual(tamperedHash, server.binding.context_hash);\n    assert.notEqual(tamperedHash, frozen.contentHash);"
  );
} else {
  s = s.replace(old, neu);
}
fs.writeFileSync(p, s);
console.log("C7 fixed");
