# In-tree vendor · ziwei-doushu patterns (build-safe)

- **Upstream:** https://github.com/Renhuai123/ziwei-doushu @ `ff9a147`
- **Why in `lib/ziwei/doushu/`:** Vercel/CI must see these files as normal tracked sources. A git submodule at `vendor/ziwei-doushu` does not expand on deploy → `Module not found`.
- **Included:** `patterns.ts` + `types.ts` + `constants.ts` only (格局闭集).
- **Excluded:** classics / nihai / interpretation datasets / `algorithm.ts` (we keep iztro chart + birth-clock).
- **License:** MIT (upstream). No CC BY 解读包.

App entry: `@/lib/ziwei/doushu-adapter` → imports from this folder.
