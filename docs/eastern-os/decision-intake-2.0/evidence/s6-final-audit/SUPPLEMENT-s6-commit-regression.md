# S6 Supplement — Regression at Exact S6 Commit + DC §7 Cite Fix

| Field | Value |
|---|---|
| **Purpose** | Close CONDITIONAL block: (1) re-run 9 commands with HEAD = S6 audit commit; (2) fix DC matrix SSOT cite §9 → §7 |
| **Parent of this supplement commit** | `f1454b87e9dbea71837f1d2f27ab181986961fae` |
| **Production / test code changed?** | **No** |
| **Prior evidence preserved?** | Yes — original `toolchain.txt` / `test-results.txt` retained as historical S5-HEAD run |

## 1. HEAD verification before re-run

```
HEAD  = f1454b87e9dbea71837f1d2f27ab181986961fae
HEAD^ = 76fa70bd5577ae4cc5b793e205518c38c5baf2b5
node  = v22.22.0
pnpm  = 10.33.2
branch = feat/s6-stage-3-2-final-audit
```

Source: `toolchain-s6-commit.txt`

## 2. Exit codes (at S6 commit)

| Command | Exit |
|---|---|
| test:intake-r6-dir-catalog | 0 |
| test:intake-r6-resolver | 0 |
| test:intake-r6-na-cas | 0 |
| test:intake-r6-production-agg | 0 |
| test:intake-r6-freeze-wire-reason | 0 |
| test:intake-r6-write-freeze-consistency | 0 |
| test:intake-r6-freeze-authority-regression | 0 |
| test:intake-r6-freeze-versioning | 0 |
| tsc --noEmit | 0 |

Raw log: `test-results-s6-commit.txt`

## 3. DC matrix citation fix

- **Was:** Rev 1.3 §9 table (incorrect — §9 is separate-authorization items)
- **Now:** Rev 1.3 **§7 Test matrix**
- DC-7b remains **SPECIFICATION_GAP / DEFERRED**
