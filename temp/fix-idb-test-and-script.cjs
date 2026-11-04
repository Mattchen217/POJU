const fs = require("fs");

// Fix invalid inline type import in the IDB test
let s = fs.readFileSync("scripts/test-decision-context-phase2-idb.ts", "utf8");
// Strip BOM if present
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

const bad = `  const {
    savePOJUSessionCore,
    loadPOJUSession,
  } = await import("../lib/poju/session-manager");
  const { resolveLocalOwnerKey } = await import("../lib/storage/local-owner");
  type { POJUSessionState } from "../lib/poju/types";`;

const good = `  const {
    savePOJUSessionCore,
    loadPOJUSession,
  } = await import("../lib/poju/session-manager");
  const { resolveLocalOwnerKey } = await import("../lib/storage/local-owner");
  const types = await import("../lib/poju/types");
  type POJUSessionState = types.POJUSessionState;`;

if (!s.includes(bad)) {
  // maybe already fixed or formatting differs — try alternate
  if (s.includes("type { POJUSessionState }")) {
    s = s.replace(
      `type { POJUSessionState } from "../lib/poju/types";`,
      `const types = await import("../lib/poju/types");\n  type POJUSessionState = types.POJUSessionState;`,
    );
    fs.writeFileSync("scripts/test-decision-context-phase2-idb.ts", s);
    console.log("fixed type import (alt)");
  } else {
    console.error("type import block not found");
    process.exit(1);
  }
} else {
  s = s.replace(bad, good);
  fs.writeFileSync("scripts/test-decision-context-phase2-idb.ts", s);
  console.log("fixed type import");
}

// Add package.json script
const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (!pkg.scripts["test:decision-context-phase2-idb"]) {
  // insert after phase2 script preserving order
  const scripts = {};
  for (const [k, v] of Object.entries(pkg.scripts)) {
    scripts[k] = v;
    if (k === "test:decision-context-phase2") {
      scripts["test:decision-context-phase2-idb"] =
        "tsx scripts/test-decision-context-phase2-idb.ts";
    }
  }
  pkg.scripts = scripts;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("added package.json script");
} else {
  console.log("script already present");
}

if (!pkg.devDependencies?.["fake-indexeddb"] && !pkg.dependencies?.["fake-indexeddb"]) {
  console.log("WARNING: fake-indexeddb not in package.json yet");
} else {
  console.log("fake-indexeddb in package.json:", pkg.devDependencies?.["fake-indexeddb"] || pkg.dependencies?.["fake-indexeddb"]);
}
