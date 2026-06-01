# Syncro 精修指令(基于当前实测)

> ✅ **好消息**:上次的核心修复全部生效了!
> - 方位符已经在外缘(不再堆中心)
> - 粒子动效展开了
> - 12 时辰按顺序点亮(看到 6/12)
> - 三模式都能跑
>
> 🔧 **本次只做精修**:7 个具体调整,不是大改

---

# 📋 7 个修复点清单

```
1. 时辰失败原因排查 + 自动重试到成功
2. 粒子被方形框限制 + 转动时抖动
3. 整体下移(粒子/方位符/为何此时按键)避免和上方重叠
4. 方位符保持朝上不动,只有当前方位金色高亮(其他白色)
5. 粒子动效再大一些,完整显示不被切割
6. AR 视窗增大
7. MAP 同样下移,三模式布局统一
```

---

# 🔴 Part 1:时辰失败原因 + 自动重试

## 1.1 后端 API 加详细日志

文件:`app/api/syncro/llm_hour/route.ts`(在 catch 部分加日志)

```typescript
// 在每个 catch 内加详细错误信息

if (!response.ok) {
  const errText = await response.text();
  console.error(`[llm_hour] ${body.hour_id} HTTP ${response.status}:`, errText.slice(0, 500));
  
  // ⭐ 关键:返回具体错误类型,方便客户端决定是否重试
  return NextResponse.json({ 
    error: 'llm_http_error',
    status: response.status,
    detail: errText.slice(0, 300),
    retryable: response.status === 429 || response.status >= 500  // 限流/服务器错误可重试
  }, { status: 500 });
}

// JSON parse 失败时
try {
  parsed = JSON.parse(content);
} catch (e) {
  console.error(`[llm_hour] ${body.hour_id} JSON parse failed`);
  console.error(`[llm_hour] ${body.hour_id} raw content:`, content.slice(0, 500));
  
  return NextResponse.json({ 
    error: 'parse_failed',
    detail: `LLM 输出非合法 JSON: ${content.slice(0, 100)}`,
    retryable: true  // ⭐ 可重试
  }, { status: 500 });
}
```

## 1.2 客户端自动重试机制

文件:`components/syncro/SyncroResultLoader.tsx`(修改串行循环)

```typescript
async function generateOneHourWithRetry(
  hourId: string,
  hourLabel: string,
  cells: any[],
  taskDescription: string,
  profileSummary: string,
  locale: string,
  onProgress: (status: string, attempt?: number) => void
): Promise<{ success: boolean; advice?: any; error?: string }> {
  
  const MAX_ATTEMPTS = 3;
  let lastError = '';
  
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress(`attempt_${attempt}`);
    console.log(`[Syncro] ${hourId} attempt ${attempt}/${MAX_ATTEMPTS}`);
    
    try {
      const response = await fetch('/api/syncro/llm_hour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour_id: hourId,
          hour_label: hourLabel,
          hour_range: getHourRange(hourId),
          cells,
          task_description: taskDescription,
          profile_summary: profileSummary,
          locale
        }),
        signal: AbortSignal.timeout(60000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[Syncro] ✅ ${hourId} success on attempt ${attempt}`);
        return { success: true, advice: data.advice };
      }
      
      // 不可重试错误,直接失败
      const errData = await response.json();
      if (!errData.retryable) {
        console.error(`[Syncro] ❌ ${hourId} non-retryable error:`, errData);
        return { success: false, error: errData.error };
      }
      
      lastError = errData.error || `http_${response.status}`;
      
    } catch (e: any) {
      lastError = e.name === 'TimeoutError' ? 'timeout' : (e.message || 'unknown');
      console.warn(`[Syncro] ⚠️ ${hourId} attempt ${attempt} failed:`, lastError);
    }
    
    // 不是最后一次 → 等待后重试(指数退避)
    if (attempt < MAX_ATTEMPTS) {
      const waitMs = 1500 * Math.pow(2, attempt - 1);  // 1.5s → 3s → 6s
      console.log(`[Syncro] ${hourId} waiting ${waitMs}ms before retry`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  
  console.error(`[Syncro] ❌❌ ${hourId} all ${MAX_ATTEMPTS} attempts failed: ${lastError}`);
  return { success: false, error: lastError };
}
```

## 1.3 失败后用户手动重试 UI

```tsx
// 时辰圆点上的红色(失败)→ 允许用户点击重新生成

function handleRetryHour(hourId: string) {
  // 单独重新跑一次
  generateOneHourWithRetry(hourId, ...).then(result => {
    if (result.success) {
      // 更新 matrix + 改 status
      updateMatrix(result.advice);
      setHourStatus(hourId, 'done');
    }
  });
}

// 时辰圆点点击逻辑:
<button
  onClick={() => {
    if (status === 'failed') {
      handleRetryHour(hourId);  // ⭐ 失败 → 重试
    } else if (status === 'done' || status === 'now') {
      setSelectedHour(hourId);  // 完成 → 切换查看
    }
  }}
  style={{
    background: status === 'failed' ? '#C85A5A' : (status === 'done' ? '#4ECDC4' : '#444'),
    cursor: (status === 'failed' || status === 'done' || status === 'now') ? 'pointer' : 'default'
  }}
  title={status === 'failed' ? '点击重新生成' : undefined}
/>
```

## ✅ Part 1 验证

```
跑完整 Syncro,看 console:

应该看到:
  [Syncro] xxx attempt 1/3
  [Syncro] ⚠️ xxx attempt 1 failed: <错误信息>
  [Syncro] xxx waiting 1500ms before retry
  [Syncro] xxx attempt 2/3
  [Syncro] ✅ xxx success on attempt 2

记录失败原因:
  最常见错误是?
  - timeout → DeepSeek 慢,加 timeout 或换模型
  - parse_failed → prompt 输出格式问题
  - 429 → 限流(需降低并发)
  - 500 → OpenRouter / DeepSeek 服务问题

把 console 日志贴出来,我帮你分析。
```

---

# 🔴 Part 2:粒子被方形框限制 + 抖动

## 2.1 抖动根因 + 修复

```typescript
// ❌ 当前(可能抖动):
<div style={{
  transform: `rotate(${-alpha}deg)`,
  transition: 'transform 200ms cubic-bezier(0.2, 0, 0.2, 1)'
}}>

// ✅ 修复:
<div style={{
  transform: `rotate3d(0, 0, 1, ${-alpha}deg)`,  // ⭐ rotate3d 强制 GPU 加速
  transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',  // ⭐ 稍长过渡,平滑
  willChange: 'transform',                          // ⭐ 提示浏览器
  backfaceVisibility: 'hidden',                     // ⭐ 防止抖动
  WebkitBackfaceVisibility: 'hidden'
}}>
```

## 2.2 alpha 值节流(避免高频更新)

文件:`lib/syncro/useCompassPermission.ts`(改进 listener)

```typescript
function attachListener() {
  let lastUpdate = 0;
  const THROTTLE_MS = 100;  // ⭐ 每 100ms 最多更新一次
  
  const handler = (e: DeviceOrientationEvent) => {
    const now = Date.now();
    if (now - lastUpdate < THROTTLE_MS) return;
    lastUpdate = now;
    
    const alpha = (e as any).webkitCompassHeading !== undefined
      ? (e as any).webkitCompassHeading
      : (360 - (e.alpha || 0)) % 360;
    
    // ⭐ 平滑滤波:如果新值跳变太大,渐进过渡
    setState(s => ({
      ...s,
      alpha: smoothAlpha(s.alpha, alpha),
      beta: e.beta || 0,
      gamma: e.gamma || 0
    }));
  };
  
  window.addEventListener('deviceorientation', handler);
}

function smoothAlpha(prev: number, current: number): number {
  // 处理 0/360 边界
  let diff = current - prev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  // 渐进过渡:取 70% 当前 + 30% 之前
  return (prev + diff * 0.7 + 360) % 360;
}
```

## 2.3 粒子方形框问题

```
检查:粒子动效的 canvas 是否被某个父容器限制?

定位:
1. 在 DevTools 中点击粒子 canvas
2. 看 parent 链
3. 如果父容器有 overflow: hidden / border-radius / 固定宽高 → 移除

修复:让 SyncroParticleCore 自由渲染
```

```tsx
// SyncroParticleCore.tsx 检查:

export function SyncroParticleCore() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      // ⛔ 不要加 overflow: hidden
      // ⛔ 不要加 border-radius
      // ⛔ 不要加 background
    }}>
      <iframe  // 或 Spline runtime
        src="..."
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent'
        }}
      />
    </div>
  );
}
```

---

# 🔴 Part 3:整体下移,避免和上方重叠

```tsx
// 当前:margin: '40px auto 0' → 离顶部太近,跟图例重叠
// 修改:margin: '160px auto 0' → 给时辰条 + 图例 + 标题留空间

<div style={{
  position: 'relative',
  width: RING_SIZE,
  height: RING_SIZE,
  margin: '160px auto 0'  // ⭐ 从 40 改成 160
}}>
```

或者更准确,用绝对定位:

```tsx
// 把整个 compass-page 设置 padding-top
<div style={{
  position: 'relative',
  paddingTop: 200  // ⭐ 时辰条 + 图例 + 标题占的高度
}}>
  <div style={{
    position: 'relative',
    width: RING_SIZE,
    height: RING_SIZE,
    margin: '0 auto'
  }}>
    ...
  </div>
</div>
```

**Why this current 按钮也要下移**:

```tsx
<div style={{ 
  textAlign: 'center', 
  marginTop: 100  // ⭐ 跟着粒子区下移
}}>
  <button>为何此时</button>
</div>
```

---

# 🔴 Part 4(关键!):方位符朝上不转 + 颜色策略

## 设计调整

```
原方案:方位符跟手机转,N 永远指向真北
新方案:方位符固定朝上,当前指向的方位金色高亮

理由(用户的反馈是对的):
  - 罗盘标准设计:文字朝上易读,指针/高亮转
  - 你看手机时,屏幕的"上"就是"前方"
  - 方位符朝上不动 = 一眼能读
  - 当前方位金色 = 知道朝哪
```

## 4.1 把方位符从【旋转层】移到【固定层】

```tsx
const currentDirection = alphaToDirection(alpha);

return (
  <div style={{
    position: 'relative',
    width: RING_SIZE,
    height: RING_SIZE,
    margin: '160px auto 0'
  }}>
    
    {/* === 旋转层:只包粒子 === */}
    <div style={{
      position: 'absolute',
      top: 0, left: 0,
      width: '100%', height: '100%',
      transform: `rotate3d(0, 0, 1, ${-alpha}deg)`,
      transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform',
      backfaceVisibility: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: PARTICLE_SIZE,
        height: PARTICLE_SIZE,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }}>
        <SyncroParticleCore />
      </div>
    </div>
    
    {/* === 方位符:固定不转,放在旋转层外 === */}
    {DIRECTIONS.map(dir => {
      const rad = ((dir.angle - 90) * Math.PI) / 180;
      const x = Math.cos(rad) * LABEL_RADIUS;
      const y = Math.sin(rad) * LABEL_RADIUS;
      const isCurrent = dir.id === currentDirection;
      
      return (
        <div key={dir.id} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
          fontSize: 14,
          fontWeight: isCurrent ? 600 : 500,
          color: isCurrent ? '#D4A574' : '#FFFFFF',          // ⭐ 当前金色,其他白色
          opacity: isCurrent ? 1 : 0.65,                      // ⭐ 非当前透明些
          textShadow: isCurrent 
            ? '0 0 12px rgba(212, 165, 116, 0.6), 0 0 24px rgba(212, 165, 116, 0.3)' 
            : 'none',
          letterSpacing: 1.5,
          transition: 'color 400ms ease, opacity 400ms ease, text-shadow 400ms ease, font-weight 400ms ease',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 3  // ⭐ 在粒子层之上
        }}>
          {dir.id}
        </div>
      );
    })}
    
    {/* 中心信息(不变) */}
    <div style={{ /* ... */ }}>
      <CurrentDisplay cell={cell} hourId={activeHour} />
    </div>
  </div>
);
```

**关键改变**:
- 旋转层【只包粒子】
- 方位符在旋转层【外面】(不转)
- 当前方位金色 + 发光,其他白色 + 半透明
- 平滑 transition 让颜色变化优雅

---

# 🔴 Part 5:粒子动效再大,完整显示

```typescript
// 当前常量:
const RING_SIZE = 380;
const PARTICLE_SIZE = 380;   // 跟容器一样大 → 可能被切边

// 修改:容器留出余量,粒子尺寸不变(或略小)
const RING_SIZE = 420;        // ⭐ 容器加大
const PARTICLE_SIZE = 380;    // 粒子保持(或 360)
const LABEL_RADIUS = 195;     // ⭐ 方位符跟着外推(420/2 - 15)
```

或者反过来:容器不变,粒子缩小一点,留出 padding:

```typescript
const RING_SIZE = 380;
const PARTICLE_SIZE = 340;    // ⭐ 粒子比容器小,留出 20px 边
const LABEL_RADIUS = 175;
```

推荐第一种(容器加大),粒子保持完整。

---

# 🔴 Part 6:AR 视窗增大

```typescript
// AR 模式 const 修改:

const CAMERA_WINDOW_SIZE = 200;  // ⭐ 从 150 → 200
```

```tsx
// AR 视窗 div:
<div style={{
  // ...
  width: CAMERA_WINDOW_SIZE,
  height: CAMERA_WINDOW_SIZE,
  // ...
}}>
```

---

# 🔴 Part 7:MAP 整体下移 + 布局统一

```tsx
// MAP 模式主容器:跟 Compass 一样的 margin

<div style={{
  position: 'relative',
  width: RING_SIZE,
  height: RING_SIZE,
  margin: '160px auto 0'  // ⭐ 跟 Compass / AR 统一
}}>
  ...
</div>
```

**MAP 的方位符也用 Part 4 的样式**(朝上 + 当前金色):

```tsx
{DIRECTIONS.map(dir => {
  // 方位符不转(MAP 本来就不转)
  // 颜色策略:用户【选中】的方位金色(不是手机指向)
  const isSelected = dir.id === selectedDir;
  
  return (
    <div style={{
      color: isSelected ? '#D4A574' : '#FFFFFF',
      opacity: isSelected ? 1 : 0.65,
      textShadow: isSelected ? '0 0 12px rgba(212, 165, 116, 0.6)' : 'none',
      transition: 'all 400ms ease',
      // ...
    }}>
      {dir.id}
    </div>
  );
})}
```

---

# 🎯 整体效果对比

```
当前(实测截图):
  ✓ 方位符在外缘(对了!)
  ✓ 粒子展开(对了!)
  ✓ 12 时辰按顺序点亮
  ✗ 方位符跟着转(应该不转)
  ✗ 整体偏上,跟图例重叠
  ✗ 粒子边缘被切割
  ✗ 转动时抖动

修复后:
  ✓ 方位符固定朝上,当前金色高亮
  ✓ 粒子完整显示,无方形框
  ✓ 转动平滑无抖动
  ✓ 整体下移,跟上方分离
  ✓ AR 视窗更大
  ✓ MAP 布局统一
  ✓ 时辰失败自动重试到成功
```

---

# 📤 给 Cursor 的指令(精简版)

```
任务:Syncro 7 个精修

【背景】
当前主体结构已经对了:
  - 方位符在外缘 ✓
  - 粒子展开 ✓
  - 12 时辰串行 ✓
本次只做精修,不要大改结构。

【7 个修改】

1. 时辰失败重试:
   - 后端 llm_hour/route.ts:错误返回加 retryable 字段
   - 客户端:generateOneHour 改成 generateOneHourWithRetry(3 次,指数退避)
   - 用户可点失败圆点手动重试

2. 抖动 + 方形框:
   - rotate(deg) → rotate3d(0,0,1,deg)
   - 加 will-change: transform + backface-visibility: hidden
   - alpha listener 加节流(100ms)+ 平滑滤波
   - 检查 SyncroParticleCore 父容器有没有 overflow: hidden

3. 整体下移:
   - 主容器 margin '40px auto 0' → '160px auto 0'
   - Why this current 按钮 marginTop 跟着调

4. ⭐ 方位符策略变更:
   - 把方位符从【旋转层】移到【固定层】
   - 方位符朝上不动
   - 当前指向方位金色高亮(D4A574)
   - 其他方位白色半透明
   - 加 transition 让颜色平滑变化

5. 粒子完整显示:
   - RING_SIZE 从 380 → 420
   - PARTICLE_SIZE 保持 380
   - LABEL_RADIUS 从 170 → 195

6. AR 视窗增大:
   - CAMERA_WINDOW_SIZE 从 150 → 200

7. MAP 同样下移:
   - margin 跟 Compass 一致
   - 方位符颜色用"选中态金色"

【验证】
真机测试,iPhone Safari:
- 转动手机:方位符朝上不动,当前金色高亮(其他白色)
- 粒子动效:完整显示,无抖动
- 整体下移:跟时辰条/图例分离
- 12 时辰失败自动重试到 90%+ 成功
```

---

# 总结

```
当前进度:85% 完成 ✅

本次精修:剩余 15%
  - 失败重试(2 分钟改动)
  - 抖动 + GPU 优化(1 分钟改动)
  - 整体下移(30 秒改动)
  - 方位符策略变更(关键,5 分钟改动)
  - 尺寸微调(1 分钟改动)

完成后:Syncro 即可上线
```

---

**给 Cursor:这次都是小改动,严格按 7 个修改点做,不要重构。**
