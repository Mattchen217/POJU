# SoT16 §11 / §12 / §14 — Baseline live export

## Root cause (Max FAIL 2026-10-21)
Offline HTML **did contain** full B1–B5 DOM (TOC + 5 panes), but PojuLogo / next/image used Tailwind `h-[22px]` / `h-[17px]` only.
Export CSS did not include Tailwind → imgs rendered at intrinsic **711×711 / 1134×198** → blurry Eastern OS logo splash + pager `1/5`.
Vault popup was fine (live React + Tailwind in app).

## Fix (local, gate stays CLOSED)
- `buildOfflineExportLayoutCss()`: force header logo img height, `--delivery-inset:0`, kill backdrop-filter veil
- `normalizeOfflineImages()`: strip width/height, inline height on logo imgs
- `waitForPaneReady` / `waitForBookShellReady`: serialize only after painted `.pcm` + TOC
- `BASELINE_LIVE_EXPORT_VISUAL_PASS = false` until Max re-verify

## Smoke preview
- Desktop: `eastern-os-baseline-profile-live-2026-10-21.SMOKE-FIXED.html` (CSS override on Max FAIL file)
- Re-export after unlock will bake overrides into assembleDocument

## Vault
- Popup stays live `BaselinePortraitBook` (WorkspaceDocVaultModal)
- Download/email gated CLOSED

## No push
