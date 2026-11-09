# Fail-closed proof

M1R-05 forces persist failure via `__setM1rPersistForTests`:

- Assistant content matches system write-failure copy
- `meta.m1_fail_closed` / error text present
- `decision_context` remains null (no silent adopt)
- Freeform stub text never shown

Agent source must contain `FAIL-CLOSED` / `m1_fail_closed` and must **not** treat persist failure as non-fatal free-ask fallback.
