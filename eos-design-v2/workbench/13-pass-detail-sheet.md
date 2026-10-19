# PASS Details sheet redesign (Max tip 2026-10-19)

**Status:** LOCK · Engineer local · tip before push  
**Owner:** EOS Design · **Implement:** EOS Engineer  
**Surface:** Account / vault **PASS Details** (`PassDetailSheet` or equivalent — ZH title today:  PASS 详情)  
**Amends:** entry #5 in `12-unified-buy-ui.md` (Get PASS → unified Pricing modal)  
**Screenshot ref:** Max 2026-10-19 (stacked CTAs, “Pivot” in usage ops)

---

## Goal

Larger, clearer PASS Details panel. Strict top→bottom order with **visible section dividers**. Footer = **two buttons side by side** (not stacked). Usage **Operation** labels align to new product language (**Decision dialogue** / 决策对话) — drop legacy engine names like Pivot.

---

## Panel chrome

| | Spec |
|--|------|
| Size | **Larger** than current narrow sheet — target ~`min(560px, 92vw)` wide · `max-height` ~`min(720px, 90vh)`; body scrolls if needed |
| Theme | Existing dark glass + gold accents (match Account / workbench sheets) |
| Header | Title **PASS details** · ZH **PASS 详情** · close ✕ |
| Structure | Header → scrollable body (sections 1–3) → **sticky footer** (section 4 CTAs) |

---

## Section order (locked)

Top → bottom. Each block separated by a **full-width hairline divider** (gold/white ~12–20% opacity, 1px; 16–20px vertical padding above/below).

### 1 — Available balance
| EN UI key | ZH note |
|-----------|---------|
| Available | 可用额度 |
| Purchased Pass (sublabel) | 已购买 Pass |

- Large gold **balance number** (e.g. `4`)  
- Sublabel under number  
- No CTA in this block

### 2 — Purchase records
| EN UI key | ZH note |
|-----------|---------|
| Purchase records | PASS 购入记录 / 购入记录 |

- List or empty state: **No purchase records yet.** · 暂无购买记录。  
- Keep existing row fields if any (date, qty, amount) — do not invent columns without Max

### 3 — Usage records
| EN UI key | ZH note |
|-----------|---------|
| Usage records | PASS 使用记录 |
| Time | 时间 |
| Operation | 操作 |
| Used | 消耗 |

- Table: Time · Operation · Used (−N PASS)  
- Scroll inside table if many rows (footer stays sticky)  
- **Operation value (locked):** always product-facing **Decision dialogue** · ZH **决策对话**  
  - **Do not** show legacy engine/product names (**Pivot**, Atmos, POJU, Tool, etc.) in this column for workbench session spends  
  - Engineer: map all prior Pivot (and sibling) spend labels → this single string in EN/ZH/ES/FR locale packs

### 4 — Footer CTAs (bottom of panel, side by side)

| | Primary (left or dominant) | Secondary |
|--|---------------------------|-----------|
| EN | **Get PASS** | **Refund PASS** (one-click) |
| ZH | **获取 PASS** | **一键退 PASS** |
| Style | Gold filled (existing primary) | Quiet outline / dark muted (secondary) |
| Layout | **One row, equal flex** (`1fr 1fr` or primary ~1.2 / secondary 1), gap 12px, full footer width | |
| Forbidden | Stacking Get above Refund (current screenshot) | |

**Get PASS** → opens **unified Pricing modal** per `12-unified-buy-ui.md` (center portal; card set by subscription).  
**Refund PASS** → existing one-click refund / return flow Payments+Engineer own; Design only places the button. If refund is unavailable (0 balance / no refundable purchased PASS), disable or hide per Payments rules — do not invent copy without Copy/Payments.

---

## Wireframe (ASCII)

```
┌────────── PASS details ────────── ✕ ┐
│                                      │
│  Available                           │
│       4                              │
│  Purchased Pass                      │
│  ──────────────────────────────────  │
│  Purchase records                    │
│  (list / empty)                      │
│  ──────────────────────────────────  │
│  Usage records                       │
│  Time          Operation      Used   │
│  …             Decision dialogue −1  │
│  …             Decision dialogue −1  │
│                                      │
│  ┌─────────────┐  ┌──────────────┐   │
│  │  Get PASS   │  │ Refund PASS  │   │
│  └─────────────┘  └──────────────┘   │
└──────────────────────────────────────┘
```

---

## Copy / i18n notes

- EN UI keys above are Design SoT; ZH in notes for Max parity with screenshot language.  
- ES/FR: follow locked EN meaning (Decision dialogue = session decision chat spend), Copy if missing.  
- Remove or stop shipping **我要退掉 PASS** long label — Max wants **一键退 PASS** tone.

---

## Engineer checklist

1. Widen PASS Details panel; sticky footer with **side-by-side** Get + Refund.  
2. Reorder body: Available → Purchase records → Usage records; **clear dividers** between.  
3. Rename usage Operation display → **Decision dialogue** / **决策对话** (all locales); kill Pivot (etc.) in that column.  
4. Wire Get PASS → unified Pricing panel (`12-unified-buy-ui.md`).  
5. Local only → Ready note → **Max tip to push**.

**Related:** `12-unified-buy-ui.md`, Account PassBalanceCard → this sheet.