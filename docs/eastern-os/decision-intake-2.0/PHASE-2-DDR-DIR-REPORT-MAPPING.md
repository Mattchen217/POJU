# Decision Intake 2.0 · Phase 2 DDR ↔ DIR ↔ Report Mapping

| Field | Value |
|---|---|
| **Baseline** | `main` @ `1f1c111e` |
| **Sources** | `PHASE-2-DDR-CATALOG.md` · `PHASE-2-DIR-CATALOG.md` · PageFeedMatrix |
| **Matrix version** | `map_version = 1.1` |

---

## 0. Chain (normative)

```text
Report Deliverable (page/section)
  → DDR (obligation)
  → DIR ids (definitions → live DC.dirs)
  → Required sources (CFP/ZFP/…) when declared
  → Evidence / conflicts
  → Eval order: DIR Rollup → Required Source Check → Conflict → DDR Status → Sufficiency Gate
  → Frozen DC + FreezeRecord → Final judgment
```

Agenda coverage is **audit only**, never sufficiency proof.  
Empty `required_dir_ids` never auto-satisfies; see `PHASE-2-DDR-CATALOG.md` §1.1 / §1.4 / §3.3.1.

---

## 1. Master matrix

| Report page | Section | Deliverable (summary) | DDR ID | Priority | DIR IDs | Evidence types | Ranking impact |
|---|---|---|---|---|---|---|---|
| 01 | A | Primary recommendation | `DDR-01-PRIMARY` | P0 | DEF-QUESTION, DEF-OUTCOME, OPT-ON-TABLE, STATUS-QUO | definition, reality_fact, cfp | yes |
| 01 | B | Hold conditions | `DDR-01-HOLD-CONDITIONS` | P0 | DEF-STAKES, OPT-CONSTRAINTS, TIMING-WINDOW | definition, reality_fact, constraint | yes |
| 01 | C | Anti-path | `DDR-01-ANTI-PATH` | P0 | OPT-ON-TABLE, DEF-UNACCEPTABLE | definition, reality_fact, conflict | yes |
| 02 | A/C | Attribution | `DDR-02-ATTRIBUTION` | P0 | DEF-QUESTION, STATUS-QUO, PAST-ATTEMPTS | reality_fact, definition, **cfp required**, zfp optional | no |
| 02 | B | Science bridge | `DDR-02-SCIENCE-BRIDGE` | P1 | DEF-QUESTION, OPT-CONSTRAINTS, VALIDATION-CAPACITY | reality_fact, constraint, boundary (no CFP req) | no |
| 03 | A/B/C | Chart appendix | `DDR-03-CHART-APPENDIX` | P2 | _(none)_ | **cfp required**, zfp optional | no |
| 04 | A/B/C | Blockers | `DDR-04-BLOCKERS` | P1 | OPT-CONSTRAINTS, RISK-TOLERANCE, OPT-IRREV | constraint, reality_fact, conflict | yes |
| 05 | A/B/C | Ranking | `DDR-05-RANKING` | P0 | OPT-ON-TABLE, DEF-PRIORITIES, DEF-OUTCOME, OPT-CONSTRAINTS | reality_fact, definition, constraint, cfp | yes |
| 05 | D | Switch/stop | `DDR-05-SWITCH-STOP` | P1 | EXIT-CRITERIA, TIMING-WINDOW, RISK-TOLERANCE | reality_fact, constraint, boundary | yes |
| 06 | A/B | Validation | `DDR-06-VALIDATION` | P1 | VALIDATION-CAPACITY, OPT-IRREV, DEF-OUTCOME | reality_fact, constraint, boundary | no |
| 06 | C/D | Rhythm | `DDR-06-RHYTHM` | P2 | TIMING-WINDOW | reality_fact, cfp, zfp? | no |
| 07 | A/B | Topic depth | `DDR-07-TOPIC-DEPTH` | P1* | Topic pack (≥1) | reality_fact, constraint, zfp? | yes* |
| 08 | A/B/C | Boundaries close | `DDR-08-BOUNDARIES` | P0 | EXIT-CRITERIA, DEF-UNACCEPTABLE, RISK-TOLERANCE | reality_fact, constraint, boundary, conflict | no |

\* Page 07 / `DDR-07-TOPIC-DEPTH` only when Topic Applicability sets `page_07_emit=true`; else DDR not seeded → page skipped; not dangling.

DIR IDs abbreviated: prefix `DIR-` omitted in table cells for width; full ids in catalogs.

---

## 2. DIR → DDR reverse index

| DIR ID | Consuming DDRs |
|---|---|
| DIR-DEF-QUESTION | DDR-01-PRIMARY, DDR-02-ATTRIBUTION, DDR-02-SCIENCE-BRIDGE |
| DIR-DEF-OUTCOME | DDR-01-PRIMARY, DDR-05-RANKING, DDR-06-VALIDATION |
| DIR-DEF-STAKES | DDR-01-HOLD-CONDITIONS |
| DIR-DEF-PRIORITIES | DDR-05-RANKING |
| DIR-DEF-UNACCEPTABLE | DDR-01-ANTI-PATH, DDR-08-BOUNDARIES |
| DIR-OPT-ON-TABLE | DDR-01-PRIMARY, DDR-01-ANTI-PATH, DDR-05-RANKING |
| DIR-STATUS-QUO | DDR-01-PRIMARY, DDR-02-ATTRIBUTION |
| DIR-OPT-CONSTRAINTS | DDR-01-HOLD-CONDITIONS, DDR-02-SCIENCE-BRIDGE, DDR-04-BLOCKERS, DDR-05-RANKING |
| DIR-OPT-IRREV | DDR-04-BLOCKERS, DDR-06-VALIDATION |
| DIR-PAST-ATTEMPTS | DDR-02-ATTRIBUTION |
| DIR-TIMING-WINDOW | DDR-01-HOLD-CONDITIONS, DDR-05-SWITCH-STOP, DDR-06-RHYTHM |
| DIR-RISK-TOLERANCE | DDR-04-BLOCKERS, DDR-05-SWITCH-STOP, DDR-08-BOUNDARIES |
| DIR-EXIT-CRITERIA | DDR-05-SWITCH-STOP, DDR-08-BOUNDARIES |
| DIR-VALIDATION-CAPACITY | DDR-02-SCIENCE-BRIDGE, DDR-06-VALIDATION |
| DIR-STAKEHOLDERS | _(support; may attach to DDR-04/07 via Blueprint direction, not hard-required in v1)_ |
| DIR-REL-DYNAMICS | DDR-07-TOPIC-DEPTH (relationship) |
| DIR-JOB-OFFER | DDR-07-TOPIC-DEPTH (career) |
| DIR-BIZ-MODEL | DDR-07-TOPIC-DEPTH (entrepreneurship) |
| DIR-LOCALE-MOVE | DDR-07-TOPIC-DEPTH (relocation) |
| DIR-EDU-PATH | DDR-07-TOPIC-DEPTH (education) |

---

## 3. Integrity rules

1. Every DDR `required_dir_ids` entry **must** exist in DIR catalog (except empty list for `DDR-03` only).  
2. Every DIR used in §1 must appear in DIR catalog.  
3. No orphan DIR required for Gate in v1 except optional `DIR-STAKEHOLDERS` (support).  
4. Page 03 has no DIR requirement — **CFP required source** + optional ZFP (§3.3.1). Empty DIR ≠ satisfied.  
5. `DDR-02-ATTRIBUTION` requires CFP (Rule A); science-bridge does not.  
6. Page 07 absent from Blueprint seed when not applicable — **not** dangling.  
7. PageFeedMatrix page order / responsibilities **unchanged**.

---

## 4. Coverage statistics (`map_version = 1.1`)

| Metric | Value |
|---|---|
| DDRs mapped | 13 / 13 |
| Pages covered | 8 / 8 (`01`–`08`) |
| DDRs with ≥1 DIR | 12 |
| DDRs with empty DIR (valid) | 1 (`DDR-03`) |
| DIRs referenced by ≥1 DDR | 19 / 20 (`DIR-STAKEHOLDERS` support-only) |
| P0 DDR count | 6 |
| Conditional DDR | 1 (`DDR-07`) |

---

## 5. Declaration

Docs only. Traceability aligns Phase 1 C3–C4. No Agenda⇒known.
