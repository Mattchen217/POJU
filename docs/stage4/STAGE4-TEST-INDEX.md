# Stage 4 Test Index

| Test ID | Test Name | Contract / Spec | Source File | Actual Assertion |
|---|---|---|---|---|
| S4-01 | freeze yields final + hash | Frozen DC prerequisite | `scripts/test-decision-context-stage4.ts` | `status===final` && hash === `computeContentHash` |
| S4-02 | resolve binds current final | Binding triple | same | binding id/version/hash match snapshot |
| S4-03 | hash mismatch hard-fails | Hash integrity | same | throws `DC_REPORT_HASH_MISMATCH` |
| S4-04 | draft cannot be used | Frozen-only | same | throws `DcReportBindError` |
| S4-05 | missing DC hard-fails | Required input | same | throws `DC_REPORT_MISSING` |
| S4-06 | read-only mutate guard | No DC writeback | same | `assertStage4ReadOnly(final)` throws `DC_REPORT_READONLY` |
| S4-07 | V1 hash stable after V2 | Versioning / old report | same | superseded hash unchanged; old version resolves |
| S4-08 | DC feed page allowlist | Page feed | same | 05/06/08 non-empty; 03/07 empty |
| S4-09 | face prompt injects DC | Prompt wiring | same | system mentions Stage4 P5; user contains Formal DC |
| S4-10 | Face schemas Stage4 fields | P5/P6/P8 schema | same | Face05/06/08 parse with new fields |
| S4-11 | sample P5/P6/P8 consistency | Shared metrics | same | `assertP5P6P8Consistency` + 8 dimensions ok |
| S4-12 | cover meta binding line | Artifact binding | same | cover includes Decision Context line |
| S4-13 | unverified not upgraded | Fact/hypothesis separation | same | feed keeps unverified bucket + never-upgrade rule |
