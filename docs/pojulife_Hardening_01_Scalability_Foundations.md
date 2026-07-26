# pojulife 加固文档 #01 · 可扩展性地基（Scalability Foundations）

> **背景**：easternos.com（Next.js + PWA，已部署在 Vercel）尚未大规模上线，
> 现在做的是「便宜、不重写框架、为未来铺路」的预防性加固，**不是**架构重构。
>
> **目标（4 项）**：
> 1. 数据库连接池（serverless 环境必做）
> 2. LLM 调用加超时 + 改流式返回
> 3. 业务逻辑从页面里抽出来，做成独立的 service 函数
> 4. 加基础的结构化计时日志
>
> **最高原则**：
> - 🚫 不重写框架、不大改目录结构、不引入新的运行架构
> - 🚫 不破坏任何现有功能（站点正在运转，改动必须可回退）
> - ✅ 每一阶段先审计、先报告、再小步实施
> - ✅ 改动尽量集中、可被 code review

---

## ⚠️ 给 Cursor 的总规则（先读这段）

1. **先审计，后动手。** 先完成 Phase 0，把发现写成一份报告输出给我（项目所有者），
   **等我确认后**再进入 Phase 1–4。不要在 Phase 0 阶段修改任何业务代码。
2. **每个 Phase 独立提交**，commit message 写清楚改了什么、为什么。
3. 不确定的地方**列出来问我**，不要自己猜一个方案就硬改。
4. 凡是涉及 Anthropic / LLM SDK 的具体写法，**以仓库里已安装的 SDK 版本和它的官方文档为准**，
   不要凭记忆写 API。本文给的是「模式」，不是逐字照抄的代码。
5. 任何改动完成后，确认 `npm run build`（或项目对应的构建命令）能通过、本地能正常启动。

---

## Phase 0：自查 + 报告（P0，先做这个，做完停下等确认）

请扫描整个仓库，并产出一份**现状报告**，至少回答以下问题：

### 0.1 技术栈识别
- Next.js 版本？用的是 App Router 还是 Pages Router？
- 用了哪个数据库？（Postgres / MySQL / SQLite / 其他）托管在哪？（Supabase / Neon / PlanetScale / RDS / 其他）
- 数据库访问层是什么？（Prisma / Drizzle / 原生 driver / 其他）
- LLM 调用用的是哪个 SDK？（`@anthropic-ai/sdk` / Vercel AI SDK `ai` / OpenAI SDK / 其他）当前是流式还是一次性返回？
- 运行时是 Node 还是 Edge？（看 route handler / server action 里有没有 `export const runtime`）

### 0.2 现状定位（列清单，给文件路径）
- 现在**所有会调用 LLM 的地方**分别在哪些文件、哪些函数里？它们有没有超时？
- 现在**所有直接访问数据库**的地方在哪里？数据库客户端是如何创建的？（是不是每次请求都新建连接？有没有全局单例？）
- 哪些**页面 / route handler / server action 里塞了大量业务逻辑**（数据库读写、LLM 调用、复杂计算）？列出最「臃肿」的 3–5 个。
- 现在有没有任何日志？格式是什么？

### 0.3 输出
把上面整理成一份 `docs/audit_report.md`，并在对话里向我汇报关键结论：
**「当前最大的并发隐患是什么，4 项加固里哪几项你这边已经做了、哪几项缺失。」**

> ⛔ Phase 0 到此为止，等我回复「继续」再做后面。

---

## Phase 1：数据库连接池（serverless 必做）

**问题背景**：Vercel 上每个 serverless function 实例都可能各自开数据库连接，
流量一上来连接数会被打爆，数据库直接拒绝服务——这是 serverless + 传统数据库最经典的崩法。

### 要做的事

1. **确认 / 切换到「带连接池的连接串」**
   - 如果是 **Supabase**：应用连接用 **Transaction 模式的 pooler 连接串**（通常端口 `6543`），
     迁移（migration）才用 direct 连接（端口 `5432`）。
   - 如果是 **Neon**：用 **pooled connection string**（带 `-pooler` 的 host）。
   - 如果是 **PlanetScale / MySQL**：确认走的是它自带的连接代理。
   - 如果是自建 Postgres：在前面加 **PgBouncer**，或评估 **Prisma Accelerate**。
   - 把「应用用的池化连接串」和「迁移用的直连串」分别放进环境变量（如 `DATABASE_URL` / `DIRECT_URL`）。

2. **数据库客户端做成全局单例**，避免开发热重载或重复 import 时反复 new client。
   通用模式（按实际 ORM 调整）：

   ```ts
   // lib/db.ts —— 以 Prisma 为例，其他 ORM 同理
   import { PrismaClient } from "@prisma/client";

   const globalForDb = globalThis as unknown as { db?: PrismaClient };

   export const db =
     globalForDb.db ??
     new PrismaClient({
       // 视情况设置日志、连接数等
     });

   if (process.env.NODE_ENV !== "production") globalForDb.db = db;
   ```

3. 如果用 Prisma，确认连接串里 `connection_limit` 对 serverless 合理（serverless 通常每实例很小，
   靠外部 pooler 扛总量），并优先评估 **Prisma Accelerate** 这类托管池。

### 不要做
- 🚫 不要为了连接池就换数据库或换 ORM。能用现有方案加 pooler 解决就别折腾。

---

## Phase 2：LLM 调用加超时 + 改流式返回

**为什么**：pojulife 每次生成报告/对话都要等大模型几秒，这是这类产品**唯一真实的并发隐患**。
不处理的话，人一多，服务器上会堆满「还在等模型回复」的长连接；而且 Vercel function 有最大执行时长，
长请求可能直接被网关掐断。

### 2.1 加超时（防止卡死、堆积）
- 用 `AbortController` + `setTimeout` 给每个 LLM 调用设上限（建议先设一个保守值，例如 60s，按实际调）。
  通用模式：

  ```ts
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    // 把 controller.signal 传给 SDK 的请求（具体参数名以所用 SDK 为准）
    const result = await callLLM({ /* ... */ signal: controller.signal });
    return result;
  } finally {
    clearTimeout(timer);
  }
  ```
- 超时要有**用户友好的兜底**：给前端返回一个明确的「生成超时，请重试」状态，而不是让请求一直挂着或抛 500。
- 如果 SDK 自带 `timeout` / `maxRetries` 选项，优先用它，并把重试次数设得克制（避免超时还疯狂重试放大负载）。

### 2.2 改流式返回（streaming）
目标：让用户「边生成边看到内容」，同时**缩短服务端单个请求的占用时间**。

- 调用 LLM 的接口改成 **streaming**，并把 token 流式地传给前端。
- 具体写法**以仓库现有 SDK 为准**：
  - 若用 **Vercel AI SDK**：用它的流式 API（如 `streamText`）+ 对应的 Response 辅助方法，前端用配套 hook 接收。
  - 若直接用 **Anthropic SDK**：用它的 streaming 接口，把事件流接到一个 `ReadableStream` / `Response` 上返回。
  - 不确定写法就**去查该 SDK 的官方文档**，不要凭记忆写。
- 承载 LLM 调用的 route handler 设置合适的最大执行时长（Vercel 的 App Router 用 `export const maxDuration = ...`），
  并确认运行时（Node / Edge）支持你用的流式方式。

### 不要做
- 🚫 不要为了流式就把整套调用逻辑推倒重写；在现有调用点上改造即可。

---

## Phase 3：业务逻辑抽成独立 service 函数

**为什么**：现在如果业务逻辑（数据库读写、LLM 调用、计算）都塞在页面 / route handler 里，
未来想抽独立后端、想加测试、想复用都很痛苦。把它们抽成纯函数，是给未来买的「便宜保险」——现在几乎零成本。

### 要做的事
1. 新建一层 service / 业务逻辑目录（如 `lib/services/` 或 `server/services/`，沿用项目已有约定）。
2. 把 Phase 0 里找出的那 3–5 个最臃肿的页面 / handler 里的业务逻辑**搬进 service 函数**，让它们：
   - 是**纯粹的、可独立调用的函数**，输入参数、输出结果清晰；
   - **不直接依赖** Next.js 的请求/响应对象（即不耦合 framework）。
3. 让原来的页面 / route handler / server action **变薄**：只负责
   `解析输入 → 调用 service 函数 → 返回结果`。

   ```
   route handler  →  解析参数 / 校验
                  →  调用 services.getLeadPackageOptions(...)   ← 业务逻辑在这里
                  →  组织响应返回
   ```

### 重要约束
- 这是**纯重构**：搬动代码、不改变行为。搬完后功能必须和之前**完全一致**。
- 一次搬一个，搬完测一个，别一口气全动。
- 🚫 不改数据库结构、不改 API 对外行为、不改 UI。

---

## Phase 4：基础结构化计时日志

**为什么**：等真有流量时，你要能一眼看出「哪里慢」，而不是瞎猜。
（参考思路：成熟项目里那种 `[API_TIMING]` 全链路打点——带 `request_id`、分阶段耗时、慢请求标记。）

### 要做的事
1. 写一个小的日志辅助工具，输出**结构化 JSON**，至少包含：
   `request_id`、阶段名 `stage`、耗时 `elapsed_ms`、是否慢 `slow`。

   ```ts
   // lib/timing.ts
   export function logTiming(
     stage: string,
     elapsedMs: number,
     extra: Record<string, unknown> = {},
     slowThresholdMs = 1000,
   ) {
     console.log(
       JSON.stringify({
         tag: "API_TIMING",
         stage,
         elapsed_ms: Math.round(elapsedMs * 100) / 100,
         slow: elapsedMs > slowThresholdMs,
         ...extra,
       }),
     );
   }
   ```

2. 给每个请求生成一个 `request_id`（如 `crypto.randomUUID()`），在该请求的各阶段日志里带上它，方便串起来。
3. **重点给这几类操作打点**：每次数据库读写、每次 LLM 调用、每个对外 route handler 的总耗时。
4. **LLM 接口单独设更宽松的慢阈值**（比如 8–10s 才算 slow），否则正常的模型生成会一直误报为慢，
   把真正的慢数据库查询淹没。
5. 日志输出到 `console`（Vercel 会自动收集到 function logs，可在 Vercel 后台查看）。
   不要引入重型日志框架。

### 不要做
- 🚫 不要打印任何敏感信息（用户隐私内容、完整 prompt 正文、密钥、完整连接串）。只记元数据和耗时。

---

## 最终验证清单（每个 Phase 完成后逐项确认）

```
Phase 0
  □ 已产出 docs/audit_report.md
  □ 已向我汇报：当前最大并发隐患 + 4 项里哪些已做/缺失
  □ 未修改任何业务代码

Phase 1（连接池）
  □ 应用使用「池化连接串」，迁移用 direct 连接
  □ 数据库客户端为全局单例，不再每请求新建
  □ 构建通过、本地可正常读写数据库

Phase 2（LLM 超时 + 流式）
  □ 每个 LLM 调用都有超时 + 友好兜底
  □ LLM 调用改为流式返回，前端能边生成边显示
  □ 承载路由设置了合适的 maxDuration

Phase 3（业务逻辑分层）
  □ 已新建 service 层
  □ 最臃肿的 3–5 处逻辑已搬入 service 函数
  □ 页面/handler 变薄，功能与改动前完全一致

Phase 4（计时日志）
  □ 有 logTiming 辅助工具，输出结构化 JSON
  □ DB / LLM / 路由总耗时均有打点，带 request_id
  □ LLM 用更宽松的慢阈值
  □ 日志中无任何敏感信息
```

---

## 一句话给 Cursor

> 先做 **Phase 0**，把审计报告和「现状结论」发给我，**停下等我说「继续」**。
> 之后每个 Phase 单独实施、单独提交，遇到不确定的就问，不要猜着改。
> 全程不重写框架、不破坏现有功能。
