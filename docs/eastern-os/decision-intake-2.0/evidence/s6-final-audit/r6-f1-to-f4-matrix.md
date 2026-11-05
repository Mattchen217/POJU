# R6 F1–F4 Test Matrix (S6)

**Test file:** `scripts/test-intake-r6-freeze-authority-regression.ts`  
**ACTIVE fixture pair:** `DIR-DEF-UNACCEPTABLE` + `explicit_no_hard_red_lines`  
**S6 re-run:** `pnpm test:intake-r6-freeze-authority-regression` → exit **0**, `PASS=4 FAIL=0`  
**HEAD:** `76fa70bd5577ae4cc5b793e205518c38c5baf2b5`

| Case | Session authority | Caller forged input | Expected | Isolation | S6 result |
|---|---|---|---|---|---|
| **F1** | Valid E1 + N/A Action; Classification/Evidence bound; draft sufficient | Wrong confirmationEvents; wrong naDeclarationActions; forged dirCatalog (`DIR-A` / non-SSOT) | `frozen.status === "final"`; target DIR `current_state === "n_a"` | Fresh `makeSufficientDraft("f1")` triad clones | **PASS** |
| **F2** | No matching Action (`na_declaration_actions: []`); Classification/Evidence retained; E1 present | Fully matching forged Action (+ E1 + forged dirCatalog listing SSOT pair) | Target DIR **≠** `n_a` (asserts `known`) | Fresh `"f2"` fixtures | **PASS** |
| **F3** | Matching `topic_applicability_evals` + `topic_catalog_version`; system_na_marker evidence uses SSOT condition | Wrong topicEvalAuthority + wrong currentTopicCatalogVersion; forged dirCatalog; **topicRules supplied as Authority Gap** | `final` + DIR `n_a` | Fresh `"f3"` | **PASS** |
| **F4** | No matching topic eval (`[]`); catalog version set | Fully matching forged topicEvalAuthority; topicRules with matching embedded eval; forged dirCatalog | DIR **≠** `n_a` (asserts `known`) | Fresh `"f4"` | **PASS** |

## What F1–F4 prove

1. **F1:** Session Action+E1 authorize N/A under production Freeze; caller Confirmation/Action/dirCatalog cannot override.
2. **F2:** Matching forged Action alone cannot authorize when Session lacks the Action.
3. **F3:** Session Topic Evaluation Authority wins over forged eval/version; **does not** prove Topic Rules have Session SoT.
4. **F4:** Matching forged Topic Evaluation cannot authorize when Session lacks the eval.

## What F1–F4 do **not** prove

- Topic Rules production Session SoT (**AUTHORITY_GAP** remains).
- Catalog Condition Evaluation production store.
- CFP live source-state production reader.
- Historical S4 script string `UNTESTED [disclose] freeze-versioning F1` is **not** current F1 RED (S5 closed F1–F4; S4 file left unchanged by design).

## Historical path

- Pre-S5 fixtures used `DIR-A` / `explicit_not_applicable` / `topic_na` (not in ACTIVE) → F1 RED under S2 ACTIVE compose.
- S5 re-homed F1–F4 to ACTIVE pair + isolation suite → PASS without relaxing production Catalog or Freeze strip rules.
