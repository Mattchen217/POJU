# Unresolved / dynamic items

## Dynamic generators (cannot fully enum without runtime)
- lib/calculations/build-calc-slice-from-plan.ts: template literal may embed traditional fragments
- lib/calculations/dayun-polarity.ts: template literal may embed traditional fragments
- lib/calculations/partner-archetype-hints.ts: template literal may embed traditional fragments
- lib/calculations/pattern-heuristic.ts: template literal may embed traditional fragments
- lib/calculations/relation-engine.ts: may concatenate 干支 dynamically
- lib/calculations/relation-engine.ts: template literal may embed traditional fragments
- lib/calculations/shunshi-adapter.ts: template literal may embed traditional fragments
- lib/calculations/topic-typed-fields.ts: template literal may embed traditional fragments
- lib/ziwei/display-fact-pack.ts: may concatenate 干支 dynamically
- lib/ziwei/lab-ziwei.ts: template literal may embed traditional fragments
- lib/qimen/FormatUtil.ts: template literal may embed traditional fragments
- lib/qimen/QimenUtil.ts: template literal may embed traditional fragments
- lib/qimen/type.ts: template literal may embed traditional fragments
- lib/glossary/dayun-semantic-ssot.ts: template literal may embed traditional fragments
- lib/glossary/shensha-semantic-ssot.ts: template literal may embed traditional fragments
- lib/glossary/tengod-semantic-ssot.ts: template literal may embed traditional fragments
- lib/glossary/term-context-for-facts.ts: template literal may embed traditional fragments
- lib/glossary/vernacular-mapping-ssot.ts: may concatenate 干支 dynamically
- lib/glossary/wuxing-semantic-ssot.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/action-extractor.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/anchor-category-tally.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/anchor-category-tally.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/anchor-quality.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/anchor-quality.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/assign-binding-seed.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/assign-fact-pack-claim-gate.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/assign-fact-pack-claim-gate.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/assign-necessary-signals.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/assign-necessary-signals.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/chart-fact-pack.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/chart-fact-pack.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/compress-jargon-repair.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/compress-jargon-repair.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/deep-evidence-assign.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/deep-evidence-assign.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/deep-evidence-call.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/deep-evidence-prompt.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/deep-evidence-quality.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/deep-evidence-quality.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/deep-evidence-write.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/deep-evidence-write.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/face-prompt.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/fill-call.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/fill-p4-chunk.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/fill-plain-judgment-quality.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/fill-prompt.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/fill-prompt.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/foundation-relation-inventory.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/layer-b-inventory-menu.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/p0-fill-shape-replay.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/p4-means-gate.ts: may concatenate 干支 dynamically
- lib/llm/pro/delivery/page-schema/qimen-fact-pack.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/render.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/sanitize.ts: template literal may embed traditional fragments
- lib/llm/pro/delivery/page-schema/upstream.ts: template literal may embed traditional fragments
- lib/compatibility/calculations/branch-interactions.ts: template literal may embed traditional fragments
- lib/compatibility/calculations/day-master-interaction.ts: template literal may embed traditional fragments
- lib/compatibility/calculations/luck-cycle-sync.ts: may concatenate 干支 dynamically
- lib/compatibility/calculations/luck-cycle-sync.ts: template literal may embed traditional fragments
- lib/compatibility/calculations/shensha-resonance.ts: template literal may embed traditional fragments
- lib/compatibility/calculations/spouse-star.ts: template literal may embed traditional fragments
- lib/compatibility/calculations/yong-shen-match.ts: template literal may embed traditional fragments


- **六十甲子 / 干支 pairs**: combinatorial from stems×branches (qimen 旬首表 lists subsets; full 60 may be generated).
- **Relation strings**: `relation-engine` builds labels like `子午相冲` dynamically — templates recorded as `dynamic_unresolved`; concrete pairs not invented.
- **iztro adjectiveStars / boshi12 / changsheng12 / jiangqian12 / suiqian12**: present in engine; FactPack currently does **not** expose full sets (Phase 9 C-class). Values may appear if future fields expand.
- **Pattern hits**: static names in `lib/ziwei/doushu/patterns.ts`; which fire is birth-dependent.
- **神煞 computation**: activates subset of CLOSED_SHEN_SHA per chart — closed set known; activation dynamic.
- **Glyph / I Ching**: SSOT ns=glyph exists; dedicated calc FactPack not found in this pass.
- **Zodiac ns**: availability active; calc surface thin vs bazi/qimen/ziwei.
- **Candidate Han scan**: may include soft POJU labels / vernacular — not asserted as classical terms.

## Phase 11 status on this checkout
- Branch: `main`
- Ziwei SSOT count on tip: **14** (expect 14 on main pre-merge; 50 on Phase 11 branch)
- Phase 11 new-36 present on tip: **0/36**
- Phase 11 branch `feat/phase11-ziwei-terminology-completion` ziwei count: **50**
- Missing on tip from the 36: zw_peer_bond_field, zw_partnership_field, zw_continuity_field, zw_resource_flow_field, zw_resilience_field, zw_mobility_field, zw_collab_network_field, zw_role_craft_field, zw_anchorage_field, zw_inner_reserve_field, zw_origin_support_field, zw_config_water_dual, zw_config_wood_triple, zw_config_metal_quad, zw_config_earth_penta, zw_config_fire_hexa, zw_star_apex_axis, zw_star_pattern_sense, zw_star_radiant_out, zw_star_craft_edge, zw_star_ease_bond, zw_star_intense_edge, zw_star_storehouse, zw_star_inward_tide, zw_star_desire_drive, zw_star_voice_gate, zw_star_protocol, zw_star_elder_shade, zw_star_breach_force, zw_star_reset_edge, zw_star_script_clarity, zw_star_lyric_flow, zw_star_left_support, zw_star_right_support, zw_star_resource_cache, zw_star_ignition

## Phase 9 leftovers (ziwei still not in public SSOT by design on main)
- Pattern classical names → `internal_only` (Phase 10 hit_id)
- Aux/adjective stars beyond ZIWEI_RUNTIME_STARS → see Phase 9 inventory C-class
- Do not re-add the Phase 11 36 once merged

## Manual review needed
- Whether qimen 门/星/神 soft labels cover every dictionary value in user P4 output.
- Whether all export HTML builders pass `confirmedTerms`/`sourceId`.
- Whether legacy Syncro paths under `legacy/` are still shipped (excluded from product SSOT unless linked).
- Triage `06` authoritative missing vs candidate noise before any Phase 12-B 补词.
