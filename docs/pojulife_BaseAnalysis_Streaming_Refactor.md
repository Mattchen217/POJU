# pojulife base_analysis 流式架构改造

> **目标**:彻底解决 base_analysis 超时失败问题
> 
> **核心策略**:从【单次长 HTTP 请求】改为【流式 SSE + KV 持久化】
>
> **同时实现**:
> - 实时显示真实输出(替代假提示)
> - 断线重连保护(KV 累积)
> - 输出语言跟随 locale
> - 本地计算可调试日志
>
> **前置(用户已完成)**:
> - Vercel KV(Upstash Redis)已配置
> - 环境变量 KV_URL / KV_REST_API_TOKEN / KV_REST_API_URL 已设置
> - `@upstash/redis` 已安装
> - OpenRouter DeepSeek V4 Pro 支持 stream: true 已确认
>
> **执行原则**:严格【一步一停】,每个 Step 完成后等用户确认

---

# ⚠️ Cursor 必读

```
为什么要这么做(背景):

当前架构问题:
  ✗ 客户端 fetch → 等 4-5 分钟 → 一次性返回
  ✗ 4-5 分钟"静默期" → iOS PWA 必然超时
  ✗ 超时 = 客户端 abort = 响应丢失 = 结果未保存
  ✗ 之前的"降配置/精简 prompt"是治标,不是治本

新架构(根本解决):
  ✓ 客户端 fetch SSE → 流式接收
  ✓ LLM 输出每个 chunk → 立刻推送 + 累积存 KV
  ✓ 连接持续有数据流动 → 不会被掐断
  ✓ 客户端断线 → 重连从 KV 拉
  ✓ Vercel 函数即使被终止,KV 已经存了大部分内容

关键设计:
  1. LLM 输出格式:markdown 叙述 + 末尾 ---META--- JSON
     (流式显示 markdown,最后 parse JSON 元信息)
  2. 不显示 LLM 的 reasoning_content(可能含违禁词)
     只显示 content(经 prompt 约束,安全)
  3. 输出语言用客户端 locale 参数,跟出生地无关

绝对不要做:
  ✗ 不要在同一请求内重试第二次 LLM
  ✗ 不要显示 LLM 的 thinking/reasoning(品牌风险)
  ✗ 不要用出生地决定输出语言
  ✗ 不要保留原有 280s abort 逻辑
```

---

# 第 1 部分:Step 1 - KV 客户端 + Job 数据结构

## Step 1.1: KV 客户端封装

文件:`lib/kv/client.ts`(新建)

```typescript
import { Redis } from '@upstash/redis';

export const kv = Redis.fromEnv();

export const KV_TTL = {
  BASE_ANALYSIS_JOB: 60 * 60 * 2,      // 2 小时(完成后保留,方便重连)
  BASE_ANALYSIS_LOCK: 60 * 5,           // 5 分钟(去重锁)
};
```

## Step 1.2: Job 数据结构

文件:`lib/base-analysis/job-types.ts`(新建)

```typescript
export type BaseAnalysisJobStatus = 
  | 'pending'      // 刚创建,尚未开始
  | 'streaming'    // LLM 流式生成中
  | 'completed'    // 完成
  | 'failed';      // 失败

export interface BaseAnalysisJob {
  job_id: string;
  profile_id: string;
  locale: string;
  
  status: BaseAnalysisJobStatus;
  
  // 流式累积内容(LLM content 部分,markdown)
  accumulated_content: string;
  
  // 完成后的元信息(从 ---META--- 后面 parse)
  meta?: {
    day_master_element?: string;
    favorable_elements?: string[];
    unfavorable_elements?: string[];
    [key: string]: any;
  };
  
  // 错误信息
  error?: string;
  error_detail?: string;
  
  // 时间戳
  created_at: number;
  updated_at: number;
  completed_at?: number;
  
  // 本地计算数据(从客户端传入,用于注入 prompt)
  local_data: {
    four_pillars: any;        // 年月日时四柱
    true_solar_time: any;     // 真太阳时元数据
    yong_shen: string;        // 用神
    profile_basics: any;      // 出生信息
  };
}

export function generateJobId(profile_id: string): string {
  return `ba_${profile_id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function jobKey(job_id: string): string {
  return `base-analysis:job:${job_id}`;
}

export function profileLockKey(profile_id: string): string {
  return `base-analysis:lock:${profile_id}`;
}

export function profileLatestKey(profile_id: string): string {
  return `base-analysis:latest:${profile_id}`;
}
```

## Step 1.3: Job 操作工具函数

文件:`lib/base-analysis/job-store.ts`(新建)

```typescript
import { kv, KV_TTL } from '@/lib/kv/client';
import { 
  BaseAnalysisJob, 
  BaseAnalysisJobStatus,
  jobKey, 
  profileLockKey,
  profileLatestKey,
  generateJobId 
} from './job-types';

/**
 * 创建新 job
 */
export async function createJob(input: {
  profile_id: string;
  locale: string;
  local_data: any;
}): Promise<BaseAnalysisJob> {
  const job: BaseAnalysisJob = {
    job_id: generateJobId(input.profile_id),
    profile_id: input.profile_id,
    locale: input.locale,
    status: 'pending',
    accumulated_content: '',
    local_data: input.local_data,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  
  await kv.set(jobKey(job.job_id), job, { ex: KV_TTL.BASE_ANALYSIS_JOB });
  await kv.set(profileLatestKey(input.profile_id), job.job_id, { 
    ex: KV_TTL.BASE_ANALYSIS_JOB 
  });
  
  return job;
}

/**
 * 获取 job
 */
export async function getJob(job_id: string): Promise<BaseAnalysisJob | null> {
  const data = await kv.get<BaseAnalysisJob>(jobKey(job_id));
  return data || null;
}

/**
 * 查找 profile 最近的 job(用于重连)
 */
export async function findLatestJobForProfile(
  profile_id: string
): Promise<BaseAnalysisJob | null> {
  const job_id = await kv.get<string>(profileLatestKey(profile_id));
  if (!job_id) return null;
  return getJob(job_id);
}

/**
 * 更新 job 状态(增量,不覆盖)
 */
export async function updateJobStatus(
  job_id: string,
  status: BaseAnalysisJobStatus,
  patch: Partial<BaseAnalysisJob> = {}
): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;
  
  const updated: BaseAnalysisJob = {
    ...job,
    ...patch,
    status,
    updated_at: Date.now(),
    ...(status === 'completed' ? { completed_at: Date.now() } : {})
  };
  
  await kv.set(jobKey(job_id), updated, { ex: KV_TTL.BASE_ANALYSIS_JOB });
}

/**
 * 追加 chunk 到累积内容
 * (高频调用,优化)
 */
export async function appendChunk(
  job_id: string,
  chunk: string
): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;
  
  job.accumulated_content += chunk;
  job.updated_at = Date.now();
  
  // 不改 status(保持 streaming)
  await kv.set(jobKey(job_id), job, { ex: KV_TTL.BASE_ANALYSIS_JOB });
}

/**
 * 标记完成 + 写入 meta
 */
export async function finalizeJob(
  job_id: string,
  meta: any
): Promise<void> {
  await updateJobStatus(job_id, 'completed', { meta });
}

/**
 * 标记失败
 */
export async function failJob(
  job_id: string,
  error: string,
  detail?: string
): Promise<void> {
  await updateJobStatus(job_id, 'failed', { 
    error, 
    error_detail: detail 
  });
}

/**
 * 加锁(去重:同 profile 防止并发 job)
 */
export async function acquireLock(profile_id: string): Promise<boolean> {
  const result = await kv.set(
    profileLockKey(profile_id),
    Date.now(),
    { ex: KV_TTL.BASE_ANALYSIS_LOCK, nx: true }
  );
  return result === 'OK';
}

export async function releaseLock(profile_id: string): Promise<void> {
  await kv.del(profileLockKey(profile_id));
}
```

## 验证清单 - Step 1

```
□ lib/kv/client.ts 创建,导出 kv 实例
□ 测试连接:在任意 API route 中 await kv.set('test', 'hello'),
  确认无报错
□ lib/base-analysis/job-types.ts 完整
□ lib/base-analysis/job-store.ts 8 个函数全部实现
□ TypeScript 编译通过

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 服务端流式 API(SSE)

## Step 2.1: Prompt builder(支持 locale)

文件:`lib/llm/prompts/base-analysis-stream-prompt.ts`(新建)

```typescript
interface PromptInput {
  locale: string;
  local_data: {
    four_pillars: any;
    true_solar_time: any;
    yong_shen: string;
    profile_basics: any;
  };
}

const LANG_INSTRUCTIONS: Record<string, string> = {
  'en': 'Output the entire analysis in English. Use natural, professional English.',
  'zh': '请用简体中文输出全部分析内容。语言自然、专业、现代。',
  'es': 'Output the entire analysis in Spanish.',
  'fr': 'Output the entire analysis in French.',
  'de': 'Output the entire analysis in German.',
};

export function buildBaseAnalysisStreamPrompt(input: PromptInput): {
  system: string;
  user: string;
} {
  const langInstruction = LANG_INSTRUCTIONS[input.locale] || LANG_INSTRUCTIONS['en'];
  
  const system = `You are a professional reader for pojulife — a digital self-reflection and personal-guidance platform based on Eastern philosophy frameworks.

Your task: Read the provided birth chart data and produce a clear, modern, professional analysis report.

# Output Format(IMPORTANT)

Output in this exact structure:

1. **First**, a markdown analysis report with these sections:
   - Day Master Overview
   - Five Elements Balance
   - Strengths & Tendencies
   - Areas to Watch
   - Life Phase / Current Cycle
   - Career & Direction
   - Relationship Patterns

2. **Then** a separator line: \`---META---\`

3. **Finally** a JSON metadata block(only structural fields, not narrative):

\`\`\`json
{
  "day_master_element": "yi_wood" | "jia_wood" | "bing_fire" | ...,
  "favorable_elements": ["water", "wood"],
  "unfavorable_elements": ["metal"],
  "current_phase_name": "...",
  "key_strengths": ["...", "..."],
  "key_challenges": ["...", "..."]
}
\`\`\`

# Language

${langInstruction}

# Critical Language Rules(strictly enforced)

DO NOT use these words anywhere in your output:
- English: astrology, divination, fortune-telling, oracle, psychic, horoscope, tarot, mystic, predict (when referring to fate), destiny, fate
- 中文: 占星术、占卜、算命、命理学、抽签、卜卦、神算、预测命运、风水

USE these instead:
- pojulife / POJU / Glyph / Syncro / Match (brand and tool names)
- reading / analysis / reflection / insight / guidance
- 解读 / 分析 / 反思 / 洞察 / 指引

Reason: pojulife is a modern self-reflection tool for global users, not a fortune-telling product.

# Style

- Modern, professional, conversational
- Avoid jargon; explain Eastern concepts in modern terms
- 200-400 words per section
- Total analysis: 1500-2500 words
- Direct address ("you" / "你"), no third-person

# Boundaries

- This is reflective guidance, not prediction
- No medical / financial / legal advice
- No guaranteed outcomes`;
  
  const user = `Here is the birth chart data(already computed using true solar time):

\`\`\`json
${JSON.stringify(input.local_data, null, 2)}
\`\`\`

Please produce the analysis report following the output format above. Stream your response.`;
  
  return { system, user };
}
```

## Step 2.2: OpenRouter Streaming 调用器

文件:`lib/llm/openrouter-stream.ts`(新建)

```typescript
interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

interface StreamInput {
  system: string;
  user: string;
  model?: string;
  signal?: AbortSignal;
  onChunk: (chunk: string) => Promise<void> | void;
  onDone: () => Promise<void> | void;
  onError: (error: string) => Promise<void> | void;
}

export async function openRouterStream(input: StreamInput): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  
  const model = input.model || 'deepseek/deepseek-chat-v3.1';
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://pojulife.com',
      'X-Title': 'Pojulife'
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 8000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user }
      ]
    }),
    signal: input.signal
  });
  
  if (!response.ok) {
    const errText = await response.text();
    await input.onError(`OpenRouter ${response.status}: ${errText}`);
    return;
  }
  
  if (!response.body) {
    await input.onError('Response body is null');
    return;
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // SSE 格式:每条消息以 \n\n 分隔
      const lines = buffer.split('\n');
      // 保留最后一行(可能不完整)
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          await input.onDone();
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          
          // ⚠️ 只取 content,不取 reasoning_content(避免暴露 thinking)
          const content = delta?.content;
          if (content) {
            await input.onChunk(content);
          }
        } catch (e) {
          // 单条解析失败,跳过
          console.warn('[stream] parse chunk failed:', data.slice(0, 100));
        }
      }
    }
    
    await input.onDone();
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.log('[stream] aborted');
      return;
    }
    await input.onError(e.message || 'Stream error');
  } finally {
    reader.releaseLock();
  }
}
```

## Step 2.3: SSE 流式 API Route

文件:`app/api/profile/base-analysis/stream/route.ts`(新建,替代旧的 base-analysis/route.ts)

```typescript
import { NextRequest } from 'next/server';
import { openRouterStream } from '@/lib/llm/openrouter-stream';
import { buildBaseAnalysisStreamPrompt } from '@/lib/llm/prompts/base-analysis-stream-prompt';
import {
  createJob,
  getJob,
  findLatestJobForProfile,
  appendChunk,
  finalizeJob,
  failJob,
  updateJobStatus,
  acquireLock,
  releaseLock
} from '@/lib/base-analysis/job-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RequestBody {
  profile_id: string;
  locale: string;
  local_data: any;
  resume_job_id?: string;  // 断线重连时传入
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  
  if (!body.profile_id || !body.locale || !body.local_data) {
    return new Response('Missing required fields', { status: 400 });
  }
  
  console.log('[base-analysis/stream] request:', {
    profile_id: body.profile_id,
    locale: body.locale,
    has_resume_id: !!body.resume_job_id,
    local_data_preview: {
      four_pillars: body.local_data.four_pillars,
      true_solar_time: body.local_data.true_solar_time,
      yong_shen: body.local_data.yong_shen
    }
  });
  
  // 1. 处理 resume(断线重连)
  let job: any;
  let isResume = false;
  
  if (body.resume_job_id) {
    job = await getJob(body.resume_job_id);
    if (job && job.profile_id === body.profile_id) {
      isResume = true;
      console.log(`[base-analysis/stream] resuming job ${job.job_id}, status=${job.status}`);
    }
  }
  
  // 2. 如果没指定 resume,查找该 profile 最近的活跃 job
  if (!job) {
    const latest = await findLatestJobForProfile(body.profile_id);
    if (latest && (latest.status === 'streaming' || latest.status === 'completed')) {
      // 自动 resume(用户可能不知道有旧 job)
      job = latest;
      isResume = true;
      console.log(`[base-analysis/stream] auto-resuming job ${job.job_id}, status=${job.status}`);
    }
  }
  
  // 3. 如果不是 resume,创建新 job
  if (!job) {
    // 加锁防并发
    const locked = await acquireLock(body.profile_id);
    if (!locked) {
      return new Response('Another analysis is in progress', { status: 409 });
    }
    
    try {
      job = await createJob({
        profile_id: body.profile_id,
        locale: body.locale,
        local_data: body.local_data
      });
      console.log(`[base-analysis/stream] created new job ${job.job_id}`);
    } catch (e: any) {
      await releaseLock(body.profile_id);
      return new Response(`Create job failed: ${e.message}`, { status: 500 });
    }
  }
  
  // 4. 构建 SSE 流
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: any) {
        try {
          const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (e) {
          // controller 已关闭,忽略
        }
      }
      
      try {
        // === 情况 A: job 已完成,直接返回完整内容 ===
        if (job.status === 'completed') {
          send('resumed', {
            job_id: job.job_id,
            from_kv: true,
            accumulated: job.accumulated_content,
            meta: job.meta
          });
          send('done', { job_id: job.job_id });
          controller.close();
          return;
        }
        
        // === 情况 B: job 在 streaming 中(可能另一个连接还在跑)===
        // 简化策略:推送已有累积内容,然后告诉客户端"已重新连接,继续轮询 KV"
        // (避免双重 LLM 调用)
        if (job.status === 'streaming') {
          send('resumed_partial', {
            job_id: job.job_id,
            accumulated: job.accumulated_content,
            poll_only: true  // 客户端切换到 polling 模式
          });
          controller.close();
          return;
        }
        
        // === 情况 C: 新 job 或 failed job,启动 LLM streaming ===
        send('start', { job_id: job.job_id });
        
        // 标记 streaming
        await updateJobStatus(job.job_id, 'streaming');
        
        // 构建 prompt
        const { system, user } = buildBaseAnalysisStreamPrompt({
          locale: body.locale,
          local_data: body.local_data
        });
        
        // 调用 OpenRouter streaming
        await openRouterStream({
          system,
          user,
          model: 'deepseek/deepseek-v4-pro',
          
          onChunk: async (chunk: string) => {
            // 推送给客户端
            send('chunk', { text: chunk });
            
            // 累积到 KV(异步,不阻塞)
            try {
              await appendChunk(job.job_id, chunk);
            } catch (e) {
              console.error('[base-analysis/stream] KV append failed:', e);
            }
          },
          
          onDone: async () => {
            // 重新拿到完整累积内容
            const finalJob = await getJob(job.job_id);
            if (!finalJob) return;
            
            const fullContent = finalJob.accumulated_content;
            
            // 提取 ---META--- 后面的 JSON
            const meta = extractMeta(fullContent);
            
            // 标记完成
            await finalizeJob(job.job_id, meta);
            
            // 推送完成
            send('done', {
              job_id: job.job_id,
              meta,
              final_length: fullContent.length
            });
            
            console.log(`[base-analysis/stream] completed ${job.job_id}, length=${fullContent.length}`);
          },
          
          onError: async (error: string) => {
            await failJob(job.job_id, 'llm_error', error);
            send('error', { error });
            console.error(`[base-analysis/stream] failed ${job.job_id}: ${error}`);
          }
        });
        
      } catch (e: any) {
        console.error('[base-analysis/stream] outer error:', e);
        await failJob(job.job_id, 'stream_error', e.message);
        send('error', { error: e.message });
      } finally {
        await releaseLock(body.profile_id).catch(() => {});
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

/**
 * 从完整文本中提取 ---META--- 后的 JSON
 */
function extractMeta(fullContent: string): any {
  const idx = fullContent.lastIndexOf('---META---');
  if (idx === -1) return {};
  
  const after = fullContent.slice(idx + '---META---'.length).trim();
  
  // 找 JSON 块(可能有 ```json ... ``` 包裹)
  let jsonStr = after;
  const codeBlockMatch = after.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }
  
  try {
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    console.warn('[base-analysis/stream] meta parse failed:', e);
    return {};
  }
}
```

## Step 2.4: KV 状态查询 API(polling 用)

文件:`app/api/profile/base-analysis/status/route.ts`(新建)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/base-analysis/job-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get('job_id');
  
  if (!job_id) {
    return NextResponse.json({ error: 'missing job_id' }, { status: 400 });
  }
  
  const job = await getJob(job_id);
  if (!job) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    job_id: job.job_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
    meta: job.meta,
    error: job.error,
    updated_at: job.updated_at
  });
}
```

## 验证清单 - Step 2

```
□ buildBaseAnalysisStreamPrompt 完整
□ openRouterStream 函数完整(只取 content,不取 reasoning_content)
□ /api/profile/base-analysis/stream/route.ts 创建
□ /api/profile/base-analysis/status/route.ts 创建
□ TypeScript 通过
□ 在本地用 curl 测试 SSE 流(可选):
  curl -N -X POST http://localhost:3000/api/profile/base-analysis/stream \
    -H "Content-Type: application/json" \
    -d '{"profile_id":"test","locale":"en","local_data":{...}}'
  应该看到流式输出

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 客户端 SSE 接收 + UI

## Step 3.1: 客户端 SSE 接收 Hook

文件:`lib/base-analysis/useStreamingAnalysis.ts`(新建)

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseStreamingAnalysisOptions {
  profile_id: string;
  locale: string;
  local_data: any;
  resume_job_id?: string;
  
  onComplete: (content: string, meta: any) => void;
  onError: (error: string) => void;
}

interface StreamingState {
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  content: string;
  job_id: string | null;
  error: string | null;
  bytes_received: number;
}

export function useStreamingAnalysis(opts: UseStreamingAnalysisOptions) {
  const [state, setState] = useState<StreamingState>({
    status: 'idle',
    content: '',
    job_id: null,
    error: null,
    bytes_received: 0
  });
  
  const abortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<any>(null);
  
  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);
  
  // Polling fallback(当服务端告诉客户端"已有 stream 在跑,你只能 poll")
  const startPolling = useCallback((job_id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    const poll = async () => {
      try {
        const res = await fetch(`/api/profile/base-analysis/status?job_id=${job_id}`);
        if (!res.ok) return;
        const data = await res.json();
        
        setState(prev => ({
          ...prev,
          content: data.accumulated_content || prev.content,
          bytes_received: (data.accumulated_content || '').length
        }));
        
        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          
          setState(prev => ({
            ...prev,
            status: 'completed',
            content: data.accumulated_content
          }));
          
          opts.onComplete(data.accumulated_content, data.meta);
        } else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          
          setState(prev => ({ ...prev, status: 'failed', error: data.error }));
          opts.onError(data.error || 'unknown error');
        }
      } catch (e: any) {
        console.warn('[polling] error:', e);
      }
    };
    
    poll();  // 立即调一次
    pollIntervalRef.current = setInterval(poll, 3000);  // 每 3 秒
  }, [opts]);
  
  const start = useCallback(async () => {
    stop();
    
    setState({
      status: 'connecting',
      content: '',
      job_id: null,
      error: null,
      bytes_received: 0
    });
    
    const abort = new AbortController();
    abortRef.current = abort;
    
    try {
      const res = await fetch('/api/profile/base-analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: opts.profile_id,
          locale: opts.locale,
          local_data: opts.local_data,
          resume_job_id: opts.resume_job_id
        }),
        signal: abort.signal
      });
      
      if (!res.ok) {
        const errText = await res.text();
        setState({
          status: 'failed',
          content: '',
          job_id: null,
          error: `${res.status}: ${errText}`,
          bytes_received: 0
        });
        opts.onError(`${res.status}: ${errText}`);
        return;
      }
      
      if (!res.body) {
        setState(prev => ({ ...prev, status: 'failed', error: 'no body' }));
        opts.onError('no response body');
        return;
      }
      
      setState(prev => ({ ...prev, status: 'streaming' }));
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentJobId: string | null = null;
      let accumulatedContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                currentJobId = data.job_id;
                setState(prev => ({ ...prev, job_id: data.job_id }));
                break;
              
              case 'chunk':
                accumulatedContent += data.text;
                setState(prev => ({
                  ...prev,
                  content: prev.content + data.text,
                  bytes_received: prev.bytes_received + data.text.length
                }));
                break;
              
              case 'resumed':
                // 服务端发现已完成
                accumulatedContent = data.accumulated;
                currentJobId = data.job_id;
                setState({
                  status: 'completed',
                  content: data.accumulated,
                  job_id: data.job_id,
                  error: null,
                  bytes_received: data.accumulated.length
                });
                opts.onComplete(data.accumulated, data.meta);
                return;
              
              case 'resumed_partial':
                // 服务端已经在跑,客户端只能 poll
                currentJobId = data.job_id;
                accumulatedContent = data.accumulated || '';
                setState({
                  status: 'streaming',
                  content: data.accumulated || '',
                  job_id: data.job_id,
                  error: null,
                  bytes_received: (data.accumulated || '').length
                });
                if (data.poll_only) {
                  // 切换到 polling 模式
                  startPolling(data.job_id);
                  return;
                }
                break;
              
              case 'done':
                setState(prev => ({
                  ...prev,
                  status: 'completed'
                }));
                opts.onComplete(accumulatedContent, data.meta || {});
                return;
              
              case 'error':
                setState(prev => ({
                  ...prev,
                  status: 'failed',
                  error: data.error
                }));
                opts.onError(data.error);
                return;
            }
          } catch (e) {
            console.warn('[stream parse]', e, line.slice(0, 100));
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[useStreamingAnalysis] aborted by user');
        return;
      }
      
      // 网络断开 → 自动 resume(用 job_id)
      if (state.job_id) {
        console.log('[useStreamingAnalysis] connection broken, will resume on next mount');
        startPolling(state.job_id);
        return;
      }
      
      setState(prev => ({ ...prev, status: 'failed', error: e.message }));
      opts.onError(e.message);
    }
  }, [opts, stop, startPolling, state.job_id]);
  
  // 组件卸载清理
  useEffect(() => {
    return () => stop();
  }, [stop]);
  
  return { state, start, stop };
}
```

## Step 3.2: 流式 UI 组件(替代假提示动效)

文件:`components/poju/StreamingAnalysisView.tsx`(新建)

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  content: string;
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  bytes_received: number;
}

export function StreamingAnalysisView({ content, status, bytes_received }: Props) {
  const t = useTranslations('analysis_loader');
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);
  
  // 过滤掉 ---META--- 之后的内容(不给用户看 JSON)
  const visibleContent = stripMetaSection(content);
  
  return (
    <div className="streaming-analysis">
      {/* 状态指示 */}
      <div className="status-line">
        {status === 'connecting' && (
          <>
            <span className="status-dot connecting" />
            <span>{t('connecting')}</span>
          </>
        )}
        {status === 'streaming' && (
          <>
            <span className="status-dot streaming" />
            <span>{t('reading_chart')}</span>
            <span className="bytes">· {bytes_received} chars</span>
          </>
        )}
        {status === 'completed' && (
          <>
            <span className="status-dot done" />
            <span>{t('complete')}</span>
          </>
        )}
      </div>
      
      {/* 流式内容 */}
      <div 
        ref={contentRef}
        className="streaming-content"
      >
        {visibleContent ? (
          <>
            <pre className="content-text">{visibleContent}</pre>
            {status === 'streaming' && <span className="cursor">▊</span>}
          </>
        ) : (
          <div className="placeholder">
            {t('warming_up')}
          </div>
        )}
      </div>
      
      {/* 提示 */}
      {status === 'streaming' && (
        <div className="bottom-hint">
          {t('keep_screen_on')}
        </div>
      )}
    </div>
  );
}

function stripMetaSection(content: string): string {
  const idx = content.lastIndexOf('---META---');
  return idx === -1 ? content : content.slice(0, idx).trim();
}
```

## Step 3.3: 样式(无边框,Apple 极简)

文件:`styles/streaming-analysis.css`(新建)

```css
.streaming-analysis {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 20px;
  font-family: var(--pj-font-sans);
}

/* === 状态行 === */
.status-line {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  letter-spacing: 0.3px;
  margin-bottom: 18px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.connecting {
  background: var(--pj-text-tertiary);
  animation: pulse 1.2s infinite ease-in-out;
}

.status-dot.streaming {
  background: var(--pj-gold);
  box-shadow: 0 0 8px var(--pj-gold-glow);
  animation: pulse 1.2s infinite ease-in-out;
}

.status-dot.done {
  background: var(--pj-following);
}

.bytes {
  margin-left: auto;
  color: var(--pj-text-muted);
  font-size: 10px;
  font-family: var(--pj-font-mono);
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* === 内容区(关键!)=== */
.streaming-content {
  flex: 1;
  background: var(--pj-bg-card);
  border-radius: var(--pj-radius-lg);
  padding: 20px 18px;
  overflow-y: auto;
  max-height: 60vh;
  
  /* 平滑滚动 */
  scroll-behavior: smooth;
  
  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.streaming-content::-webkit-scrollbar {
  width: 4px;
}

.streaming-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.content-text {
  font-family: var(--pj-font-sans);
  font-size: var(--pj-text-sm);
  line-height: var(--pj-leading-relaxed);
  color: var(--pj-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  
  /* 优雅的字间距 */
  letter-spacing: 0.1px;
}

.cursor {
  display: inline-block;
  color: var(--pj-gold);
  font-weight: var(--pj-weight-medium);
  margin-left: 2px;
  animation: blink 1s infinite step-end;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.placeholder {
  color: var(--pj-text-muted);
  font-size: var(--pj-text-sm);
  text-align: center;
  padding: 40px 0;
  font-style: italic;
}

/* === 底部提示 === */
.bottom-hint {
  margin-top: 14px;
  text-align: center;
  font-size: 10px;
  color: var(--pj-text-muted);
  letter-spacing: 0.5px;
}
```

## Step 3.4: 翻译

文件:`messages/en/analysis_loader.json`(更新)

```json
{
  "analysis_loader": {
    "connecting": "Connecting…",
    "reading_chart": "Reading your chart",
    "complete": "Reading complete",
    "warming_up": "Warming up…",
    "keep_screen_on": "Please keep this screen on while the reading is being prepared"
  }
}
```

文件:`messages/zh/analysis_loader.json`

```json
{
  "analysis_loader": {
    "connecting": "正在连接…",
    "reading_chart": "正在解读你的命盘",
    "complete": "解读完成",
    "warming_up": "准备中…",
    "keep_screen_on": "解读期间请保持此页面在前台"
  }
}
```

## 验证清单 - Step 3

```
□ useStreamingAnalysis hook 完整(start / stop / 自动 polling)
□ StreamingAnalysisView 组件渲染流式内容
□ stripMetaSection 过滤 ---META--- 后的 JSON
□ CSS 实现:无边框,光标闪烁,自动滚动
□ 翻译 EN + ZH 完整

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 集成到现有 Preparing 页面

## Step 4.1: 替换 ChartReadingLoader 调用

文件:`components/syncro/SyncroPreparingPage.tsx`(修改)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useStreamingAnalysis } from '@/lib/base-analysis/useStreamingAnalysis';
import { StreamingAnalysisView } from '@/components/poju/StreamingAnalysisView';
import { saveBaseAnalysisFromStream } from '@/lib/profile/stored-profiles-service';

export function SyncroPreparingPage({ profile, localData }: any) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('preparing');
  
  // ⭐ 本地计算结果日志(用户能看到)
  useEffect(() => {
    console.group('[SyncroPreparing] Local computation result');
    console.log('Profile ID:', profile.profile_id);
    console.log('Four Pillars:', localData.four_pillars);
    console.log('True Solar Time:', localData.true_solar_time);
    console.log('Yong Shen:', localData.yong_shen);
    console.log('Locale (output language):', locale);
    console.groupEnd();
  }, [profile, localData, locale]);
  
  const { state, start } = useStreamingAnalysis({
    profile_id: profile.profile_id,
    locale,
    local_data: localData,
    
    onComplete: async (content: string, meta: any) => {
      // 保存到 IndexedDB
      try {
        await saveBaseAnalysisFromStream({
          profile_id: profile.profile_id,
          content,
          meta,
          locale,
          generated_at: new Date().toISOString()
        });
        
        // 跳转到下一步(syncro location 等)
        router.push(`/${locale}/syncro/location`);
      } catch (e: any) {
        console.error('[SyncroPreparing] save failed:', e);
      }
    },
    
    onError: (error: string) => {
      console.error('[SyncroPreparing] stream error:', error);
    }
  });
  
  // 启动
  useEffect(() => {
    start();
  }, []);
  
  return (
    <div className="preparing-page">
      {/* 顶部:粒子动效背景(保留)*/}
      <div className="preparing-bg">
        <div className="particles-orb" />
      </div>
      
      {/* 中部:流式分析视图(替代假提示)*/}
      <StreamingAnalysisView 
        content={state.content}
        status={state.status}
        bytes_received={state.bytes_received}
      />
      
      {/* 错误处理 */}
      {state.status === 'failed' && (
        <div className="error-actions">
          <div className="error-title">{t('error.title')}</div>
          <div className="error-message">{state.error}</div>
          <button onClick={start}>{t('error.try_again')}</button>
        </div>
      )}
    </div>
  );
}
```

## Step 4.2: 保存到 IndexedDB

文件:`lib/profile/stored-profiles-service.ts`(扩展)

```typescript
import { saveStoredProfile, getStoredProfile } from '@/lib/db/poju-db';

export async function saveBaseAnalysisFromStream(input: {
  profile_id: string;
  content: string;
  meta: any;
  locale: string;
  generated_at: string;
}): Promise<void> {
  const profile = await getStoredProfile(input.profile_id);
  if (!profile) throw new Error('profile not found');
  
  // 过滤掉 ---META--- 后面的部分,只保存用户可见的 markdown
  const visibleContent = stripMetaSection(input.content);
  
  const updated = {
    ...profile,
    base_analysis: {
      content: visibleContent,           // markdown,用户/LLM 都能读
      meta: input.meta,                  // 结构化元信息
      locale: input.locale,              // 生成时的语言
      generated_at: input.generated_at,
      used_true_solar_time: true,
      computation_version: 'v3_streaming'
    }
  };
  
  await saveStoredProfile(updated);
  console.log('[saveBaseAnalysisFromStream] saved profile', input.profile_id);
}

function stripMetaSection(content: string): string {
  const idx = content.lastIndexOf('---META---');
  return idx === -1 ? content : content.slice(0, idx).trim();
}
```

## Step 4.3: 同样集成到 POJU / Glyph / Match Preparing

```
同样的模式,应用到:

□ components/poju/POJUPreparingPage.tsx(或类似名)
□ components/glyph/GlyphPreparingPage.tsx
□ components/match/MatchPreparingPage.tsx(如有)

每个 Preparing 页面:
  1. console.group 打印本地计算结果(调试用)
  2. 调用 useStreamingAnalysis
  3. 用 StreamingAnalysisView 渲染
  4. onComplete → saveBaseAnalysisFromStream → router.push

⚠️ 重要:
  - 所有 Preparing 页面统一用这个流式架构
  - 不要混合新旧逻辑
  - 旧的 generateBaseAnalysisViaJson 调用全部删除
```

## Step 4.4: 删除旧的实现

```
删除以下文件 / 函数(它们已被流式架构取代):

□ app/api/profile/base-analysis/route.ts(旧 POST 接口)
  → 用 stream/route.ts 替代

□ lib/llm/deepseek/base-analysis.ts 中:
  - generateBaseAnalysisViaJson(旧的单次请求函数)
  - BASE_ANALYSIS_CLIENT_TIMEOUT_MS(280s 超时常量)

□ 任何用 BASE_ANALYSIS_CLIENT_TIMEOUT 错误码的逻辑

□ ChartReadingLoader.tsx 中的假提示(假滚动)
  → 已被 StreamingAnalysisView 取代

清理原则:
  - 不留死代码
  - 不留过时常量
  - tsc 编译通过
```

## 验证清单 - Step 4

```
□ SyncroPreparingPage 改造完成
□ POJU / Glyph 同步改造
□ saveBaseAnalysisFromStream 工作
□ 旧 base-analysis/route.ts 删除
□ 旧 generateBaseAnalysisViaJson 删除
□ 控制台显示本地计算 console.group 日志
□ tsc 编译通过
□ 无 lint 警告

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - 端到端测试

## 测试用例

### 用例 1:正常完整流程

```
步骤:
1. 填写出生信息(含出生地)
2. 提交 → 进入 Preparing 页面
3. 观察:
   □ 控制台显示本地计算日志(四柱/真太阳时/用神)
   □ "Reading your chart" 状态指示
   □ 内容【逐字浮现】(看到 markdown 段落一段段写出)
   □ 光标闪烁
   □ 自动滚动到底部
4. 完成:
   □ "Reading complete" 状态
   □ 跳转下一步(Syncro location / POJU 对话等)
   □ IndexedDB 中 profile 有 base_analysis(markdown 文本)
```

### 用例 2:断网重连(关键!)

```
步骤:
1. 开始分析
2. 1 分钟后,关闭手机网络
3. 等 30 秒
4. 重新打开网络
5. 观察:
   □ 客户端自动切换到 polling 模式(从 KV 拉)
   □ 内容继续推进(从中断处继续)
   □ 最终能完成
   □ IndexedDB 保存完整
```

### 用例 3:Vercel 函数超时(极端测试)

```
步骤:
1. 模拟服务端在 295 秒被 Vercel 终止
2. 观察:
   □ KV 中累积的内容仍然存在
   □ 客户端刷新页面 → 检测到该 profile 有未完成 job
   □ resume_job_id 触发 → 从 KV 拉取已生成内容
   □ 如果 KV 状态是 completed → 直接保存到 IndexedDB
   □ 如果 KV 状态是 streaming → polling 直到完成
```

### 用例 4:多语言

```
步骤:
1. 用户界面切换到中文
2. 提交八字
3. 观察:
   □ 流式输出全部是中文
   □ 没有出现违禁词(占星/占卜/算命/抽签)
4. 切换到英文
5. 重新生成另一个 profile
6. 观察:
   □ 流式输出全部是英文
   □ 没有 astrology / divination / fortune-telling
```

### 用例 5:违禁词扫描

```
完成 5-10 次真实流程后:
  □ 把流式输出复制下来
  □ grep 违禁词列表
  □ 应该 0 命中

如果有违禁词出现:
  → 加强 prompt 的 Language Rules 部分
  → 加 few-shot 反例
```

### 用例 6:错误恢复

```
步骤:
1. 故意制造 OpenRouter API 错误(如临时改错 API key)
2. 观察:
   □ 状态变为 'failed'
   □ 显示错误信息(友好的,不是 raw error)
   □ "Try Again" 按钮可用
3. 修复 API key,点 Try Again
4. 观察:
   □ 新 job 创建(或 resume 失败的)
   □ 正常完成
```

## 验证清单 - Step 5

```
□ 用例 1:正常完整流程通过
□ 用例 2:断网重连通过
□ 用例 3:Vercel 超时模拟通过
□ 用例 4:多语言切换通过
□ 用例 5:违禁词扫描 0 命中
□ 用例 6:错误恢复通过

性能指标:
  □ 首个 chunk 到达时间 < 5 秒
  □ 内容生成速度:每秒 50-200 chars(视模型)
  □ 总耗时:90-180 秒(比原来 240s+ 大幅缩短)
  □ 成功率 > 95%(对比原来 < 30%)
```

---

# 总结

```
本任务完成后:

✅ 治本解决超时问题
  - 流式连接保活
  - KV 累积保护
  - 断线重连自动恢复
  - 即使 Vercel 终止,数据不丢失

✅ 体验大幅提升
  - 真实内容逐段浮现(替代假提示)
  - 多行清晰显示(不再单行滚动)
  - 用户感知等待时间缩短
  - 看到"分析师正在书写"的真实感

✅ 多语言支持
  - locale 决定输出语言
  - 跟出生地完全解耦

✅ 品牌安全
  - 不显示 reasoning_content(避免违禁词暴露)
  - prompt 严格约束输出语言规范
  - 输出经过过滤(---META--- 后不显示给用户)

✅ 调试友好
  - 本地计算 console.group 日志
  - 字节数实时显示
  - KV 状态可查

技术栈:
  - SSE (Server-Sent Events)
  - Vercel KV (Upstash Redis)
  - OpenRouter DeepSeek streaming
  - Next.js 14 ReadableStream
```

---

**Cursor 务必:每个 Step 完成后贴出代码 + 测试输出,等用户确认才进入下一步。绝不允许跨 Step 实施。**
