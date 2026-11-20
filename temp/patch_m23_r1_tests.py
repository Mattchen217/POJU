# -*- coding: utf-8 -*-
from pathlib import Path
ROOT = Path(r"D:\POJU\pojulife")
path = ROOT / "scripts/test-m2-3-decision-blueprint.ts"
text = path.read_text(encoding="utf-8")

# Update header comment
old_hdr = """ * Proves:
 *  M2.3-01  Different decision questions"""
# just append R1 note near top after M2.3-06 line
old_list = """ *  M2.3-06  Fresh-session E2E from createPOJUSession (NO seedSession Blueprint inject)
 */"""
new_list = """ *  M2.3-06  Fresh-session E2E from createPOJUSession (NO seedSession Blueprint inject)
 *  M2.3-R1  Full DDR scope (P0+P1+P2) on Blueprint; seed vs schedule split; P1/P2 activation
 */"""
if old_list not in text:
    raise SystemExit("header list not found")
text = text.replace(old_list, new_list, 1)

# Extend imports
old_imp = """  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
  } = await import(\"../lib/poju/decision-intake\");"""
new_imp = """  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
    activateNextBlueprintPriorityBand,
    gateClassForDirFromCatalog,
    buildUnderstandingState,
  } = await import(\"../lib/poju/decision-intake\");
  const {
    ACTIVE_DDR_CATALOG_VERSION,
    loadDdrCatalog,
  } = await import(\"../lib/poju/decision-context/catalog\");
  const { selectNextIntakeAskForSession } = await import(
    \"../lib/poju/decision-context/production-intake-ask\"
  );"""
if old_imp not in text:
    raise SystemExit("import block not found")
text = text.replace(old_imp, new_imp, 1)

# Insert R1 tests before the finally block of the try
marker = """  } finally {
    globalThis.fetch = originalFetch;
  }"""

r1 = r'''
    // ---------- M2.3-R1 ----------
    await check("M2.3-R1 full DDR scope P0+P1+P2 + seed/schedule split + activation", async () => {
      const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
      assert.ok(ddrLoad.ok, "ddr catalog");

      const sid = await createPOJUSession({
        payment_id: "pay_m23_r1",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const dc = s.decision_context!;
      assert.equal(bp.scope_source, "catalog");

      // 1) Blueprint contains ALL required DIRs of selected DDRs (P0/P1/P2)
      const requiredFromDdrs = new Set<string>();
      for (const ddrId of bp.ddr_ids ?? []) {
        const entry = ddrLoad.snapshot.by_id.get(ddrId);
        if (!entry) continue;
        // DDR-07 topic pack uses overridden required_dir_ids at scope time;
        // still assert every non-empty catalog required id is in scope when selected.
        for (const id of entry.required_dir_ids) requiredFromDdrs.add(id);
      }
      // Topic pack for career must be present (DDR-07 filled at init)
      assert.ok(bp.dir_ids.includes("DIR-JOB-OFFER"), "topic DIR in scope");
      for (const id of requiredFromDdrs) {
        assert.ok(
          bp.dir_ids.includes(id),
          `Blueprint missing required DIR ${id} from selected DDRs`,
        );
      }
      // Pure P1 DIRs must be in formal scope (not dropped)
      assert.ok(
        bp.dir_ids.includes("DIR-VALIDATION-CAPACITY"),
        "P1 DIR-VALIDATION-CAPACITY must stay in Blueprint scope",
      );
      assert.ok(
        bp.dir_ids.includes("DIR-OPT-IRREV"),
        "P1 DIR-OPT-IRREV must stay in Blueprint scope",
      );

      // 2) P0/P1/P2 DIRs all have legal DDR associations + Investigation Directions
      for (const dirId of bp.dir_ids) {
        const ddrs = resolveDdrIdsForDir(dirId, bp);
        assert.ok(ddrs.length >= 1, `no DDR association for ${dirId}`);
        assert.ok(ddrs.every((d) => !d.startsWith("DDR_FOR_")));
        const direction = bp.directions.find((d) => d.dir_ids.includes(dirId));
        assert.ok(direction, `missing Investigation Direction for ${dirId}`);
        assert.ok(direction!.completion_criteria, "completion criteria");
        assert.ok(direction!.scope_boundary, "scope boundary");
      }

      // 3) Distinguish Blueprint scope vs DC initial seed
      const seed = bp.initial_seed_dir_ids ?? [];
      assert.ok(seed.length >= 1, "initial_seed_dir_ids recorded");
      assert.ok(
        seed.every((id) => bp.dir_ids.includes(id)),
        "seed must be subset of Blueprint scope",
      );
      assert.ok(
        bp.dir_ids.length >= seed.length,
        "scope must be at least seed",
      );
      // P1-only DIRs should not be in first-wave seed
      assert.ok(
        !seed.includes("DIR-VALIDATION-CAPACITY"),
        "DIR-VALIDATION-CAPACITY must not be first-wave seed",
      );
      assert.ok(
        !seed.includes("DIR-OPT-IRREV"),
        "DIR-OPT-IRREV must not be first-wave seed",
      );
      // DC after bootstrap should carry seed DIRs; deferred P1 may be absent until activation
      for (const id of seed) {
        assert.ok(
          dc.dirs.some((d) => d.dir_id === id),
          `DC missing seed DIR ${id}`,
        );
      }
      const deferredOnDc = dc.dirs.some((d) => d.dir_id === "DIR-VALIDATION-CAPACITY");
      // May or may not be activated yet if somehow P0 empty — normally absent
      if (!deferredOnDc) {
        assert.ok(
          bp.dir_ids.includes("DIR-VALIDATION-CAPACITY"),
          "deferred DIR still in Blueprint",
        );
      }

      // 4) First turn still prefers P0
      const plan0 = s.adaptive_ask_plan!;
      assert.equal(plan0.gate_class, "P0", `first ask must be P0, got ${plan0.gate_class}`);
      const cands0 = buildIntakeCandidatesFromDc(dc, bp);
      assert.ok(cands0.some((c) => c.impact.gate_class === "P0"));
      const top = cands0
        .slice()
        .sort((a, b) => {
          const rank = (g: string) => (g === "P0" ? 0 : g === "P1" ? 1 : 2);
          return rank(a.impact.gate_class) - rank(b.impact.gate_class);
        })[0];
      assert.equal(top!.impact.gate_class, "P0");

      // 5) Simulate P0 completion on DC → activate P1 from Blueprint
      const p0Ids = bp.dir_ids.filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        let band = g.gate_class;
        if (
          bp.page_07_emit &&
          bp.directions.some(
            (d) => d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(id),
          )
        ) {
          band = "P0";
        }
        return band === "P0";
      });
      let working = s;
      working = {
        ...working,
        decision_context: {
          ...working.decision_context!,
          dirs: working.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const, partial_satisfaction: false }
              : d,
          ),
          // bump version so Understanding binds
          version: working.decision_context!.version + 1,
        },
      };
      // Ensure any P0 Blueprint DIRs missing on DC are also marked known via merge+mark
      const bp2 = ensureDecisionBlueprint(working, {
        now: new Date().toISOString(),
      });
      working = bp2.session;
      working = {
        ...working,
        decision_context: {
          ...working.decision_context!,
          dirs: working.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
        },
      };

      // Uninvestigated P1/P2 must NOT be auto-marked known/n_a
      for (const d of working.decision_context!.dirs) {
        if (d.dir_id === "DIR-VALIDATION-CAPACITY" || d.dir_id === "DIR-OPT-IRREV") {
          assert.notEqual(d.current_state, "known");
          assert.notEqual(d.current_state, "n_a");
        }
      }

      const activated = activateNextBlueprintPriorityBand(
        working,
        new Date().toISOString(),
      );
      assert.ok(
        activated.decision_context!.dirs.some(
          (d) => d.dir_id === "DIR-VALIDATION-CAPACITY",
        ),
        "after P0 complete, P1 DIR-VALIDATION-CAPACITY must activate onto DC",
      );
      assert.ok(
        activated.decision_context!.dirs.some((d) => d.dir_id === "DIR-OPT-IRREV"),
        "after P0 complete, P1 DIR-OPT-IRREV must activate onto DC",
      );
      for (const id of ["DIR-VALIDATION-CAPACITY", "DIR-OPT-IRREV"]) {
        const row = activated.decision_context!.dirs.find((d) => d.dir_id === id)!;
        assert.equal(row.current_state, "unknown", `${id} must activate as unknown`);
      }

      // AQE can select unfinished P1
      const ask = await selectNextIntakeAskForSession({
        session: activated,
        nowIso: new Date().toISOString(),
      });
      const p1Cands = buildIntakeCandidatesFromDc(
        ask.session.decision_context!,
        ask.session.decision_blueprint!,
      ).filter((c) => c.impact.gate_class === "P1");
      assert.ok(p1Cands.length >= 1, "AQE must see P1 candidates after P0 complete");
      if (ask.selected) {
        assert.ok(
          ask.selected.candidate.impact.gate_class === "P1" ||
            ask.selected.candidate.impact.gate_class === "P0",
          `selected gate ${ask.selected.candidate.impact.gate_class}`,
        );
        // With all P0 known, selection should prefer P1
        assert.equal(
          ask.selected.candidate.impact.gate_class,
          "P1",
          "after P0 known, next ask should be P1",
        );
      }

      // Readiness must not treat uninvestigated P1/P2 as complete
      const u = buildUnderstandingState({
        session: ask.session,
        blueprint: ask.session.decision_blueprint!,
        now: new Date().toISOString(),
      });
      const p1Need = u.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" || n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "Readiness/Understanding must still list open P1 needs");
      assert.ok(
        !u.understood.items.some(
          (i) =>
            i.dir_id === "DIR-VALIDATION-CAPACITY" || i.dir_id === "DIR-OPT-IRREV",
        ),
        "uninvestigated P1 must not appear in understood/known",
      );

      // 6) After P1 complete → P2 activation (DIR-TIMING-WINDOW is also P0 via HOLD;
      //    verify band advancement API still activates remaining unfinished Blueprint DIRs)
      let afterP1 = ask.session;
      const p1Ids = afterP1.decision_blueprint!.dir_ids.filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        let band = g.gate_class;
        if (
          afterP1.decision_blueprint!.page_07_emit &&
          afterP1.decision_blueprint!.directions.some(
            (d) => d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(id),
          )
        ) {
          band = "P0";
        }
        return band === "P1";
      });
      afterP1 = {
        ...afterP1,
        decision_context: {
          ...afterP1.decision_context!,
          dirs: afterP1.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id) || p1Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: afterP1.decision_context!.version + 1,
        },
      };
      const afterP2 = activateNextBlueprintPriorityBand(
        afterP1,
        new Date().toISOString(),
      );
      // Any remaining unfinished Blueprint DIRs (P2 band) must be activatable
      const unfinishedP2 = (afterP2.decision_blueprint?.dir_ids ?? []).filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        return g.gate_class === "P2";
      });
      for (const id of unfinishedP2) {
        const row = afterP2.decision_context!.dirs.find((d) => d.dir_id === id);
        assert.ok(row, `P2 DIR ${id} must be on DC after P1 complete`);
        if (row && row.current_state !== "known" && row.current_state !== "n_a") {
          assert.equal(row.current_state, "unknown");
        }
      }

      // 7) Report-required DDRs have no un-investigable DIR gap
      for (const ddrId of bp.ddr_ids ?? []) {
        const entry = ddrLoad.snapshot.by_id.get(ddrId);
        if (!entry) continue;
        for (const dirId of entry.required_dir_ids) {
          assert.ok(
            bp.dir_ids.includes(dirId),
            `report DDR ${ddrId} requires ${dirId} but Blueprint cannot investigate it`,
          );
        }
      }
      // DDR-07 topic dirs (career)
      if ((bp.ddr_ids ?? []).includes("DDR-07-TOPIC-DEPTH")) {
        assert.ok(bp.dir_ids.includes("DIR-JOB-OFFER"));
      }

      console.log(
        `    scope=${bp.dir_ids.length} seed=${seed.length} p0Ask=${plan0.gate_class} p1Cands=${p1Cands.length}`,
      );
    });

'''

if marker not in text:
    raise SystemExit("finally marker not found")
text = text.replace(marker, r1 + marker, 1)
path.write_text(text, encoding="utf-8")
print("tests OK", path)
