# PHASE3 S5 — P3-61…130 Test Index

**HEAD baseline for S5 work:** starts from `740fe32ec8155b07aa9bb4c2ff0e0baa47a15ece`  
**Contract:** Final Engineering Contract §18  
**Mapping:** Implementation Mapping §7

Format: `Test ID → Name → Contract Section → File → Assertion`

| Test ID | Name | Contract Section | File | Assertion |
|---|---|---|---|---|
| P3-61 | pending_create Session Rev +1; DC Base original | §18.1 | test-decision-context-phase3-idb.ts | session_revision+1; generation_base_revision==dc0 |
| P3-62 | Session write CAS conflict → reload+replay | §18.1 | test-decision-context-phase3-idb.ts | applyCount>=2 after simulated conflict |
| P3-63 | Concurrent chat messages; client_id dedupe | §18.1 | test-decision-context-phase3-idb.ts | both client_ids kept; no duplicate |
| P3-64 | row/blob Session Revision mismatch hard fail | §18.1 | test-decision-context-phase3-idb.ts | load/mutate throws mirror mismatch |
| P3-65 | row/blob DC Revision mismatch hard fail | §18.1 | test-decision-context-phase3-idb.ts | load/mutate throws |
| P3-66 | Two Tab Session mutations no clobber | §18.1 | test-decision-context-phase3-idb.ts | session consistent after concurrent patches |
| P3-67 | Two Tab same Generation → one identity | §18.1 | test-decision-context-phase3-idb.ts | single TaskContext for shared client_task_id |
| P3-68 | Path A concurrent with chat message | §18.1 | test-decision-context-phase3-idb.ts | message retained |
| P3-69 | Path A DC moved → GENERATION_BASE_STALE | §18.1 | test-decision-context-phase3-idb.ts | code==GENERATION_BASE_STALE |
| P3-70 | Real encryptJson throw on casWrite path — no rev/blob/idempotency change; retry OK | §18.1 / §15.3 | test-decision-context-phase3-idb.ts | encrypt invoked+throws; cipher+revs unchanged; same op_id retry commits |
| P3-71 | Real Dexie mid-txn fail after session+cycle clear — full abort; retry OK | §18.1 | test-decision-context-phase3-idb.ts | hook after_clear; cipher+revs+cycle ids unchanged; retry commits new cycle |
| P3-72 | TaskContext/Registry client_task_id mismatch | §18.2 | test-decision-context-phase3-unit.ts | GENERATION_IDENTITY_COLLISION |
| P3-73 | Same generation_id different client_task_id | §18.2 | test-decision-context-phase3-unit.ts | GENERATION_IDENTITY_COLLISION |
| P3-74 | Same generation_id different base revision | §18.2 | test-decision-context-phase3-unit.ts | hard fail |
| P3-75 | Same generation_id different fingerprint | §18.2 | test-decision-context-phase3-unit.ts | hard fail |
| P3-76 | Same generation_id different fp version | §18.2 | test-decision-context-phase3-unit.ts | hard fail |
| P3-77 | Same idempotency key two tasks | §18.2 | test-decision-context-phase3-unit.ts | hard fail |
| P3-78 | Collision before completed-key skip | §18.2 | test-decision-context-phase3-unit.ts | collision wins over skip |
| P3-79 | Same task/fp/base new key → Path C | §18.2 | test-decision-context-phase3-unit.ts | path==C |
| P3-80 | Same key replay → Path B | §18.3 | test-decision-context-phase3-unit.ts | path A then B |
| P3-81 | Different sessions same generation_id isolated | §18.2 | test-decision-context-phase3-unit.ts | each session Path A on own registry |
| P3-82 | Illegal session_id rejected | §18.2 | test-decision-context-phase3-unit.ts | createPending throws |
| P3-83 | First legal commit Path A | §18.3 | test-decision-context-phase3-unit.ts | registry+dc bump |
| P3-84 | Path A then same key Path B no write | §18.3 | test-decision-context-phase3-unit.ts | rev unchanged |
| P3-85 | Path A then new key Path C | §18.3 | test-decision-context-phase3-unit.ts | dc rev unchanged |
| P3-86 | Path B DC advanced → original_result_is_current=false | §18.3 | test-decision-context-phase3-unit.ts | replay flag false |
| P3-87 | Path C repeated → binding only | §18.3 | test-decision-context-phase3-unit.ts | dc unchanged; bindings grow |
| P3-88 | Path B lost response Reload recovers | §18.3 | test-decision-context-phase3-e2e.ts | Path B replay credentials |
| P3-89 | Path A UI missed → Binding/Registry completed | §18.3 | test-decision-context-phase3-e2e.ts | registry completed on reload |
| P3-90 | Empty mapper result no completed | §18.3 | test-decision-context-phase3-unit.ts | EMPTY_GENERATION_RESULT; registry empty |
| P3-91 | Registry without Binding → txn fail no half-product | §18.3 | test-decision-context-phase3-idb.ts | throw rolls back registry/binding |
| P3-92 | pending_create Reload same identity/base | §18.4 | test-decision-context-phase3-e2e.ts | restoreTaskContextOnReload |
| P3-93 | Job create+bind → running | §18.4 | test-decision-context-phase3-e2e.ts | status running |
| P3-94 | Job create ok bind fail → recovery_required | §18.4 | test-decision-context-phase3-e2e.ts | status recovery_required; one identity |
| P3-95 | Reload rebinds job via metadata | §18.4 | test-decision-context-phase3-e2e.ts | getXhighJobByClientTaskId + bind |
| P3-96 | Running Job → no second Job | §18.4 | test-decision-context-phase3-e2e.ts | same job_id for same client_task_id |
| P3-97 | Server Job failed keeps identity | §18.4 | test-decision-context-phase3-e2e.ts | failed status; same client_task_id/job_id |
| P3-98 | Result after DC Base moved hard fail | §18.4 | test-decision-context-phase3-e2e.ts | GENERATION_BASE_STALE; no stale write |
| P3-99 | TaskContext completed Registry missing | §18.4 | test-decision-context-phase3-e2e.ts | inconsistency detectable |
| P3-100 | Registry completed TaskContext running | §18.4 | test-decision-context-phase3-e2e.ts | inconsistency detectable |
| P3-101 | ControlPlane unknown field rejected | §18.5 | test-decision-context-phase3-unit.ts | UNKNOWN_CONTROL_PLANE_FIELD |
| P3-102 | Known field wrong type rejected | §18.5 | test-decision-context-phase3-unit.ts | INVALID_CONTROL_PLANE_FIELD |
| P3-103 | Illegal AgentPhase rejected | §18.5 | test-decision-context-phase3-unit.ts | validator throws |
| P3-104 | AgendaItem duplicate id rejected | §18.5 | test-decision-context-phase3-unit.ts | validator throws |
| P3-105 | agent_v2 vs ControlPlane → CP wins | §18.5 | test-decision-context-phase3-e2e.ts | assertAgentV2CannotOverwrite |
| P3-106 | Reload full ControlPlane | §18.5 | test-decision-context-phase3-e2e.ts | agenda+anchor restored |
| P3-107 | Confirm single RealityFact only | §18.6 | test-decision-context-phase3-unit.ts | single fact_id appended |
| P3-108 | Gate confirm no batch Fact events | §18.6 | test-decision-context-phase3-e2e.ts | assertGateConfirmDoesNotCreateFactEvents |
| P3-109 | Same action+target idempotent skip | §18.6 | test-decision-context-phase3-e2e.ts | outcome idempotent_skip |
| P3-110 | Same action different target hard fail | §18.6 | test-decision-context-phase3-unit.ts | CONFIRMATION_ACTION_REUSED |
| P3-111 | event target/type mismatch hard fail | §18.6 | test-decision-context-phase3-e2e.ts | validator throws |
| P3-112 | missing source_turn_id hard fail | §18.6 | test-decision-context-phase3-e2e.ts | validator throws |
| P3-113 | user_estimate stays unverified | §18.6 | test-decision-context-phase3-unit.ts | status unverified |
| P3-114 | independently_verified no auto user_confirmed | §18.6 | test-decision-context-phase3-e2e.ts | deriveUserConfirmed false |
| P3-115 | Constraint illegal combination hard fail | §18.6 | test-decision-context-phase3-e2e.ts | IllegalFactCombinationError |
| P3-116 | Ordinary message ≠ Opening Anchor | §18.6 | test-decision-context-phase3-unit.ts | anchor_id≠message_client_id enforced |
| P3-117 | Opening Anchor session mismatch | §18.6 | test-decision-context-phase3-e2e.ts | createOpeningAnchor rejects |
| P3-118 | Gate Reset clear+history+new | §18.6 | test-decision-context-phase3-unit.ts | cleared + new pending + history |
| P3-119 | Reload Gate History complete+unique | §18.6 | test-decision-context-phase3-e2e.ts | unique history ids |
| P3-120 | Re-click old Anchor no re-change | §18.6 | test-decision-context-phase3-e2e.ts | gate state stable / refuse |
| P3-121 | NFC equivalence same Fingerprint | §18.7 | test-decision-context-phase3-unit.ts | fingerprint equal |
| P3-122 | Whitespace normalized | §18.7 | test-decision-context-phase3-unit.ts | normalizeMapperString |
| P3-123 | null/empty/undefined → null | §18.7 | test-decision-context-phase3-unit.ts | all null |
| P3-124 | Array order change → FP change | §18.7 | test-decision-context-phase3-unit.ts | fingerprints differ |
| P3-125 | Leading empty frames keep slots | §18.7 | test-decision-context-phase3-unit.ts | modern_action_2 id |
| P3-126 | chart_anchors order → FP change | §18.7 | test-decision-context-phase3-unit.ts | fingerprints differ |
| P3-127 | FP version bump changes identity | §18.7 | test-decision-context-phase3-e2e.ts | fingerprintNormalizedObject differs |
| P3-128 | Same Normalized → Mapper+FP stable | §18.7 | test-decision-context-phase3-unit.ts | hyp ids + fp stable |
| P3-129 | Call B duplicate Agenda ID hard fail | §18.7 | test-decision-context-phase3-unit.ts | DUPLICATE_AGENDA_ID |
| P3-130 | Agenda covered ≠ DIR known | §18.7 | test-decision-context-phase3-unit.ts | current_state unknown |

**Core blocking set (must all PASS):** P3-61,62,63,67,68,69,72,73,74,78,80,86,87,94,98,101,107,110,113,116,118,121,125,128,129,130
