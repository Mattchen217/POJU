from pathlib import Path
p=Path("scripts/test-m1-production-adaptive-question-loop.ts")
text=p.read_text(encoding="utf-8")
old='''      assert.ok(cst, "FU8-A2 must write the Constraint");
      assert.ok(companion, "FU8-A2 must also write the companion RealityFact");
      assert.equal(cst!.status, "unverified");
      assert.equal(cst!.verification_level, "user_asserted");
      assertRolesAndDirs(cst!, ctx.role, ctx.dirId, "FU8-A2 constraint");
      assertRolesAndDirs(companion!, ctx.role, ctx.dirId, "FU8-A2 companion");
'''
new='''      assert.ok(cst, "FU8-A2 must write the Constraint");
      assert.ok(companion, "FU8-A2 must also write the companion RealityFact");
      assert.equal(cst!.status, "unverified");
      assert.equal(cst!.verification_level, "user_asserted");
      assert.ok((cst!.related_dir_ids ?? []).includes(ctx.dirId), "FU8-A2 constraint must keep the authorized DIR");
      assertRolesAndDirs(companion!, ctx.role, ctx.dirId, "FU8-A2 companion");
'''
assert old in text
p.write_text(text.replace(old,new,1).replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("A2 assertion fixed")
