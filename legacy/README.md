# Quarantine — Syncro, Glyph, and Match

These three product trees were moved out of the Next.js app so they are not routes and are not typechecked with Eastern OS (POJU). The live app is POJU, Atmos, archive, and profile.

`legacy/` is excluded from `tsconfig.json`. Nothing under `app/` should import these folders.

## What lives here

Each product keeps its old relative layout under a product folder:

| Original | Quarantine |
| --- | --- |
| `app/[locale]/(marketing)/{product}` | `legacy/{product}/app-marketing` |
| `app/api/{product}` | `legacy/{product}/app-api` |
| `components/{product}` | `legacy/{product}/components` |
| `styles/{product}*.css` | `legacy/{product}/styles` |
| product `lib/{product}` files | `legacy/{product}/lib` |
| `components/marketing/{product}-*` | `legacy/{product}/marketing` |
| `components/archive/{product}-archive-detail.tsx` | `legacy/{product}/` |
| `lib/llm/services` and `lib/llm/prompts` for that product | `legacy/{product}/llm` |
| `public/spline/{product}*` | `legacy/{product}/public` |
| workspace panels and prepare stages | `legacy/{product}/workspace` |
| Inngest Syncro batch functions | `legacy/syncro/inngest` |
| product test scripts | `legacy/{product}/scripts` |

MatchPanel was not its own file. It lived in `components/workspace/panels/EnginePanels.tsx` and was removed from the main tree. The Match workspace stages are in `legacy/match/workspace/`.

## Left in the main tree on purpose

Shared code that Eastern OS still imports was not moved:

- `lib/calendar/**`, `lib/compatibility/**`, `lib/device/**`
- `lib/location/city-search-result.ts`
- `lib/match/data/**`, `lib/match/calculations/**`, `lib/match/calculate-compatibility.ts`, `lib/match/parse-profile-for-matrix.ts` (re-exports)
- `lib/match/match-user-labels.ts` (matrix narrative)
- `lib/llm/prompts/match-relation-mechanism-anchors.ts` (POJU dyad)
- `lib/llm/prompts/oriental-shared-guardrails.ts` (base analysis; extracted from the Glyph prompt)
- `lib/syncro/true-solar-time.ts`, `wuxing-utils.ts`, `device-capability.ts`, `device-check.ts`, `nominatim-search.ts`
- `lib/syncro/device-usage.ts` re-exports `lib/device/device-usage.ts`
- `styles/glyph-delivery.css`, `styles/glyph-front-compact.css`, `styles/glyph-draw-sequence.css` (POJU delivery and the remaining oracle shell import them)

Archive still loads old Glyph / Match / Syncro rows. Detail views are stubbed. Types live in `lib/archive/legacy-product-types.ts`.

## Restore one product

1. Move each quarantined folder back to the path in the table above. `app-marketing` goes back to `app/[locale]/(marketing)/{product}`. `app-api` goes back to `app/api/{product}`. `lib` files go back under `lib/{product}/`. LLM files go back under `lib/llm/services/` or `lib/llm/prompts/` by their original filenames. Workspace files go back under `components/workspace/` or `components/workspace/panels/`.
2. Remove `legacy` from the `exclude` list in `tsconfig.json`.
3. Put the nav links back in `MainNav`, `mobile-drawer`, both site headers, and `pwa-tabbar`.
4. Put `match`, `syncro`, and `glyph` back on `WorkspaceTab` in `lib/ui-shell/resolve-ui-shell.ts`, and wire `WorkspaceShell` to the panels again.
5. Register `syncroGenerateBatch` again in `app/api/inngest/route.ts` if you restore Syncro.
6. Restore the Syncro and Match `maxDuration` entries in `vercel.json` if you restore those API routes.
7. Put the three product cards back in `lib/marketing/build-classic-home-copy.ts`.

Do not restore by copying over the shared shims listed above. Those files stayed in place so POJU would keep building.

## Live leftovers

- `app/api/oracle/draw` and `app/api/oracle/full-reading` stay, and return 410. The oracle shell pages are still routed, but they no longer load Glyph signs or readings.
- Profile location upgrade uses `BirthCitySearchInput` and `/api/location/search-city` instead of the Syncro city box.
- `legacy/` is excluded from TypeScript. Files inside it still import the old `@/` paths, so they typecheck again only after you move them back.
