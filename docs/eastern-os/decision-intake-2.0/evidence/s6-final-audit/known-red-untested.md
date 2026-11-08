# Known RED / UNTESTED (S6)

**HEAD:** `76fa70bd5577ae4cc5b793e205518c38c5baf2b5`  
**S6 regression:** all required commands exit **0** (see `test-results.txt`)

| Item | Observed at S6 | Class | Blocking? | Notes |
|---|---|---|---|---|
| S3 `ensureSessionFrozenForDelivery` persist-fail | Still `UNTESTED [production-path]` in freeze-wire-reason (`deleteDatabase` / delete-row attempt) | **UNTESTED** · NON_BLOCKING_DISCLOSED | No for Stage 3.2 catalog vertical acceptance; persist success path separately exercised | Do **not** close without real persist-fail evidence |
| S4 C25 real CAS conflict | `PASS  C25 [production-path] real casWritePOJUSession conflict → no durable N/A` | **PASS** | — | Race uses concurrent real `casWritePOJUSession` then stale write; early-throw harness is non-PASS note only |
| S4 script string `UNTESTED [disclose] freeze-versioning F1` | Still printed by write-freeze-consistency | **Historical disclosure string** | No | S4 left unchanged by S5/S6 rules. **Current F1 = PASS** via authority-regression suite. Do not treat string as live F1 RED |
| Pre-S5 F1 RED (`known !== n_a` under DIR-A fixture) | Closed by S5 ACTIVE fixtures + isolation | Was RED; now PASS | — | Documented in F1–F4 matrix |
| New RED introduced by S0–S5 chain | None in S6 re-run | — | — | |
| DC-7b write/Freeze pin incompatibility | Deferred (E-SCHEMA-1) | **SPECIFICATION_GAP / DEFERRED** | No for this slice | Design explicit |
| Topic Rules / catalogConditionEvals / CFP reader | See `authority-gaps.md` | **AUTHORITY_GAP** | No for defined Stage 3.2 DIR user-N/A + Freeze ACTIVE scope | Must not mark PASS-as-closed |

## Severity legend (S6)

- **BLOCKING** — would prevent Stage 3.2 acceptance (none found under audited scope).
- **NON_BLOCKING_DISCLOSED** — known, evidenced, impact bounded.
- **AUTHORITY_GAP** — production SoT not wired; fail-closed or caller-gap as documented.
- **UNTESTED** — no sufficient production-path proof.
- **SPECIFICATION_GAP** — not defined for this slice / deferred.
