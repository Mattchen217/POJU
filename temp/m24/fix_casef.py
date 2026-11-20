from pathlib import Path
p = Path(r"scripts/test-m1-production-adaptive-question-loop.ts")
t = p.read_text(encoding="utf-8")
old = '''      if (need && need.kind === "dir_based") {
        assert.ok(
          !need.missing_content.includes(`missing_roles:${role0}`) ||
            need.missing_content.includes("missing_roles:"),
        );
        // role0 should no longer be listed as missing
        assert.equal(
          need.missing_content.includes(`missing_roles:${role0},`) ||
            need.missing_content.startsWith(`missing_roles:${role0};`) ||
            need.missing_content === `missing_roles:${role0}; ${s.decision_context!.dirs.find(d=>d.dir_id===targetDir)!.need}`,
          false,
          `role ${role0} must not remain the sole/leading missing role: ${need.missing_content}`,
        );
        assert.equal(
          /missing_roles:option(;|,|$)/.test(need.missing_content) && role0 === "option"
            ? need.missing_content.includes("missing_roles:option;") || need.missing_content.includes("missing_roles:option,")
            : false,
          false,
        );
      }'''
new = '''      if (need && need.kind === "dir_based") {
        const missingRolesMatch = /missing_roles:([^;]+)/.exec(need.missing_content);
        const missingRoles = missingRolesMatch
          ? missingRolesMatch[1]!.split(",").map((x) => x.trim()).filter(Boolean)
          : [];
        assert.equal(
          missingRoles.includes(role0),
          false,
          `role ${role0} must not remain missing; got ${need.missing_content}`,
        );
      }'''
if old not in t:
    raise SystemExit('case f block not found')
p.write_text(t.replace(old, new), encoding='utf-8')
print('fixed case F')
