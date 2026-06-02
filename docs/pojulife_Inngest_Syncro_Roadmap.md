# pojulife Inngest Syncro 真后台改造 完整 Roadmap

> 目标:用户离开 PWA / 切换功能 / 熄屏后,Syncro 12 时辰 LLM 生成在云端持续进行。
> 用户回来后,看到真实进度,不是从断点开始。
>
> 当前进度:Step A / B-1 完成,B-2 进行中(待调试 0/12 问题)。

---

## 总体架构

```
旧架构(失败):
  用户点击 → 客户端 fetch SSE → 服务端跑 LLM → 用户离开就断

新架构(Inngest 真后台):
  用户点击 → 客户端发 Inngest event → 后台 function 串行 12 时辰 → 写 KV
                                            ↓
  客户端定期轮询 status API → 读 KV → 显示进度 + 内容
                                            ↓
                                    用户离开:Inngest 继续跑
                                    用户回来:轮询读 KV,看到真实进度
```

### 关键文件清单

```
基础设施(Step A,已完成):
  ✓ lib/inngest/client.ts                       Inngest 客户端
  ✓ app/api/inngest/route.ts                    Inngest webhook 端点

状态层(Step B-1,已完成):
  ✓ lib/syncro/syncro-status-kv.ts              进度 + 时辰 advice KV 读写

LLM 核心(Step B-2,进行中):
  ⚠ lib/syncro/syncro-llm-core.ts               LLM helper(已建,有 bug)
  ⚠ app/api/syncro/stream_hour/route.ts          改成调 helper(已改,需测)

Inngest function(Step B-3,待做):
  ○ inngest/functions/syncro-generate.ts         后台串行 12 时辰
  ○ app/api/inngest/route.ts                    注册 function

触发/轮询 API(Step C,待做):
  ○ app/api/syncro/inngest_start/route.ts       触发 event
  ○ app/api/syncro/inngest_status/route.ts      返回进度+内容

客户端改造(Step D,待做):
  ○ lib/syncro/use-syncro-inngest-poll.ts       轮询 hook
  ○ components/syncro/SyncroResultPage.tsx       触发 + 轮询
  ○ components/syncro/SyncroPreparingLiveHour    显示进度(不再调 LLM)
  ○ components/syncro/SyncroLlmBatchRunner       废弃

测试 + 上线(Step E,待做)
```

---

## Step B-2 调试要点(当前位置)

### 现状

服务端 LLM 跑成功,但客户端 0/12。
Cursor 已加诊断日志,等部署后看完整 trace。

### 可能的断点

```
1. complete event 没发到客户端
   - 服务端日志看 [stream_hour] xx sending complete with N cells
   - 如果没这条 → helper 返回 result 后,stream_hour 没 send complete
   
2. complete event 到了,但 advice = {}
   - 服务端日志看 [helper] xx parse success, advice keys = N
   - 如果 N = 0 → JSON 解析后 advice 是空的(direction 映射失败)
   
3. complete 到了,advice 正常,但 IDB 写入失败
   - 客户端 Console 看 [preparing-live] IDB patched
   - 如果没这条 → patchSyncroSessionMatrix 失败
   
4. IDB 写入成功,但 BatchRunner 没启动
   - 客户端 Console 看 [BatchRunner] starting
   - 如果没这条 → 父组件 liveHourReady 没变 true
   
5. BatchRunner 启动了,但 progress 没增加
   - 客户端 Console 看 [BatchRunner] hour xx done, progress=N/12
```

### 调试步骤

1. 推送 Cursor 已加的服务端诊断日志
2. 同时加客户端 console.log(指令见附录 A)
3. 部署到 Vercel
4. Chrome 桌面跑一次 Syncro,F12 全程开着
5. 同时收集 Vercel 日志 + 浏览器 Console
6. 定位到具体断点
7. 1-2 行精准修复

---

## Step B-3:Inngest function 实现

### 文件 1:`inngest/functions/syncro-generate.ts`(新建)

核心逻辑:

```typescript
import { inngest } from "@/lib/inngest/client";
import { generateSyncroHourAdvice } from "@/lib/syncro/syncro-llm-core";
import {
  setSyncroStatus,
  getSyncroStatus,
  setSyncroHour,
  getSyncroHour,
  incrementSyncroStatus,
  markSyncroHourFailed,
} from "@/lib/syncro/syncro-status-kv";

export const syncroGenerateAllHours = inngest.createFunction(
  {
    id: "syncro-generate-all-hours",
    concurrency: { limit: 10 },  // 同时最多 10 个 session
    retries: 2,  // 整体 retries,加上每个 step 内部 retry
  },
  { event: "syncro/generate.requested" },
  async ({ event, step }) => {
    const { sessionId, hourOrder, llmInputs } = event.data;
    // llmInputs: Record<hour_id, SyncroLlmHourInput>
    
    // 1. 读取或初始化状态(支持续跑)
    let status = await step.run("get-or-init-status", async () => {
      let s = await getSyncroStatus(sessionId);
      if (!s) {
        s = {
          total: 12,
          completed: 0,
          current_hour: hourOrder[0],
          failed_hours: [],
          hour_order: hourOrder,
          started_at: Date.now(),
          updated_at: Date.now(),
          done: false,
        };
        await setSyncroStatus(sessionId, s);
      }
      return s;
    });
    
    // 已完成,直接返回
    if (status.done) {
      console.log(`[inngest] ${sessionId} already done`);
      return { sessionId, skipped: true };
    }
    
    // 2. 串行 12 时辰
    for (const hourId of hourOrder) {
      // 检查是否已在 KV 完成(续跑跳过)
      const existing = await step.run(`check-${hourId}`, async () => {
        return await getSyncroHour(sessionId, hourId);
      });
      
      if (existing) {
        console.log(`[inngest] ${hourId} already exists, skip`);
        continue;
      }
      
      try {
        // 3. 生成该时辰 advice
        // step.run 自动重试(最多 retries 次)
        // step 超时受 Vercel maxDuration 限制(300s)
        const advice = await step.run(`generate-${hourId}`, async () => {
          const input = llmInputs[hourId];
          if (!input) {
            throw new Error(`missing_input_${hourId}`);
          }
          
          // 调用 LLM helper(不传 callback,等完整返回)
          const result = await generateSyncroHourAdvice(input);
          
          if (!result.advice || Object.keys(result.advice).length === 0) {
            throw new Error(`empty_advice_${hourId}`);
          }
          
          return result.advice;
        });
        
        // 4. 写 KV
        await step.run(`save-${hourId}`, async () => {
          await setSyncroHour(sessionId, hourId, {
            advice,
            completed_at: Date.now(),
          });
          
          // 找下个未完成的 hour
          const idx = hourOrder.indexOf(hourId);
          const nextHour = hourOrder[idx + 1] ?? null;
          await incrementSyncroStatus(sessionId, hourId, nextHour);
        });
      } catch (e) {
        // 单个时辰失败,标记并继续(不阻塞其他时辰)
        console.error(`[inngest] ${hourId} failed:`, e);
        await step.run(`mark-failed-${hourId}`, async () => {
          await markSyncroHourFailed(sessionId, hourId);
        });
      }
    }
    
    return { sessionId, completed: true };
  }
);
```

### 文件 2:`app/api/inngest/route.ts`(改造)

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncroGenerateAllHours } from "@/inngest/functions/syncro-generate";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncroGenerateAllHours],  // 注册 function
});
```

### 关键设计要点

1. **每个 step 独立**:Inngest 每个 step.run 是独立的 Vercel function 调用
2. **总时间不受限**:12 个 step 串联,总时间可以 30+ 分钟
3. **单 step 受限**:每个 step 仍在 maxDuration 内(300s)
4. **续跑天然支持**:getSyncroHour 检查 → 已存在跳过
5. **失败隔离**:单时辰失败不阻塞其他,标记 failed_hours
6. **重试**:Inngest 自动 retry(每 step 2 次)

### 验证

```bash
# 1. typecheck
pnpm exec tsc --noEmit

# 2. 部署到 Vercel

# 3. Inngest Dashboard:
#    - Functions tab 看到 "syncro-generate-all-hours"
#    - 状态:Active

# 4. 手动 trigger 测试:
#    在 Inngest Dashboard:
#    - Events → Send Event
#    - Name: syncro/generate.requested
#    - Data: { "sessionId": "test-123", "hourOrder": ["zi","chou",...], "llmInputs": {...} }
#    - 看 Function Runs 是否成功执行
```

### Cursor 指令(B-3)

```
任务:Step B-3 - 实现 Inngest function

⛔ 严格只动 2 个文件:
   - 新建:inngest/functions/syncro-generate.ts
   - 改造:app/api/inngest/route.ts(只加 import + functions 数组)
⛔ 不允许改其他文件
⛔ 不允许动 syncro-llm-core.ts 或 syncro-status-kv.ts
⛔ 不允许实现客户端轮询(那是 Step C/D)

实现 syncroGenerateAllHours function,代码见 roadmap 文档 Step B-3。

关键约束:
  - concurrency.limit: 10
  - retries: 2
  - 每个 step.run 独立(支持续跑)
  - 单时辰失败不阻塞其他

完成贴 diff + typecheck 结果。
```

---

## Step C:触发 + 轮询 API

### 文件 1:`app/api/syncro/inngest_start/route.ts`(新建)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { 
  getSyncroStatus, 
  setSyncroStatus 
} from "@/lib/syncro/syncro-status-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StartBody {
  sessionId: string;
  hourOrder: string[];
  llmInputs: Record<string, any>;  // SyncroLlmHourInput per hour
}

export async function POST(req: NextRequest) {
  let body: StartBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  
  const { sessionId, hourOrder, llmInputs } = body;
  
  if (!sessionId || !hourOrder?.length || !llmInputs) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  
  // 检查是否已经在跑(避免重复触发)
  const existingStatus = await getSyncroStatus(sessionId);
  if (existingStatus && !existingStatus.done) {
    return NextResponse.json({
      success: true,
      already_running: true,
      status: existingStatus,
    });
  }
  
  // 初始化状态
  await setSyncroStatus(sessionId, {
    total: hourOrder.length,
    completed: 0,
    current_hour: hourOrder[0],
    failed_hours: [],
    hour_order: hourOrder,
    started_at: Date.now(),
    updated_at: Date.now(),
    done: false,
  });
  
  // 发 Inngest event
  await inngest.send({
    name: "syncro/generate.requested",
    data: { sessionId, hourOrder, llmInputs },
  });
  
  console.log(`[inngest_start] triggered ${sessionId}, ${hourOrder.length} hours`);
  
  return NextResponse.json({
    success: true,
    started: true,
    sessionId,
  });
}
```

### 文件 2:`app/api/syncro/inngest_status/route.ts`(新建)

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getSyncroStatus,
  getAllSyncroHours,
} from "@/lib/syncro/syncro-status-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sid");
  const includeHours = req.nextUrl.searchParams.get("include_hours") === "1";
  
  if (!sessionId) {
    return NextResponse.json({ error: "missing_sid" }, { status: 400 });
  }
  
  const status = await getSyncroStatus(sessionId);
  
  if (!status) {
    return NextResponse.json({ 
      status: null, 
      hours: {} 
    });
  }
  
  let hours: Record<string, any> = {};
  if (includeHours) {
    hours = await getAllSyncroHours(sessionId, status.hour_order);
  }
  
  return NextResponse.json({ 
    status, 
    hours 
  });
}
```

### 验证

```
1. typecheck
2. 手动 curl 测试:
   
   curl -X POST https://pojulife.com/api/syncro/inngest_start \
     -H "Content-Type: application/json" \
     -d '{ "sessionId": "test-xxx", "hourOrder": [...], "llmInputs": {...} }'
   
   → 应返回 { success: true, started: true }
   
   curl https://pojulife.com/api/syncro/inngest_status?sid=test-xxx&include_hours=1
   
   → 应返回 { status: {...}, hours: {...} }
```

### Cursor 指令(C)

```
任务:Step C - 触发 + 轮询 API

⛔ 严格只新建 2 个文件:
   - app/api/syncro/inngest_start/route.ts
   - app/api/syncro/inngest_status/route.ts
⛔ 不允许改任何现有文件
⛔ 不允许实现客户端 hook(那是 Step D)

代码见 roadmap 文档 Step C。

完成贴 diff + typecheck。
```

---

## Step D:客户端改造(最复杂)

### 文件 1:`lib/syncro/use-syncro-inngest-poll.ts`(新建)

```typescript
import { useEffect, useRef, useState } from "react";
import type { SyncroStatus, SyncroHourData } from "@/lib/syncro/syncro-status-kv";

export interface SyncroInngestPollState {
  status: SyncroStatus | null;
  hours: Record<string, SyncroHourData | null>;
  isPolling: boolean;
  error: string | null;
  lastUpdated: number;
}

export interface UseSyncroInngestPollOptions {
  enabled?: boolean;
  intervalMs?: number;
  includeHours?: boolean;
}

export function useSyncroInngestPoll(
  sessionId: string | null,
  options: UseSyncroInngestPollOptions = {}
): SyncroInngestPollState {
  const { 
    enabled = true, 
    intervalMs = 3000, 
    includeHours = true 
  } = options;
  
  const [state, setState] = useState<SyncroInngestPollState>({
    status: null,
    hours: {},
    isPolling: false,
    error: null,
    lastUpdated: 0,
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  
  useEffect(() => {
    if (!sessionId || !enabled) {
      return;
    }
    
    const poll = async () => {
      const abort = new AbortController();
      abortRef.current = abort;
      
      try {
        const url = `/api/syncro/inngest_status?sid=${sessionId}${includeHours ? "&include_hours=1" : ""}`;
        const res = await fetch(url, { signal: abort.signal });
        
        if (!res.ok) {
          throw new Error(`http_${res.status}`);
        }
        
        const data = await res.json();
        
        setState({
          status: data.status,
          hours: data.hours ?? {},
          isPolling: true,
          error: null,
          lastUpdated: Date.now(),
        });
        
        // 全部完成,停止轮询
        if (data.status?.done) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setState((s) => ({ ...s, isPolling: false }));
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    };
    
    // 立即 poll 一次
    setState((s) => ({ ...s, isPolling: true }));
    poll();
    
    // 定期 poll
    intervalRef.current = setInterval(poll, intervalMs);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [sessionId, enabled, intervalMs, includeHours]);
  
  return state;
}
```

### 文件 2:`SyncroResultPage.tsx`(改造)

```typescript
// 改造要点:
// 1. 启动时触发 inngest_start(只一次)
// 2. 使用 useSyncroInngestPoll 拉进度
// 3. 把 inngest hours 数据合并到 session.matrix
// 4. liveHourReady 改成读 inngest status
// 5. 删除现有 SyncroLlmBatchRunner 引用

const InngestStartedRef = useRef(false);

const { status: inngestStatus, hours: inngestHours } = useSyncroInngestPoll(
  sessionId,
  { enabled: !!session }
);

// 启动 Inngest 后台任务
useEffect(() => {
  if (!session || InngestStartedRef.current) return;
  if (inngestStatus && !inngestStatus.done) return;  // 已经在跑
  
  InngestStartedRef.current = true;
  
  const ctx = resolveSyncroLlmContext(session);
  const hourOrder = sortedHourPeriodsFromLive(livePeriod);
  
  // 为每个时辰构建 llmInput
  const llmInputs: Record<string, any> = {};
  for (const hourId of hourOrder) {
    llmInputs[hourId] = {
      session_id: sessionId,
      hour_id: hourId,
      hour_label: getHourLabel(hourId, locale),
      hour_range: HOUR_PERIOD_RANGES[hourId],
      cells: cellsForHourFromContext(ctx, hourId),
      task_description: session.task_description,
      profile_summary: ctx.profile_summary,
      locale,
    };
  }
  
  fetch("/api/syncro/inngest_start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      hourOrder,
      llmInputs,
    }),
  }).catch(e => console.error("[result-page] inngest_start failed:", e));
}, [session, sessionId, livePeriod, locale, inngestStatus]);

// 把 inngest hours 数据合并到 IDB
useEffect(() => {
  if (!inngestHours || !session) return;
  
  for (const [hourId, data] of Object.entries(inngestHours)) {
    if (!data) continue;
    // 检查是否已经合并过(避免重复 patch)
    if (isHourAlreadyInSession(session, hourId)) continue;
    
    patchSyncroSessionMatrix(sessionId, data.advice);
  }
}, [inngestHours, session, sessionId]);

// liveHourReady 判断:当前时辰是否在 KV 中已完成
const liveHourReady = (() => {
  if (!inngestStatus) return false;
  return !!inngestHours[livePeriod];
})();

return liveHourReady 
  ? <SyncroMainView session={session} ... /> 
  : <SyncroPreparingLiveHour 
      session={session}
      status={inngestStatus}
      hours={inngestHours}
    />;
```

### 文件 3:`SyncroPreparingLiveHour.tsx`(改造)

不再自己调 LLM(那是 Inngest 的事)
只显示进度和提示

```typescript
import { useSyncroInngestPoll } from "@/lib/syncro/use-syncro-inngest-poll";

// props 简化
type Props = {
  session: SyncroSession;
  livePeriod: HourPeriod;
  locale: string;
  // 删除:onComplete, onError(由 ResultPage 统管)
};

export function SyncroPreparingLiveHour({ session, livePeriod, locale }: Props) {
  const sessionId = useParams().id as string;
  const { status, hours } = useSyncroInngestPoll(sessionId);
  
  const isZh = locale.startsWith("zh");
  const currentHourLabel = getHourLabel(livePeriod, locale);
  const hourRange = HOUR_PERIOD_RANGES[livePeriod];
  
  return (
    <div className="syncro-preparing-live">
      <h2>{isZh ? "正在深度分析中..." : "Deep analysis in progress..."}</h2>
      
      <div className="current-hour-info">
        ◐ {isZh ? "当前时辰" : "Current"}: {currentHourLabel} ({hourRange})
      </div>
      
      <div className="progress-info">
        {isZh 
          ? `已完成 ${status?.completed ?? 0}/12 时辰`
          : `${status?.completed ?? 0}/12 hours completed`
        }
      </div>
      
      {status?.failed_hours && status.failed_hours.length > 0 && (
        <div className="failed-info">
          {isZh 
            ? `失败 ${status.failed_hours.length} 个时辰,系统将自动重试`
            : `${status.failed_hours.length} hours failed, retrying...`
          }
        </div>
      )}
      
      <div className="hint-text">
        {isZh 
          ? "准确分析需要时间,请耐心等待"
          : "Accurate analysis takes time, please be patient"
        }
      </div>
    </div>
  );
}
```

### 文件 4:`SyncroLlmBatchRunner.tsx`(废弃)

整个组件可以删除,或者改成空组件:

```typescript
// 整个文件可以删除
// SyncroResultPage 不再 import / render 它
// 所有 LLM 调用现在由 Inngest function 处理
```

### 关键变化

```
旧流程:
  ResultPage → PreparingLiveHour → 客户端调 stream_hour SSE
            → BatchRunner → 客户端调 stream_hour SSE × 11

新流程:
  ResultPage → 调 inngest_start(只 1 次)
            → 轮询 inngest_status
            → 渲染 PreparingLiveHour (显示) 或 MainView (显示)
            → Inngest 后台串行 12 时辰
            → 写 KV
            
没有:
  ✗ 客户端调 stream_hour
  ✗ SSE 流式 UI(改成轮询)
  ✗ BatchRunner
```

### 风险点

1. **客户端改动大**:多个组件改造,容易破坏现有 UI
2. **流式 UI 消失**:用户不再看到逐字浮现(轮询是离散更新)
3. **3 秒延迟**:轮询间隔 3 秒,UI 更新有延迟
4. **IDB 写入冲突**:Inngest 写 KV,客户端从 KV 同步到 IDB,要避免重复写

### Cursor 指令(D)

```
任务:Step D - 客户端改造(分 D-1 / D-2 / D-3 三小步)

⚠️ 风险高,必须分步做,每步独立验证

D-1:新建轮询 hook(纯新增,0 风险)
  ✓ 新建 lib/syncro/use-syncro-inngest-poll.ts
  ✓ 不接入任何组件
  ✓ typecheck 通过

D-2:SyncroResultPage 改造(中风险)
  ✓ 改 components/syncro/SyncroResultPage.tsx
  ✓ 启动 Inngest + 轮询 + 合并到 IDB
  ✓ 暂时保留 SyncroLlmBatchRunner(让两套并行,Inngest 主跑)
  ✓ 真机测试一次

D-3:SyncroPreparingLiveHour 改造 + 废弃 BatchRunner(中风险)
  ✓ 改等待页只显示进度
  ✓ 删除 BatchRunner 引用
  ✓ 真机测试,确认完全靠 Inngest

每步给我看 diff,确认通过再下一步。
```

---

## Step E:测试 + 上线

### 测试场景

```
场景 1:正常流程
  - 进入 Syncro
  - inngest_start 触发
  - 等待页显示"0/12 → 1/12 → 2/12 ..."
  - 第一个时辰完成 → 进罗盘页
  - 后续 11 个时辰逐个完成 → 时辰条逐个亮起

场景 2:用户离开
  - 进入 Syncro,等到 3/12
  - 关闭浏览器
  - 等 5 分钟
  - 重开,直接进 Syncro
  - 应该看到 8/12 或更高(Inngest 一直在跑)
  - 已完成的时辰内容直接显示

场景 3:网络断开
  - 进入 Syncro
  - 拔网络
  - 服务端 Inngest 继续跑
  - 客户端轮询失败,显示 error
  - 重连网络
  - 轮询恢复,看到真实进度

场景 4:单个时辰失败
  - 某个时辰 LLM 失败
  - failed_hours 中标记
  - 其他时辰继续
  - 用户看到 11/12 + "1 个失败,可重试"
  - 点击重试 → 重新触发该时辰

场景 5:全部失败
  - 模拟 OpenRouter 全挂
  - 12 个时辰全 fail
  - 显示错误页 + "重试全部" 按钮

场景 6:并发多 session
  - 同一用户开 2 个 tab,跑同一 sessionId
  - inngest_start 第二次返回 already_running
  - 两个 tab 都拉同一进度
```

### 上线检查清单

```
环境变量(Vercel):
  ✓ OPENROUTER_API_KEY
  ✓ INNGEST_EVENT_KEY
  ✓ INNGEST_SIGNING_KEY
  ✓ KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN(Upstash)

Inngest Dashboard:
  ✓ App 状态 enabled
  ✓ Serve URL: https://pojulife.com/api/inngest
  ✓ Function "syncro-generate-all-hours" 注册
  ✓ Concurrency 配置(初始 10)

KV/Upstash:
  ✓ 检查容量(每 session ~50KB,够用)
  ✓ TTL 24h 设置正确
  ✓ 监控读写次数

错误监控:
  ✓ Vercel logs 配置
  ✓ Inngest 失败告警(发邮件?)
  ✓ 客户端错误上报(可选 Sentry)

文档:
  ✓ README 更新架构图
  ✓ 内部维护文档
```

### 上线后监控点

```
关键指标:
  1. inngest_start 调用成功率(>99%)
  2. inngest function 平均执行时间(20-40 分钟/session)
  3. 单时辰失败率(<5%)
  4. 全 session 完成率(>95%)
  5. 用户首次进罗盘时间(<3 分钟)
  6. 轮询 API 平均响应时间(<200ms)
  
费用:
  - Vercel:Hobby 4 GB-hours/月 → 100 sessions ≈ 8 GB-hours,会超
    考虑升 Pro $20/月
  - Inngest 免费 tier 50k events/月 → 4000 sessions
  - OpenRouter:每 session ~$0.10(V4 Pro)
  - Upstash:免费 tier 10k commands/天 → 100 sessions/天
```

---

## 附录 A:客户端调试日志(用于 B-2 诊断)

Cursor 指令(可选,加日志不改业务):

```
任务:在客户端关键路径加 console.log

修改 3 个文件,只加日志:

1. lib/syncro/streaming-runner.ts:
   - SSE complete event 收到时:
     console.log(`[streaming-runner] complete received, advice keys=${Object.keys(advice).length}, fromCache=${fromCache}`)
   - SSE error 收到时:
     console.error(`[streaming-runner] error event:`, errorPayload)

2. components/syncro/SyncroPreparingLiveHour.tsx:
   - onComplete callback 执行时:
     console.log(`[preparing-live] onComplete fired, will patch IDB, keys=${Object.keys(advice).length}`)
   - patchSyncroSessionMatrix 之后:
     console.log(`[preparing-live] IDB patched successfully`)
   - dispatchSyncroMatrixPatch 之后:
     console.log(`[preparing-live] dispatched matrix patch event`)
   - 任何错误:
     console.error(`[preparing-live] error:`, error)

3. components/syncro/SyncroLlmBatchRunner.tsx:
   - 组件 mount 时:
     console.log(`[BatchRunner] mounted, hourSequence=${JSON.stringify(hourSequence)}`)
   - 每个 hour 处理时:
     console.log(`[BatchRunner] processing ${hourId}, currentHour=${currentHourId}`)
   - 每个 hour 跳过时:
     console.log(`[BatchRunner] skip ${hourId}: reason=${reason}`)
   - 每个 hour 完成时:
     console.log(`[BatchRunner] ${hourId} done, progress=${completed}/${total}`)
   - 失败时:
     console.error(`[BatchRunner] ${hourId} failed:`, error)

不改业务,只加日志。typecheck 通过。
```

---

## 附录 B:回滚方案

如果新 Inngest 架构上线后有问题,可以回滚:

```
回滚步骤(5 分钟):

1. SyncroResultPage:
   - 注释掉 inngest_start 触发逻辑
   - 注释掉 useSyncroInngestPoll 调用
   - 恢复 SyncroLlmBatchRunner 渲染
   
2. SyncroPreparingLiveHour:
   - 恢复 runStreamHourWithRetry 调用(B-2 的逻辑)
   
3. Inngest function 留着不动(没人调用就不会跑)

4. 重新部署
   
回滚后行为:
  - 跟现在(Step B-2)一样
  - 完全不依赖 Inngest
  - 客户端直接调 stream_hour
```

---

## 附录 C:常见问题排查

### Inngest 跑了但 KV 没数据

```
原因可能:
  1. Inngest function 没注册(检查 /api/inngest 返回)
  2. KV 写入失败(检查 KV utility 日志)
  3. generateSyncroHourAdvice 抛错被吞了

排查:
  - Inngest Dashboard → Function Runs → 看具体 run 日志
  - 看每个 step 的状态
```

### 客户端轮询拿不到数据

```
原因可能:
  1. sessionId 不一致(客户端用 A,Inngest 用 B)
  2. KV TTL 已过(24h 后)
  3. inngest_status API 错误

排查:
  - Network tab 看 inngest_status 请求 / 响应
  - 直接 curl 测 API
```

### 进度卡住不动

```
原因可能:
  1. Inngest function 没启动(没收到 event)
  2. 某个 step 一直 retry 中
  3. concurrency limit 排队中

排查:
  - Inngest Dashboard → Events → 看 syncro/generate.requested 是否到达
  - Function Runs → 看是否有 pending 状态
```

---

## 时间估算

```
已完成:
  Step A:Inngest 基础设施      30 分钟
  Step B-1:KV 状态层          1 小时

进行中:
  Step B-2:LLM 核心提取(含调试)  2-4 小时

未完成:
  Step B-3:Inngest function   1-2 小时
  Step C:触发 + 轮询 API       1 小时
  Step D-1:轮询 hook          30 分钟
  Step D-2:ResultPage 改造     2 小时
  Step D-3:Preparing + 废弃   1 小时
  Step E:测试 + 上线          1 天

总计:5-7 天工作量(包括调试和测试)
```

---

## 一句话总结

```
当前在 Step B-2,有 bug(客户端 0/12)
按此 roadmap 继续:
  1. 修 B-2 → 让现有 SSE 路径完全 work
  2. B-3 → C → D → E 把 Inngest 接进来

所有 Cursor 指令模板都在文档里,你可以自己慢慢推进
```
