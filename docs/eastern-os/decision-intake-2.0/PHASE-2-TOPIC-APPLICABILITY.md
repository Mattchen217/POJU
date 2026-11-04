# Decision Intake 2.0 · Phase 2 Topic & Applicability Strategy

| Field | Value |
|---|---|
| **Baseline** | `main` @ `1f1c111e` |
| **Companion** | DDR/DIR catalogs · Blueprint Initialization |
| **Rule** | Reusable requirements + applicability — **not** a fixed exhaustive questionnaire |

---

## 0. Purpose

Select which **topic pack DIRs** and whether **`DDR-07-TOPIC-DEPTH` / page 07** are seeded, without silently expanding investigation scope.

Personal Pattern (BaZi/ZiWei) is orthogonal: always available as calc input when profile exists; never substituted for topic RealityFacts.

---

## 1. Topic tag vocabulary

| Tag | Typical decision shapes |
|---|---|
| `career` | Job offer, role change, industry switch |
| `entrepreneurship` | Founding, pivoting venture, capital |
| `relationship` | Partner, family system, close collaboration |
| `relocation` | Move city/country, visa, household |
| `education` | Degree, certification, training path |
| `timing` | When to act among known options (often co-tag) |
| `strategic_choice` | Generic high-stakes fork without other tags |
| `other` | Catch-all; core DDRs only unless user evidence adds tags |

A session may carry **multiple** tags. Overlap rules in §3.

---

## 2. Applicability → seed effects

| Condition | `page_07_emit` | Topic DIRs seeded |
|---|---|---|
| Only `strategic_choice` / `timing` / `other` | **false** | none |
| `career` | **true** | `DIR-JOB-OFFER` (+ `DIR-STAKEHOLDERS` if multi-party) |
| `entrepreneurship` | **true** | `DIR-BIZ-MODEL` |
| `relationship` | **true** | `DIR-REL-DYNAMICS` |
| `relocation` | **true** | `DIR-LOCALE-MOVE` |
| `education` | **true** | `DIR-EDU-PATH` |
| Multiple of above | **true** | Union of packs; **one** `DDR-07` with union `required_dir_ids` |

Core DDRs (`DDR-01*` … `DDR-06*`, `DDR-08*`, `DDR-03*`) **always** considered for seed (03 N/A if no profile).

When `page_07_emit=false`: **do not** create `DDR-07-TOPIC-DEPTH` on Blueprint; page 07 skipped — this is **not** dangling.

When topic later ruled out with evidence: deprecate topic DIRs / mark DDR-07 `n_a` with explicit applicability evidence (Phase 1); do not leave required ids dangling.

---

## 3. Overlap without silent scope expansion

| Rule | Behavior |
|---|---|
| Max tags seeded | All matching packs, but investigation **budget** still soft 12 / hard 15 (Phase 1); Adaptive Engine picks **one** primary question/turn |
| New tag mid-session | Requires Blueprint version bump + user-visible scope note in Understanding; **forbidden** silent add |
| Conflicting tags | Keep both packs; Conflicts object if facts clash — do not auto-drop |
| Chart “suggests” a topic | May propose direction **hypothesis** only; **must not** seed topic DIR as known or as RealityFact |
| User declines topic depth | Topic DIR → declined/unknown per Phase 1; may set DDR-07 boundary / WARN-FAIL per ranking flags — not automatic `n_a` without applicability evidence |

---

## 4. Domain notes (design, not questionnaires)

### Career
Need offer/role, compensation band, timeline, alternative employers — via `DIR-JOB-OFFER` + core constraints.  
Chart pathTags may color language; not substitute for offer facts.

### Entrepreneurship
Runway, model, key dependency — `DIR-BIZ-MODEL`. Estimates allowed with `user_estimate` (no silent confirm).

### Relationship
Boundaries, shared decisions, power/asymmetry — `DIR-REL-DYNAMICS`.  
ZFP `otherChart` only when joint chart exists; never invent partner behavior from self-chart.

### Relocation
Destination constraints, household, legal — `DIR-LOCALE-MOVE`.

### Education
Program fit, cost, opportunity cost — `DIR-EDU-PATH`.

### Timing / strategic choice
Usually no page 07; timing covered by `DIR-TIMING-WINDOW` + core DDRs.

---

## 5. Personal pattern inputs (P2-F summary)

| Rule | Detail |
|---|---|
| Structures | Reuse `ProfileStructured` / ChartFactPack field codes in PageFeedMatrix (`CFP.*`); `ZiweiFactPack` (`ZFP.*`) |
| Provenance | Local calc only; record hashes on Blueprint `profile_binding` |
| Separation | Chart → appendix / slice feeds; **not** RealityFact confirmed |
| No science claim | Do not present systems as scientifically validated prediction |
| No duplicate engine | Do not reimplement BaZi/ZiWei inside Intake |
| Missing profile | DDR-03 N/A; other DDRs proceed |

Full Blueprint handling: `PHASE-2-BLUEPRINT-INITIALIZATION.md` §6.

---

## 6. Classifier placeholder (later phase)

Phase 2 freezes **outputs** of classification (`topic_tags`, `page_07_emit`).  
Implementation of classifier (rules/LLM) is **Phase 3+**. Until then, Lab/manual tag injection is acceptable for design tests.

**Gap:** No production classifier code in repo for Intake 2.0 yet (expected).

---

## 7. Declaration

Docs only. No fixed task table. No Call A/B. Page 07 remains conditional per PageFeedMatrix.
