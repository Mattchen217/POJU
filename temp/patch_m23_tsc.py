from pathlib import Path
p = Path(r"lib/poju/decision-intake/blueprint.ts")
text = p.read_text(encoding="utf-8")
old = '''    } else {
      if (!prev.dir_ids.includes(def.dir_id)) prev.dir_ids.push(def.dir_id);
      for (const d of ddr_ids) {
        if (!prev.ddr_ids.includes(d)) prev.ddr_ids.push(d);
      }
      prev.needed_info = `${prev.needed_info}; ${def.need}`.slice(0, 500);
      prev.priority = highestDdrPriority([prev.priority, priority]);
    }'''
new = '''    } else {
      if (!prev.dir_ids.includes(def.dir_id)) prev.dir_ids.push(def.dir_id);
      const prevDdr = prev.ddr_ids ?? (prev.ddr_ids = []);
      for (const d of ddr_ids) {
        if (!prevDdr.includes(d)) prevDdr.push(d);
      }
      prev.needed_info = `${prev.needed_info}; ${def.need}`.slice(0, 500);
      prev.priority = highestDdrPriority([prev.priority, priority]);
    }'''
if old not in text:
    raise SystemExit('merge block not found')
text = text.replace(old, new)

# Fix version string assignments - cast
text = text.replace(
    '''      ddr_version = scope.ddr_version;
      dir_catalog_version = scope.dir_catalog_version;''',
    '''      ddr_version = scope.ddr_version as typeof ddr_version;
      dir_catalog_version = scope.dir_catalog_version as typeof dir_catalog_version;''',
)
# Or better: type the locals as string
text = text.replace(
    '''  let ddr_version = ddrLoad.snapshot.ddr_catalog_version;
  let dir_catalog_version = dirLoad.snapshot.dir_catalog_version;''',
    '''  let ddr_version: string = ddrLoad.snapshot.ddr_catalog_version;
  let dir_catalog_version: string = dirLoad.snapshot.dir_catalog_version;''',
)
p.write_text(text, encoding="utf-8")
print("fixed ts errors")
