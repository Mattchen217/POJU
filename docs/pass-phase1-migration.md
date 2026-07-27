# Pass 经济 · Phase 1 改动对照清单 · DB（usage + consume + 订阅列）

## 产品决策（本期默认）
1. **消费门禁**：先 Pivot 灰度，env `PASS_ENFORCE_PRODUCTS`（Phase 3/6）
2. **月度重置**：**策略 B** — `balance = max(balance, monthly_quota)`（`topup_subscription_passes`）
3. **Team 多成员**：本期单账户发 Pass；成员共享另开文档

## 新增文件
- `supabase/migrations/20260728_pass_usage_and_subscription.sql`
- `lib/passes/types.ts` — `PassProduct` / `toPassProduct`（`poju` → `pivot`）
- `scripts/test-pass-phase1-migration.ts`
- `docs/pass-phase1-migration.md` — 本清单

## 修改文件
- 无应用代码改动（充值 webhook / checkout 未动）

## SQL 内容
| 对象 | 作用 |
|------|------|
| `pass_usage` | 用量账本 + `(user_id, product, ref_id)` 幂等唯一索引 |
| `consume_user_pass` | 原子扣 1 Pass + 记用量；已扣返回 `already_consumed` |
| `user_passes.stripe_subscription_id` / `current_period_end` | 订阅生命周期 |
| `profiles.stripe_customer_id` | `IF NOT EXISTS`（已存在于 20260727 migration） |
| `topup_subscription_passes` | 策略 B 续订补额（Phase 4 webhook 用） |

## 人工：在 Supabase 执行
1. SQL Editor 粘贴并运行 `20260728_pass_usage_and_subscription.sql`
2. 冒烟（替换 `<uid>`）：
```sql
-- 先给测试用户加 2 Pass（若还没有）
SELECT public.increment_user_passes('<uid>'::uuid, 2, NULL);

-- 第一次消费
SELECT * FROM public.consume_user_pass('<uid>'::uuid, 'pivot', 'test-ref-1', 'smoke');
-- → ok=true, reason=consumed, balance_after=1

-- 同 ref 重试
SELECT * FROM public.consume_user_pass('<uid>'::uuid, 'pivot', 'test-ref-1', 'smoke');
-- → ok=true, reason=already_consumed（余额不变）

-- 耗尽后再扣
SELECT * FROM public.consume_user_pass('<uid>'::uuid, 'pivot', 'test-ref-2', 'smoke');
SELECT * FROM public.consume_user_pass('<uid>'::uuid, 'pivot', 'test-ref-3', 'smoke');
-- → insufficient_balance
```

## 冒烟（仓库）
```bash
pnpm exec tsx scripts/test-pass-phase1-migration.ts
# → test-pass-phase1-migration: ok
```

## 回归自查
1. webhook 充值 — ✅ 未改
2. checkout Cookie user — ✅ 仍用 `getServerUser`（认证 Phase 5）
3. i18n — ✅ 未改
4. build — 仅 SQL + types，无页面

## 已知 / 下一步
- Phase 2：`GET /api/account/summary` + ProfilePanel 四块 UI
- Phase 3：`consume-pass.ts` + 只接 Pivot
- `profiles.stripe_customer_id` 写回仍待结账/Portal（Phase 4/5）
