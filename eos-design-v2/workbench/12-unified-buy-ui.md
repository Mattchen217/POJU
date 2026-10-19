# Unified Buy / Subscribe UI (Max tip 2026-10-19)

**Status:** LOCK · Engineer local · tip before push  
**Owner:** EOS Design · **Implement:** EOS Engineer · **Copy:** `LANDING-PRICING-EN-ZH.md` (immutable strings/prices)  
**Visual source:** Landing `#v2-pricing` (dual cards + qty + live CTA total) — Max confirmed screenshot  
**Amends:** `10-left-rail-polish.md` §Buy modal · account buy sheets · paywall modals  
**Patch (Max 2026-10-19):** **No terms checkbox** on Buy/Subscribe — see §Consent

---

## Rule

> **One Pricing UI everywhere.** Landing Pricing look + behavior is the only Buy/Subscribe surface.  
> No parallel "narrow rail buy", no alternate AccountBuySheet look, no one-card-only paywall that invents a second design system.

| Surface | Form |
|---------|------|
| Landing `#v2-pricing` | **Inline** section (source of truth layout) |
| Every other entry | **Same content** in a **center viewport modal** (portal to `body` / workbench root) |

Prefer **one shared component** (e.g. extract landing Pricing panel → reuse inside `PassPurchaseModal` / replace `AccountBuySheet`). Skin once; wire many triggers.

---

## Locked panel contents (match landing)

### Layout
- **Two cards** side-by-side (`md:grid-cols-2`), density per `landing/05-pricing-card-scale.md` (`max-w-3xl`–`4xl` in modal too).
- **No Family/Team card** in the default Buy UI (Pricing SoT deleted it). Plan-switch edge cases (if still needed in code) stay Payments/eng — do not reintroduce a third marketing card without Max.

### Card A — Flex / Buy Pass
- Qty **±** control  
- Feature bullets from Pricing SoT  
- **CTA label updates with qty × unit** (landing behavior): e.g. `Buy Pass · $19.99` → `Buy Passes · $39.98` (locale templates from landing `cta_tpl` / Copy SoT)  
- Unit price display follows **Pricing SoT** ($19.99 / Pass) — not legacy $9.99 in UI chrome

### Card B — Subscription / Personal Plan
- Allocation line (5 PASS / mo + first-month +2 per SoT)  
- Subscribe CTA with SoT price ($59.99 / mo)  
- No qty stepper on this card

### Shared chrome (modal + landing where applicable)
- **Spend order** line (carryover → subscription → purchased) — same wording family as FAQ/Pricing  
- **No checkbox** on purchase/subscribe (Max patch) — see §Consent  
- **Footnote / link row** only: plain links to Terms · Refund · Privacy (informational, not a gate)  
- Gold/glass card chrome consistent with landing `#v2-pricing` / `.v2-price-card`

### Consent (Max patch 2026-10-19)

| Where | What |
|-------|------|
| **Buy / Subscribe UI** | **Remove** the agree-to-terms checkbox. CTAs enabled without a per-purchase tick. |
| **Must-agree legal** | Move into **first-login / first-account forced consent** (one-time checkbox before using the product). Not re-collected on every buy. |
| **Informational** | Keep as **footnote or inline links** beside Pricing ("By buying you acknowledge…" optional soft line OK; **no** disabled-CTA gate). |

Legal owns exact first-login copy if needed; Design owns: **no checkbox on Pricing / PassPurchase surfaces**.

### Payments lock (Max 2026-10-19)
1. First-login forced checkbox MUST link: 18+ · Disclaimer · Terms · Privacy · Refund · Cookies (already in `disclaimer-modal.tsx`).
2. Checkout footnotes (no checkbox): agree links; Flex validity/refund; **Subscribe auto-renew + unused PASS expire at period end** visible beside Subscribe; receipt ≠ chat backup. Mock PASS grant must align SKU qty/plan.

### Modal-only chrome
| | Spec |
|--|------|
| Mount | Portal — **never** clipped inside left rail |
| Backdrop | Full-viewport dim + blur |
| Panel | Centered, `max-width` ~40–48rem, `max-height` ~90vh, scroll inside panel |
| Close | ✕ + backdrop click + Escape |
| Focus | Trap while open |

---

## Entry inventory (all must open the unified panel)

| # | Entry | Today | Target |
|---|-------|--------|--------|
| 1 | Landing `#v2-pricing` | Inline | **Keep inline** |
| 2 | Workbench left rail PASS · Buy | PassPurchaseModal | Center modal = unified Pricing panel |
| 3 | Account PassBalanceCard Buy | AccountBuySheet | Same unified modal (thin wrapper) |
| 4 | Account SubscriptionCard | AccountBuySheet | Same |
| 5 | PassDetailSheet → Buy | buy sheet | Same |
| 6–10 | Atmos / Poju / Tool / Pivot / POJUChatUI | PassPurchaseModal | Same panel chrome |
| 11 | Legacy product-pricing / syncro-pricing-cta | separate | Route `/#pricing` — no third visual |

## Behavior checklist
1. Qty ± updates Flex CTA **total** immediately.
2. **No** terms checkbox gate on Buy/Subscribe.
3. Spend order visible.
4. Checkout uses `startPassCheckout` → create → mock/success confirm → `creditPassesFromCheckout`.
5. Locale EN/ZH/ES/FR — display prices Pricing SoT ($19.99 / $59.99).

## Engineer checklist
1. Inventory confirm; add missed Buy triggers
2. Extract one Pricing panel shared by landing twin + modal
3. Point entries 2–10 at that panel (center portal)
4. Kill divergent AccountBuySheet chrome (thin wrapper)
5. Strip purchase checkboxes; footnotes; first-login already covers must-agree
6. Local only → Ready → Max tip to push