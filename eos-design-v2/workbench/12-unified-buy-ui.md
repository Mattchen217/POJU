# Unified Buy / Subscribe UI (Max tip 2026-10-19)

**Status:** LOCK · Engineer local · tip before push  
**Owner:** EOS Design · **Implement:** EOS Engineer · **Copy:** `LANDING-PRICING-EN-ZH.md` (immutable strings/prices)  
**Visual source:** Landing `#v2-pricing` (dual cards + qty + live CTA total + **starry sky**) — Max confirmed screenshot  
**Amends:** `10-left-rail-polish.md` §Buy modal · account buy sheets · paywall modals  
**Patch (Max 2026-10-19):** **No terms checkbox** on Buy/Subscribe — see §Consent  
**Patch (Max/Grok 2026-10-19 visual + sub gate):** Modal **must twin** landing Pricing visuals; subscription card **gated** on non-landing — see §Subscription gate + §Visual twin

---

## Rule

> **One Pricing UI everywhere.** Landing Pricing look + behavior is the only Buy/Subscribe surface.  
> No parallel "narrow rail buy", no alternate AccountBuySheet look, no one-card-only paywall that invents a second design system.  
> **Forbidden chrome:** separate 「Get Passes / Switch Plan / PASS REQUIRED」 shell, solid-gold 「Switch to Personal」 primary that looks unlike landing outlined CTAs, large legal footer box that dominates the panel.

| Surface | Form |
|---------|------|
| Landing `#v2-pricing` | **Inline** section (source of truth layout) — **always dual cards** |
| Every other entry | **Same content** in a **center viewport modal** (portal to `body` / workbench root) |

Prefer **one shared component** (`UnifiedPricingPanel` — landing Pricing panel reused inside `PassPurchaseModal` / thin `AccountBuySheet`). Skin once; wire many triggers.

---

## Subscription gate (Max 2026-10-19)

| Surface | Not subscribed | Already subscribed (Personal / Team entitlement) |
|---------|----------------|--------------------------------------------------|
| Landing `#v2-pricing` | **Both** Buy Pass + Subscription | **Both** (always dual — no gate) |
| Workbench modal / AccountBuy / paywalls | **Both** cards | **Buy Pass (Flex) only** — **hide** Subscription card |

Detect subscribed via the same SoT the workbench already uses for Personal plan (e.g. `/api/account/summary` → `subscription.plan`, or `currentPlan` prop). Prefer: active Personal/subscription entitlement ⇒ hide Subscribe; otherwise dual.

---

## Visual twin (landing Pricing → modal)

Modal content **IS** the landing Pricing visual — not a parallel Get-Passes layout.

Required:
- Dark **starry sky / cosmos** background behind the pricing cards (not flat charcoal modal body alone).
- Two equal-height cards (when dual): charcoal/glass + thin gold border, gold accents, hover glow matching `#v2-price-grid .v2-price-card`.
- **Buy Pass** card: icon top-left, `$19.99/ Pass` top-right; title 「Buy Pass」; gold subtitle 「No lock-in · pay as you go」; QUANTITY ± with 「N Pass」; feature bullets; CTA outlined gold 「Buy Pass」 + live `$19.99` (or qty×).
- **Subscription** card: icon, `$59.99/ mo`; title 「Subscription」; gold 「Most popular · as low as ≈ $12 / Pass (~40% off)」; ALLOCATION 「5 Passes / month」; bullets incl first-month +2 bonus in gold; CTA 「Subscribe」 + `$59.99`.
- Footnotes quieter than a big legal box; links only (no checkbox).

---

## Locked panel contents (match landing)

### Layout
- **Two cards** side-by-side (`md:grid-cols-2`), density per `landing/05-pricing-card-scale.md` (`max-w-3xl`–`4xl` in modal too). When subscribed on non-landing: single Buy Pass card, narrower sheet OK.
- **No Family/Team card** in the default Buy UI (Pricing SoT deleted it). Plan-switch edge cases stay Payments/eng — do not reintroduce a third marketing card without Max.

### Card A — Flex / Buy Pass
- Qty **±** control  
- Feature bullets from Pricing SoT  
- **CTA label + live total** with qty × unit (landing behavior)  
- Unit price display follows **Pricing SoT** ($19.99 / Pass)

### Card B — Subscription
- Allocation line (5 PASS / mo + first-month +2 per SoT)  
- Subscribe CTA with SoT price ($59.99 / mo)  
- No qty stepper on this card  
- **Hidden** when already subscribed (non-landing only)

### Shared chrome (modal + landing where applicable)
- **No checkbox** on purchase/subscribe (Max patch) — see §Consent  
- **Footnote / link row** only: Terms · Refund · Privacy (informational, not a gate)  
- Gold/glass card chrome consistent with landing `#v2-pricing` / `.v2-price-card`
- Spend-order line is optional/quiet; **do not** put it in a PASS REQUIRED header that breaks the landing twin

### Consent (Max patch 2026-10-19)

| Where | What |
|-------|------|
| **Buy / Subscribe UI** | **Remove** the agree-to-terms checkbox. CTAs enabled without a per-purchase tick. |
| **Must-agree legal** | Move into **first-login / first-account forced consent** (one-time checkbox before using the product). Not re-collected on every buy. |
| **Informational** | Keep as **footnote or inline links** beside Pricing ("By buying you acknowledge…" optional soft line OK; **no** disabled-CTA gate). |

### Payments lock (Max 2026-10-19)
1. First-login forced checkbox MUST link: 18+ · Disclaimer · Terms · Privacy · Refund · Cookies (already in `disclaimer-modal.tsx`).
2. Checkout footnotes (no checkbox): agree links; Flex validity/refund; **Subscribe auto-renew + unused PASS expire at period end** visible beside Subscribe; receipt ≠ chat backup. Mock PASS grant must align SKU qty/plan.

### Modal-only chrome
| | Spec |
|--|------|
| Mount | Portal — **never** clipped inside left rail |
| Backdrop | Full-viewport dim + blur |
| Panel | Centered, `max-width` ~40–48rem (dual) / ~26rem (single Flex), `max-height` ~90vh, scroll inside panel; **starry** sheet |
| Close | ✕ + backdrop click + Escape |
| Focus | Trap while open |
| Title chrome | **No** 「PASS REQUIRED / Get Passes / Switch Plan」 eyebrow+title shell — cards are the content |

---

## Entry inventory (all must open the unified panel)

| # | Entry | Today | Target |
|---|-------|--------|--------|
| 1 | Landing `#v2-pricing` | Inline | **Keep inline — always dual** |
| 2 | Workbench left rail PASS · Buy | PassPurchaseModal | Center modal = unified Pricing twin (+ sub gate) |
| 3 | Account PassBalanceCard Buy | AccountBuySheet | Same unified modal (thin wrapper) |
| 4 | Account SubscriptionCard | AccountBuySheet | Same |
| 5 | PassDetailSheet · Buy | buy sheet | Same |
| 6–10 | Atmos / Poju / Tool / Pivot / POJUChatUI | PassPurchaseModal | Same panel chrome |
| 11 | Legacy product-pricing / syncro-pricing-cta | separate | Route `/#pricing` — no third visual |

## Behavior checklist
1. Qty ± updates Flex CTA **total** immediately.
2. **No** terms checkbox gate on Buy/Subscribe.
3. Non-landing: subscribed → Flex only; unsubscribed → dual.
4. Landing always dual.
5. Checkout uses `startPassCheckout` → create → mock/success confirm → `creditPassesFromCheckout`.
6. Locale EN/ZH/ES/FR — display prices Pricing SoT ($19.99 / $59.99); card titles/badges/bullets align with landing copy.

## Engineer checklist
1. Inventory confirm; add missed Buy triggers
2. `UnifiedPricingPanel` = landing twin (starry sheet + card UI + features)
3. Point entries 2–10 at that panel (center portal); drop Get Passes shell
4. Wire `subscribed` / `hideSubscription` from account summary / `currentPlan`
5. Kill divergent AccountBuySheet chrome (thin wrapper)
6. Strip purchase checkboxes; footnotes; first-login already covers must-agree
7. Update this SoT; Local only — Ready — Max tip to push — **no commit / no push** until tipped
