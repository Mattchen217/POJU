# Eastern OS · Pass 经济系统 · 改动对照清单

## 产品定义（锁定）
1. **购买 Flex Pass**：永久有限额度，可退款；账户显示剩余数量
2. **订阅 Pass**：约 30 天有效期额度，不可退款，可取消订阅；账户显示 `剩余/总额`（如 `4/7`）
3. **扣费顺序**：先订阅桶，再购买桶；每个功能解锁消耗 **1 Pass**
4. **Atmos**：扣 1 Pass 后，对该账号 + 档案记录开启 **30 天追踪窗口**（期内不重复扣）
5. **支付网关**：`PAYMENT_GATEWAY_ENABLED=false` 时走占位（mock session），但 `/api/checkout/confirm` **仍按已支付入账**

## Migration（人工）
1. `supabase/migrations/20260728_pass_usage_and_subscription.sql`
2. `supabase/migrations/20260729_pass_dual_balance_atmos.sql` ← flex/sub 双余额 + atmos_entitlements

## 关键路径
| 文件 | 作用 |
|------|------|
| `lib/passes/credit-passes.ts` | 入账（flex / subscription） |
| `app/api/checkout/confirm/route.ts` | mock/success → 入账 |
| `components/account/CheckoutConfirmBanner.tsx` | Profile 回跳确认 |
| `app/api/account/summary/route.ts` | flex / sub / quota / atmos |
| `lib/passes/consume-pass.ts` | 扣费；默认 `PASS_ENFORCE_PRODUCTS=all` |
| `app/api/passes/unlock/route.ts` | 五产品解锁 + Atmos 授权 |
| `app/api/passes/atmos-status/route.ts` | 查询 30 天窗口 |
| `components/workspace/AtmosPaywallModal.tsx` | Atmos 扣 Pass |
| `components/poju/PojuPaywallInline.tsx` | Pivot 扣 Pass |
| `components/cross-product/ToolPaywallInline.tsx` | Match/Syncro/Glyph 扣 Pass |

## 验收
1. Supabase 执行两份 migration
2. 登录 → Pricing CTA → mock checkout → Profile 见 Pass 入账
3. 账户页：购买数 + 订阅 `4/7` 形态
4. 无 Pass 解锁任意产品 → 提示先购买/订阅
5. Atmos 解锁后 30 天内同档案不再扣；过期再扣
6. Pivot paywall 与 final-delivery 同 `session_id` 幂等不双扣

## Env
```
PASS_ENFORCE_PRODUCTS=all   # 默认
# PASS_ENFORCE_PRODUCTS=off
```
