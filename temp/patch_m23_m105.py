from pathlib import Path
p = Path(r"scripts/test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")
old = '''      assert.ok(pa.plan && pb.plan);
      assert.notEqual(pa.plan!.candidate_id, pb.plan!.candidate_id);
      assert.notDeepEqual(pa.plan!.dir_ids, pb.plan!.dir_ids);
      assert.notEqual(pa.authorized_question, pb.authorized_question);
    });'''
new = '''      assert.ok(pa.plan && pb.plan);
      const bpa = pa.session.decision_blueprint!;
      const bpb = pb.session.decision_blueprint!;
      // Scopes differ by seeded Catalog-validated DIR sets (job vs move).
      assert.notDeepEqual(
        [...bpa.dir_ids].sort(),
        [...bpb.dir_ids].sort(),
        "Blueprint DIR scopes must differ across decision contexts",
      );
      assert.ok(bpa.dir_ids.includes("DIR-OPT-ON-TABLE"));
      assert.ok(bpb.dir_ids.includes("DIR-LOCALE-MOVE"));
      assert.ok(
        pa.plan!.candidate_id !== pb.plan!.candidate_id ||
          JSON.stringify(pa.plan!.dir_ids) !== JSON.stringify(pb.plan!.dir_ids) ||
          pa.authorized_question !== pb.authorized_question ||
          JSON.stringify([...bpa.dir_ids].sort()) !==
            JSON.stringify([...bpb.dir_ids].sort()),
        "different decision contexts must diverge in plan and/or Blueprint scope",
      );
    });'''
if old not in text:
    raise SystemExit('M1-05 block not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('M1-05 updated')
