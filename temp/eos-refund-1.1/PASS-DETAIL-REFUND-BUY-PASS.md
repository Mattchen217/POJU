# PASS detail · Refund unused Buy Pass (self-serve) · 2026-10-19
**Owner:** EOS Payments · **max locked intent** · Hand Grok → Engineer  
**Why:** Cut chargeback risk—product initiates refund to original method; unused Buy Pass only.

## Scope
| In | Out |
|----|-----|
| **已购买 Pass** / purchased (flex) balance only | Subscription allotment / 订阅额度 |
| Unused units still on ledger | Consumed / dialogue-started PASS |
| Qty select 1…remaining purchased (= N full txn refunds under Path A) | Mid-cycle sub pro-rata; partial-dollar cut of one charge |

## UI (under 已购买 Pass, beside/below 购入记录)
| slot | EN | ZH | ES | FR |
|------|----|----|----|----|
| Link | Refund unused PASS | 我要退掉 PASS | Reembolsar PASS sin usar | Rembourser des PASS non utilisés |
| Modal title | Refund PASS | 退 PASS | Reembolsar PASS | Rembourser des PASS |
| Qty help | Max = your remaining purchased PASS | 上限 = 已购买 Pass 剩余数量 | Máx. = PASS comprados restantes | Max = PASS achetés restants |
| Primary CTA | Refund $X.XX | 确认退款 $X.XX | Reembolsar $X.XX | Rembourser $X.XX |
| Confirm title | Confirm refund? | 确认退款？ | ¿Confirmar reembolso? | Confirmer le remboursement ? |
| Confirm body | This refunds unused purchased PASS to your original payment method. If you don’t have enough PASS left, you won’t be able to run Eastern OS until you buy or subscribe again. Timing follows the payment provider. | 此操作将未使用的**已购买 PASS**退回原支付方式。若剩余 PASS 不足，将无法使用本站功能，需再次购买或订阅。到账时间按支付渠道规则。 | Esto reembolsa PASS comprados sin usar al método de pago original. Si no te quedan PASS suficientes, no podrás usar Eastern OS hasta comprar o suscribirte de nuevo. Los plazos siguen al proveedor de pago. | Cela rembourse des PASS achetés non utilisés vers le moyen de paiement d’origine. Sans assez de PASS, tu ne pourras plus utiliser Eastern OS tant que tu n’as pas racheté ou réabonné. Les délais suivent le prestataire de paiement. |
| Confirm CTA | Confirm refund | 确认退款 | Confirmar reembolso | Confirmer le remboursement |
| Cancel | Cancel | 取消 | Cancelar | Annuler |

## Ledger / money rules
1. Cap qty = **purchased/flex remaining** only (not sub, not already-consumed).
2. $ on button = sum of the related **full** original payments for the selected unused purchased units (FIFO by purchase). Default unit = live Buy Pass price only when every unit maps to that SKU; never invent a rate. **Path A:** never compute a partial dollar cut of one combined charge.
3. On confirm: debit ledger first (or in same txn as provider refund id), then call MoR/provider **full refund** once per related purchase transaction (N selected units → N full refund API calls) to original method.
4. Provider timing/fees/windows still apply—copy may say “timing follows the payment provider,” not “instant.”
5. If any provider refund fails: restore ledger (or partial success state) for failed units; never leave money gone and PASS gone without a clear error + support path.
6. **Engineer must verify Creem Path A** before shipping the link: buy N = N separate transactions; refund N = N full refunds; **no** partial-amount API.

## Copy / policy locks
- Purchase card stays clean—**do not** market “支持一键退款” on Buy CTA until this ships.
- After ship: Pricing/FAQ may say unused **purchased** PASS can be refunded in PASS details; keep “refunds follow provider rules” for **settlement timing**, not as a substitute for this button.
- Subscription: cancel flow only—no refund PASS control on 订阅额度.
- Legal: update Refund Policy §3.3 from “support review only” → self-serve unused Buy Pass when this ships (counsel still pending).

## Success criteria
- Link only when purchased remaining ≥ 1
- Modal mirrors Buy qty stepper; CTA shows dollar amount
- Double confirm before provider call
- Chargeback-friendly: user can self-serve unused Buy Pass without bank dispute

## Max lock 2026-10-19 — Creem path A
**1 PASS = 1 Creem transaction** on both buy and refund.
- Buy qty 3 → create **3** one-time checkouts/transactions (or equivalent multi-intent that yields 3 `transaction_id`s), credit 3 purchased PASS.
- Refund qty N → full-refund **N** unused purchase transactions via `POST /v1/refunds` each (FIFO of unused purchased intents). Creem API has no partial `amount`.
- UI ± stepper stays; each step maps 1:1 to a whole txn.
- Do **not** put multiple PASS on a single Creem charge.
---
Legal §3.3 'partial quantity' is implemented as N full txn refunds under path A, not one partial amount.

**Legal alignment (2026-10-19):** Refund Policy §3.3 public body now states Path A in plain English (N units → N full refunds of related original payments, typically FIFO; no partial-amount of one combined charge). Provider names stay out of public legal copy. Counsel PENDING retained.
