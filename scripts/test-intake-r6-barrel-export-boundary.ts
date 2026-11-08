/**
 * S8-A — the NaValidation fixture builder / overrides type stay off every
 * production export surface (lib/ + app/).
 *
 * Semantic (TypeScript checker), not textual: every module's export table and
 * every identifier is resolved through alias chains back to its declaration.
 * Catches `export *`, named / alias / type re-export, transitive re-export,
 * `export * as ns`, namespace re-export, import-then-export and wrappers.
 * Negative controls feed each leak shape through the same detector via a
 * virtual compiler host (no probe file is written to disk).
 *
 *   pnpm test:intake-r6-barrel-export-boundary
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { join } from "node:path";
import ts from "typescript";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_intake_r6_s8_barrel");

const REPO = process.cwd().split("\\").join("/");
const NA_REL = "lib/poju/decision-context/na-validation-from-session.ts";
const NA_FILE = `${REPO}/${NA_REL}`;
const DC_DIR = `${REPO}/lib/poju/decision-context`;
const FIXTURE_NAMES = new Set(["naValidationBoundToDc", "NaValidationFixtureOverrides"]);

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

const norm = (p: string) => p.split("\\").join("/");
const rel = (p: string) => norm(p).slice(REPO.length + 1);

function isProductionFile(fileName: string): boolean {
  const r = rel(fileName);
  return (r.startsWith("lib/") || r.startsWith("app/")) && !r.endsWith(".d.ts");
}

type Leak = { file: string; kind: string; detail: string };

/** Fixture declarations + the NA module symbol, resolved inside `program`. */
function fixtureTargets(program: ts.Program) {
  const checker = program.getTypeChecker();
  const naSource = program.getSourceFile(NA_FILE);
  assert.ok(naSource, `fixture definition file not in program: ${NA_REL}`);
  const naModule = checker.getSymbolAtLocation(naSource);
  assert.ok(naModule, "fixture definition module has no symbol");
  const fixtureSymbols = new Set<ts.Symbol>();
  for (const sym of checker.getExportsOfModule(naModule)) {
    if (FIXTURE_NAMES.has(sym.getName())) fixtureSymbols.add(sym);
  }
  assert.equal(
    fixtureSymbols.size,
    FIXTURE_NAMES.size,
    "fixture definition file must still export both fixture names (tests use them)",
  );
  return { checker, naModule, fixtureSymbols };
}

function resolveAlias(checker: ts.TypeChecker, sym: ts.Symbol): ts.Symbol {
  return sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
}

/** Leaks of the fixture from `files` (each a non-fixture-definition module). */
function findLeaks(program: ts.Program, files: readonly ts.SourceFile[]): Leak[] {
  const { checker, naModule, fixtureSymbols } = fixtureTargets(program);
  const isFixture = (sym: ts.Symbol | undefined) =>
    sym !== undefined && fixtureSymbols.has(resolveAlias(checker, sym));
  const isNaModule = (sym: ts.Symbol | undefined) =>
    sym !== undefined && resolveAlias(checker, sym) === naModule;
  const leaks: Leak[] = [];

  for (const sf of files) {
    if (norm(sf.fileName) === NA_FILE) continue;
    const file = rel(sf.fileName);
    const moduleSym = checker.getSymbolAtLocation(sf);

    // 1) Export table: anything this module exports that resolves to the
    //    fixture, or to the whole fixture module as a namespace.
    if (moduleSym) {
      for (const exp of checker.getExportsOfModule(moduleSym)) {
        if (isFixture(exp)) {
          leaks.push({ file, kind: "export", detail: exp.getName() });
        } else if (isNaModule(exp)) {
          leaks.push({ file, kind: "namespace_export", detail: exp.getName() });
        }
      }
    }

    // 2) Any identifier that resolves to the fixture (imports, wrappers,
    //    property access through a namespace import).
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && isFixture(checker.getSymbolAtLocation(node))) {
        leaks.push({ file, kind: "reference", detail: node.text });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return leaks;
}

function loadBaseOptions(): { options: ts.CompilerOptions; fileNames: string[] } {
  const configPath = join(REPO, "tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(read.error, undefined, "tsconfig.json unreadable");
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO);
  return {
    options: { ...parsed.options, noEmit: true, incremental: false },
    fileNames: parsed.fileNames.map(norm),
  };
}

/** Leak shapes; every entry except `clean` must be detected. */
const PROBES: Record<string, string> = {
  export_star: `export * from "./na-validation-from-session";\n`,
  named_reexport: `export { naValidationBoundToDc } from "./na-validation-from-session";\n`,
  alias_reexport: `export { naValidationBoundToDc as boundDcAuthority } from "./na-validation-from-session";\n`,
  type_alias_reexport: `export type { NaValidationFixtureOverrides as AuthorityOpts } from "./na-validation-from-session";\n`,
  import_then_export:
    `import { naValidationBoundToDc as nv } from "./na-validation-from-session";\n` +
    `export { nv };\n`,
  namespace_export: `export * as naNs from "./na-validation-from-session";\n`,
  namespace_import_reexport:
    `import * as naMod from "./na-validation-from-session";\n` + `export { naMod };\n`,
  wrapper_const:
    `import { naValidationBoundToDc } from "./na-validation-from-session";\n` +
    `export const wrapped = naValidationBoundToDc;\n`,
  wrapper_function:
    `import * as naMod from "./na-validation-from-session";\n` +
    `export function wrappedFn(...a: Parameters<typeof naMod.naValidationBoundToDc>) {\n` +
    `  return naMod.naValidationBoundToDc(...a);\n` +
    `}\n`,
  transitive_mid: `export * from "./na-validation-from-session";\n`,
  transitive_end: `export * from "./__s8_probe_transitive_mid";\n`,
  clean:
    `export {\n` +
    `  buildProductionNaValidationContextFromSession,\n` +
    `  naValidationForDcSnapshot,\n` +
    `} from "./na-validation-from-session";\n` +
    `export type { ProductionNaValidationBuildOpts } from "./na-validation-from-session";\n`,
};

const probePath = (name: string) => `${DC_DIR}/__s8_probe_${name}.ts`;

function probeProgram(options: ts.CompilerOptions): ts.Program {
  const virtual = new Map<string, string>(
    Object.entries(PROBES).map(([name, src]) => [probePath(name), src]),
  );
  const host = ts.createCompilerHost(options, true);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  const baseFileExists = host.fileExists.bind(host);
  const baseReadFile = host.readFile.bind(host);
  host.fileExists = (f) => virtual.has(norm(f)) || baseFileExists(f);
  host.readFile = (f) => virtual.get(norm(f)) ?? baseReadFile(f);
  host.getSourceFile = (f, lang, onError, shouldCreate) => {
    const src = virtual.get(norm(f));
    return src !== undefined
      ? ts.createSourceFile(f, src, lang, true)
      : baseGetSourceFile(f, lang, onError, shouldCreate);
  };
  return ts.createProgram({
    rootNames: [NA_FILE, ...virtual.keys()],
    options,
    host,
  });
}

async function main() {
  console.log("intake-r6-barrel-export-boundary (S8-A)");
  const { options, fileNames } = loadBaseOptions();

  // ============================================== N. negative controls
  console.log("\n== N. Detector negative controls (virtual probes) ==");
  const probes = probeProgram(options);
  const probeDiagnostics = ts
    .getPreEmitDiagnostics(probes)
    .filter((d) => d.file && norm(d.file.fileName).includes("/__s8_probe_"));
  await check("N0 probe modules type-check (detector sees real resolved exports)", () => {
    assert.deepEqual(
      probeDiagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
      [],
    );
  });
  for (const name of Object.keys(PROBES)) {
    const sf = probes.getSourceFile(probePath(name));
    await check(
      name === "clean"
        ? "N clean explicit production exports → no leak"
        : `N ${name} → detected`,
      () => {
        assert.ok(sf, `probe missing: ${name}`);
        const leaks = findLeaks(probes, [sf]);
        if (name === "clean") assert.deepEqual(leaks, []);
        else assert.ok(leaks.length >= 1, `detector missed ${name}`);
      },
    );
  }

  // ============================================== P. production surface
  console.log("\n== P. Production surface (lib/ + app/, tsconfig.json program) ==");
  const prodRoots = fileNames.filter(isProductionFile);
  const program = ts.createProgram({ rootNames: prodRoots, options });
  const prodFiles = program
    .getSourceFiles()
    .filter((sf) => isProductionFile(sf.fileName));

  await check("P0 program covers lib/ + app/ and the fixture definition file", () => {
    assert.ok(prodFiles.length > 100, `only ${prodFiles.length} production files`);
    assert.ok(program.getSourceFile(NA_FILE));
  });

  await check("P1 no lib/ or app/ module exports or references the fixture (semantic)", () => {
    assert.deepEqual(findLeaks(program, prodFiles), []);
  });

  const barrels = prodFiles.filter((sf) => /\/index\.tsx?$/.test(norm(sf.fileName)));
  await check(`P2 every production barrel (${barrels.length}) export table is fixture-free`, () => {
    assert.ok(barrels.length >= 1);
    assert.deepEqual(findLeaks(program, barrels), []);
  });

  const DC_BARREL = `${DC_DIR}/index.ts`;
  await check("P3 decision-context barrel re-exports the NA module only by explicit name (no export *)", () => {
    const sf = program.getSourceFile(DC_BARREL);
    const naSource = program.getSourceFile(NA_FILE);
    assert.ok(sf && naSource);
    const checker = program.getTypeChecker();
    const naModule = checker.getSymbolAtLocation(naSource);
    assert.ok(naModule);
    const starFromNa = sf.statements.filter(
      (st) =>
        ts.isExportDeclaration(st) &&
        st.moduleSpecifier !== undefined &&
        (st.exportClause === undefined || ts.isNamespaceExport(st.exportClause)) &&
        checker.getSymbolAtLocation(st.moduleSpecifier) === naModule,
    );
    assert.equal(starFromNa.length, 0);
    const named = sf.statements.filter(
      (st) =>
        ts.isExportDeclaration(st) &&
        st.moduleSpecifier !== undefined &&
        st.exportClause !== undefined &&
        ts.isNamedExports(st.exportClause) &&
        checker.getSymbolAtLocation(st.moduleSpecifier) === naModule,
    );
    assert.ok(named.length >= 1, "production NA exports must stay reachable by name");
  });

  // ============================================== R. runtime surface
  console.log("\n== R. Runtime barrel surface ==");
  await check("R1 runtime decision-context barrel has production NA exports and no fixture builder", async () => {
    const barrel = await import("../lib/poju/decision-context");
    const keys = Object.keys(barrel);
    for (const f of FIXTURE_NAMES) assert.equal(keys.includes(f), false, f);
    for (const k of [
      "buildProductionNaValidationContextFromSession",
      "naValidationForDcSnapshot",
      "reaggregateDirsOnSession",
      "assertNaValidationBoundToDc",
      "ProductionNaAuthorityError",
      "PRODUCTION_NA_VALIDATION_DIR_CATALOG_SOURCE",
      "PRODUCTION_NA_VALIDATION_SOURCE_GAPS",
    ]) {
      assert.equal(keys.includes(k), true, k);
    }
  });

  await check("R2 fixture still importable from its definition file (tests unaffected)", async () => {
    const na = await import("../lib/poju/decision-context/na-validation-from-session");
    assert.equal(typeof na.naValidationBoundToDc, "function");
  });

  console.log(`\nS8 barrel-export-boundary done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
