from pathlib import Path
p = Path(r"lib/poju/decision-intake/index.ts")
text = p.read_text(encoding="utf-8")
old = 'export { ensureDecisionBlueprint, directionIdForDir, blueprintAllowsDir } from "./blueprint";'
new = '''export {
  ensureDecisionBlueprint,
  directionIdForDir,
  blueprintAllowsDir,
  blueprintAllowsDdr,
  buildCatalogBlueprintScope,
  resolveDdrIdsForDir,
  gateClassForDirFromCatalog,
  mergeCatalogDirsIntoDc,
  seedDirFromDefinition,
} from "./blueprint";
export {
  classifyDecisionTopic,
  filterCatalogLegalIds,
} from "./topic-classify";'''
if old not in text:
    raise SystemExit('export line not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('index exports updated')

# package.json script
pkg = Path('package.json')
pj = pkg.read_text(encoding='utf-8')
if 'test:m2-3-decision-blueprint' not in pj:
    pj = pj.replace(
        '"test:m2-2-freeze-report-binding": "tsx scripts/test-m2-2-freeze-report-binding.ts"',
        '"test:m2-2-freeze-report-binding": "tsx scripts/test-m2-2-freeze-report-binding.ts",\n    "test:m2-3-decision-blueprint": "tsx scripts/test-m2-3-decision-blueprint.ts"',
    )
    pkg.write_text(pj, encoding='utf-8')
    print('package.json script added')
else:
    print('package.json already has script')
