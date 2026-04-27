# 03 · Syncro 产品页 `/syncro`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/syncro` |
| 文件位置 | `app/(marketing)/syncro/page.tsx` + `app/(product)/syncro/page.tsx`（条件渲染） |
| 页面标题 | `Syncro — See how your energy aligns with the space around you` |
| 目标用户 | 对方位能量场感兴趣的用户，以及 POJU 付费流中被 AI 召唤的用户 |
| 核心目标 | PC 端：引流到移动端 / 移动端：提供完整粒子球 + AR 体验，引流 POJU 付费 |
| 优先级 | 中高（Task 1 静态 + Task 3 交互） |
| 所属 Task | Task 1（PC 端介绍 + 静态内容）+ **Task 3（移动端完整功能）** |

---

## 访问条件

- 所有人可访问
- **PC 端**：展示介绍 + 扫码引导（不启动粒子球）
- **移动端**：直接启动完整体验

**首次访问移动端**需要依次授权：
1. Geolocation API 权限
2. DeviceOrientationEvent 权限（iOS 13+ 需要用户主动触发）
3. Camera `getUserMedia` 权限（仅 AR 模式需要）

---

## 页面结构清单（PC + 移动端分别）

### PC 端（Desktop ≥1024px）

1. 介绍 Hero（文字 + 宣传视频/GIF）
2. "Opens on mobile only" 引导卡片
3. 5 个使用场景简述
4. 科学 × 东方对照区
5. 永久免费承诺
6. Footer

### 移动端（<1024px）

- 首次访问：权限请求流程（6 步）
- 已授权用户：双区登录页 → 粒子球主体验

---

## PC 端详细内容

### 1. 介绍 Hero

**大标题**：`See how your energy aligns with the space around you.`

**副标题**：
```
Syncro reads your Bazi, your location, and this exact moment 
— then shows you which direction carries what energy.
```

**右侧视觉**：宣传视频或 GIF（循环播放）
- 展示粒子球 + AR 视口效果
- 约 15-30 秒循环
- 无声音（用户主动点击才有音效）
- 视频加载失败时降级为静态演示图

**下方小字**：`Always free. Forever.`

---

### 2. "Opens on mobile only" 引导卡片

**大卡片**（玻璃态）：

**标题**：`Opens on mobile only`

**说明**：
```
Syncro needs your phone's compass, GPS, and camera. 
Scan the code or text yourself the link.
```

**左右两个子区域**：

#### 子区 A · 二维码

- 二维码（指向 `https://pojulife.com/syncro`）
- 下方小字：`Scan with your phone camera`

#### 子区 B · SMS 发送链接

- 输入框：`[+1 ___-___-____]`（仅接受美国 + 加拿大号码）
- 按钮：`Text me the link`
- 点击行为：调用 `/api/sms/send-link` → Twilio 发送 SMS
- 成功后按钮变为：`✓ Sent! Check your phone.`
- 失败 Toast：`Couldn't send. Try scanning the QR code instead.`

**隐私小字**：
```
We don't store your phone number. 
The SMS is sent once and immediately forgotten.
```

---

### 3. 5 个使用场景简述

**标题**：`What Syncro is good for`

**5 个场景卡片**（横向 5 列或 2 行 3 列）：

#### ✦ Study spot
`Find where you focus best right now.`

#### ✦ Negotiation
`Know which seat at the table carries the strongest energy.`

#### ✦ Bed orientation
`Sleep in alignment with your Bazi and this season.`

#### ✦ Travel decision
`Today's direction tells you when to go, when to wait.`

#### ✦ POJU companion
`When POJU asks about space, Syncro delivers the map.`

---

### 4. 科学 × 东方对照区

**标题**：`What science observes, Eastern wisdom has named.`

**两列对照**（左边科学，右边东方）：

```
SCIENCE                    EASTERN WISDOM
─────────                  ───────────────
Magnetic fields            Qi (气)
Spatial orientation        Bagua (八卦)
Circadian biology          Shichen (时辰)
Environmental influence    Feng Shui (风水)
```

**底部说明**：
```
Syncro doesn't predict your future. 
It reads the invisible architecture of your here-and-now.
```

---

### 5. 永久免费承诺

**大字**：`Always free. Forever.`

**副标题**：
```
Syncro has no paid tier. No subscription. No "premium features."
It's our gift — and an invitation.
```

**链接**：`If your question is deeper than space, POJU is where to go →`（跳 `/poju`）

---

### 6. Footer

见 `@docs/pages/00-overview.md` · 全局组件 · Footer。

---

## 移动端详细内容（Task 3 实装）

### Step 1 · 设备权限请求

首次进入 `/syncro` 移动端，**如果还未授权任何权限**，显示权限请求屏：

**大卡片（玻璃态）**：

**标题**：`Syncro needs three permissions`

**三项清单**：

```
✦ Compass — to know which way you face
✦ Location — to calculate solar time and magnetic declination  
✦ Camera (optional) — for AR mode only
```

**主按钮**：`Grant permissions`
- 点击依次触发浏览器的三个权限弹窗
- Camera 权限可稍后请求（仅进入 AR 模式时才需要）

**副按钮**：`Why we need these →`
- 展开说明面板：
  ```
  · Compass: determines your current facing direction
  · Location: used for magnetic declination and true solar time
  · Camera: only used in AR mode, pixel data never leaves your 
    device
  
  We don't store any sensor data. All calculations run on your 
  phone.
  ```

---

### Step 2 · iOS 罗盘特殊授权

**仅在 iOS 13+ 检测到 `DeviceOrientationEvent.requestPermission` 存在时显示**。

**标题**：`One more step for iPhone`

**说明**：
```
iOS requires you to actively grant compass access. 
Tap the button below.
```

**按钮**：`Activate compass`
- 点击触发 `DeviceOrientationEvent.requestPermission()`
- 权限获得后进入 Step 3

**失败提示**（用户拒绝）：
```
Without compass access, Syncro can't read your direction. 
You can grant it later in iPhone Settings → Safari → Motion & 
Orientation Access.
```

---

### Step 3 · 罗盘校准引导

**标题**：`Calibrate your compass`

**动画**：屏幕上方显示 ∞ 字（无限符号）手势动画

**说明**：
```
Hold your phone and slowly draw a figure-8 in the air. 
This calibrates the magnetic sensor.
```

**自动检测**：
- 监听 `DeviceOrientationEvent` 的 alpha 值稳定度
- 连续 2 秒波动 < 5° 视为校准成功
- 自动进入 Step 4
- 底部倒计时：`Detecting... 5s`

**跳过选项**：`Skip for now`（低调按钮，用户已熟悉产品后可跳过）

---

### Step 4 · 双区登录页

这是 Syncro 的**灵魂页面**。分两个可独立控制的区域。

#### 区域 A · 教学区（可关闭）

标题：`How Syncro reads you`

副标题：`2,000 years of Eastern Shushu, reinforced by modern science`

**四条学理简介**（每条带拼音大写 + 英文解释）：

```
✦ GANZHI — 60-base time coordinate system
  Your birth as a precise cosmic position.

✦ BAGUA — 9-palace space map  
  The space around you, divided into 8 energy zones + center.

✦ WUXING — 5-phase dynamics
  How the elements of your Bazi interact with this moment.

✦ KANYU — magnetic and solar time
  Real sensors grounding ancient observation in today.
```

**使用方法说明**（具体文案待补充，暂用占位）：

```
How to use Syncro:
1. Enter your birth info and profession
2. Syncro calculates your 8-direction energy map
3. Point your phone to feel the field
4. Lift it up for AR mode, or lay it flat for overview
5. Hold on a specific direction to capture a reading
```

**勾选框**：`☐ Don't show this again`

**按钮**：`Got it, continue ↓`
- 点击 → 平滑滚动到区域 B
- 勾选时 → 同时 localStorage 记录 `pojulife_syncro_tutorial_seen = true`

#### 区域 B · 信息输入区（永久显示）

**不可关闭**。永远在 Step 4 页显示，预填上次值。

**输入字段**：

##### Date of Birth

- 滚轮式选择器（iOS / Android 原生风格）
- 年份范围：1900 – 当前年
- 月份：01-12
- 日期：01-31（根据月份和闰年动态）
- 默认值：从 localStorage 读 `pojulife_syncro_bazi.year/month/day`

##### Time of Birth

- 下拉列表（12 时辰段 + "Not sure"）：

```
11 PM – 1 AM · Midnight (Zi / 子)
1 AM – 3 AM · Late Night (Chou / 丑)
3 AM – 5 AM · Pre-Dawn (Yin / 寅)
5 AM – 7 AM · Sunrise (Mao / 卯)
7 AM – 9 AM · Morning (Chen / 辰)
9 AM – 11 AM · Late Morning (Si / 巳)
11 AM – 1 PM · Noon (Wu / 午)
1 PM – 3 PM · Early Afternoon (Wei / 未)
3 PM – 5 PM · Afternoon (Shen / 申)
5 PM – 7 PM · Sunset (You / 酉)
7 PM – 9 PM · Evening (Xu / 戌)
9 PM – 11 PM · Night (Hai / 亥)
Not sure
```

- 默认值：从 localStorage 读 `pojulife_syncro_bazi.shichen`
- "Not sure" 提示：会用无时柱八字（精度降为 75%）

##### Gender

- 单选按钮：Male / Female / Other
- 默认值：从 localStorage 读 `pojulife_syncro_gender`

##### Profession

- 下拉 + 自定义输入混合组件
- 12 项预设：
  - Lawyer / Legal
  - Doctor / Medical
  - Teacher / Educator
  - Engineer / Developer
  - Artist / Creative
  - Entrepreneur / Founder
  - Finance / Investment
  - Sales / Marketing
  - Manager / Executive
  - Student
  - Retired
  - Homemaker
- 底部输入框：`Or type your own:`（自定义输入）
- 默认值：从 localStorage 读 `pojulife_syncro_profession`

##### 按钮

`Begin Reading →`
- 样式：Primary 紫色 pill
- 点击行为：
  1. 保存所有字段到 localStorage
  2. 检查 IndexedDB 中的 `SyncroCacheEntry`（见下方"五种分支逻辑"）
  3. 按分支决定：直接渲染缓存 / 只重写叙事层 / 全量重新生成

##### 底部小字

```
Your info stays on this device.
Encrypted. Never sent to our servers.
```

---

### Step 5 · 首次 AI 分析（生成中）

**仅当需要调用 AI 时显示**（缓存命中则跳过此步）。

**加载动画**：
- 粒子球缓缓旋转
- 中央文字：`Reading your energy signal...`
- 持续约 3-5 秒

**额外文字**（每 1.5 秒切换一条，营造深度感）：
```
Calculating your Bazi four pillars...
Adjusting for true solar time at your location...
Mapping the 8 directions to current Wuxing dynamics...
Translating for your profession...
```

---

### Step 6 · 进入主界面

粒子球主体验。**两种模式根据手机姿态自动切换**：

#### 模式 A · Overhead（平放俯瞰）

**触发**：加速度计 z > 0.8（手机朝上平放）

**布局**：
- 屏幕中央：3D 粒子能量球（用户视角在球外部俯看）
- 球体周围 8 方位光点标识（N / NE / E / SE / S / SW / W / NW）
- 当前手机朝向的方位光点高亮
- 手指可拖拽旋转视角

**顶部元数据条**（始终可见）：
- 左：时辰名 + 时间范围（如 `Shen · 3 PM – 5 PM`）
- 中：下一时辰倒计时（如 `Next shift in 1h 23m`）
- 右：模式锁定按钮（默认自动，点击可锁定）

**下方按钮**：`View energy map ↕`
- 点击 → 展开 8 方位完整表格（见下方"8 方位表格视图"）

**点击方位光点**：
- 展开该方位的详细卡片（与 AR 模式中心视窗内容相同）
- 再次点击关闭

#### 模式 B · AR Immersive（沉浸增强）

**触发**：加速度计 z < 0.3（手机竖立）

**布局**：
- 屏幕占满粒子球（用户在球内部视角）
- **中央圆形视窗**：实时显示摄像头画面
  - 使用 `getUserMedia({ video: { facingMode: 'environment' } })`
  - 画面做 `<video>` → Three.js VideoTexture 渲染
  - **视频数据绝不上传**
- 视窗边缘：光晕颜色跟随当前朝向方位的属性色变化
- 视窗上下方：当前方位卡片（见下方"AR 模式中心视窗卡片"）

**交互**：
- 手机旋转 → 方位卡片内容 300ms 渐变过渡到新方位
- 长按视窗 1 秒 → 触发**精准拍照**（见下方）

**模式切换提示**：首次从 Overhead 切到 AR 时，Toast 提示：`Hold phone upright for AR. Lay flat for overview.`

---

### 8 方位表格视图（平放模式展开）

**标题**：`SYNCRO READING`

**元数据行**（顶部）：
```
Shen hour (3 PM – 5 PM) · Apr 20, 2026
39.68°N, 75.75°W · Newark, DE
Yi-Wood Day Master · M · Lawyer
Valid until You hour (5 PM EDT)
```

**8 方位表格**（8 行 × 4 列）：

| Direction | Rating | Best For... | Avoid... |
|---|---|---|---|
| EAST | ✦✦✦✦✦ Excellent | [AI 生成] | [AI 生成] |
| SOUTHEAST | ✦✦✦✦ Good | [AI 生成] | [AI 生成] |
| SOUTH | ✦✦✦ Neutral | [AI 生成] | [AI 生成] |
| SOUTHWEST | ✦ Poor | [AI 生成] | [AI 生成] |
| WEST | ✦✦ Weak | [AI 生成] | [AI 生成] |
| NORTHWEST | ✦✦✦ Neutral | [AI 生成] | [AI 生成] |
| NORTH | ✦✦✦ Fair | [AI 生成] | [AI 生成] |
| NORTHEAST | ✦✦✦✦ Good | [AI 生成] | [AI 生成] |

**表格下方**：
- 按钮：`Share as image`（导出 9:16 PNG）
- 按钮：`Ask POJU to go deeper · $9.99`
  - Stripe metadata: `source: "syncro_hook"`

---

### AR 模式中心视窗卡片

**内容**（对应手机当前朝向的方位）：

```
┌────────────────────────┐
│                        │
│  EAST · Zhen Palace    │
│  ✦✦✦✦✦ Excellent       │
│                        │
│  ── Best For ──        │
│  Growth & Healing.     │
│  Perfect for brain-    │
│  storming long-term    │
│  goals.                │
│                        │
│  ── Avoid ──           │
│  Loud noises,          │
│  renovations.          │
│                        │
└────────────────────────┘
```

**内容切换动画**：
- 方位变化时 → 300ms fadeIn/fadeOut 渐变
- 不闪烁不跳切

---

### 精准拍照流程

**触发**：AR 模式下长按视窗 1 秒

**仪式动画**：
1. 光晕收缩到视窗中心（快门效果）· 300ms
2. 画面冻结 · 500ms
3. "Reading the signal from this direction..." 提示 · 2 秒
4. 结果浮出

**采集数据**（内部，不展示给用户）：
- 时间戳
- GPS 经纬度
- 精确方位角 azimuth（角度制，0-360°）
- 俯仰角 pitch
- 当前时辰 ID
- 用户 Bazi 哈希

**结果页内容**：

**标题行**（自然语言，绝不显示度数）：
- 例如：`Facing Northwest, slightly toward North`
- 另外一行：`April 20, 2026 · 3:47 PM EDT`

**24 小时分段分析**（AI 生成）：
- 分段按 2 小时（12 段）或 3 小时（8 段）
- 每段一句话
- 示例：
  ```
  4 PM – 6 PM · Flow
  Good for creative work, writing, quiet tasks.
  
  6 PM – 8 PM · Stillness
  Best for rest or meditation. Avoid hard decisions.
  
  ...
  ```

**用户命名输入**：
- 输入框：`Name this direction`
- 占位符：`e.g. My desk, Office window, Bed`
- 字符限制：30 字符
- 可跳过

**操作按钮**：
- `Save to Archive`（保存到 IndexedDB）
- `Ask POJU about this spot · $9.99`（Stripe metadata: `syncro_precise_hook`）
- `Share as image`（9:16 PNG 导出）

**隐私提示**（小字）：
```
We saved the direction, not the photo. 
The camera data is gone.
```

---

### 时辰切换自动仪式

**触发**：每 2 小时整点（01:00, 03:00, 05:00... 23:00 当地时间）

**动画流程**：
1. Toast 提示：`Shen hour has closed. You hour (Sunset) begins. Your field is being retuned...`
2. 粒子球旋转淡出（500ms）
3. 加载新时辰数据（Mock 或真实 AI）
4. 粒子球旋转淡入（500ms）
5. 新方位数据可用

**用户感知**：自动，无需主动操作

---

### PNG 分享导出

**触发**：任何结果页点击 `Share as image`

**规格**：
- 9:16 竖屏比例（1080 × 1920）
- PNG 格式
- 用 `html2canvas` 生成

**模板内容**：

```
┌──────────────────────────────────────┐
│                                      │
│        ✦  POJU  ✦                    │
│                                      │
│   YOUR ENERGY MAP                    │
│   Shen hour · April 20, 2026         │
│   Newark, DE                         │
│                                      │
│   [粒子球快照缩略图]                  │
│                                      │
│   ──── WEALTH ────                   │
│   Southeast · Strong                 │
│   Best for: signing, pitching        │
│                                      │
│   ──── FOCUS ────                    │
│   Northeast · Clear                  │
│   Best for: writing, study           │
│                                      │
│   ──── AVOID ────                    │
│   Northwest · Scattered              │
│   Avoid: decisions, confrontation    │
│                                      │
│   ──────────────                     │
│                                      │
│   This is just the surface.          │
│   Ask POJU to see what's underneath. │
│                                      │
│   One question · $9.99               │
│   pojulife.com                       │
│                                      │
└──────────────────────────────────────┘
```

**精准拍照变体**：用精准方位名（如 "My desk"）替代 "YOUR ENERGY MAP"。

---

## Begin 按钮五种分支逻辑（关键）

点击 `Begin Reading →` 后：

```typescript
async function onBeginClick() {
  const newInfo = readFormFields();
  const oldInfo = readLocalStorage();
  const cached = await getSyncroCacheEntry();
  const now = {
    shichen: getCurrentShichenId(),      // "2026-04-20-shen"
    geohash: await getCurrentGeohash(),  // 6-char geohash
  };
  
  saveToLocalStorage(newInfo);  // 永久保存
  
  // 分支 1：首次使用 / 缓存已清
  if (!cached) {
    return generateFullNewReading(newInfo, now);
  }
  
  const baziChanged = newInfo.bazi !== oldInfo.bazi;
  const genderChanged = newInfo.gender !== oldInfo.gender;
  const professionChanged = newInfo.profession !== oldInfo.profession;
  const shichenMatch = cached.shichen_id === now.shichen;
  const locationMatch = isInGeohashNeighbors(cached.geohash_6, now.geohash);
  
  // 分支 2：不同的人（Bazi / Gender 变了）
  if (baziChanged || genderChanged) {
    clearCache();
    return generateFullNewReading(newInfo, now);
  }
  
  // 分支 3：同人但时辰变了 / 位置跨区了
  if (!shichenMatch || !locationMatch) {
    return generateFullNewReading(newInfo, now);
  }
  
  // 分支 4：同人同时辰同位置，只改职业
  if (professionChanged) {
    const existingNarrative = cached.narrative_by_profession[newInfo.profession];
    if (existingNarrative) {
      return renderReading(cached.directions_core, existingNarrative);
    } else {
      return regenerateNarrativeOnly(cached, newInfo.profession);
    }
  }
  
  // 分支 5：一切未变，直接渲染缓存
  return renderReading(cached);
}
```

---

## 数据依赖

### 需要读写的存储

**localStorage**:
- `pojulife_syncro_bazi` (JSON: year/month/day/shichen)
- `pojulife_syncro_gender`
- `pojulife_syncro_profession`
- `pojulife_syncro_tutorial_seen` (boolean)

**IndexedDB** (encrypted):
- Table: `syncro_entries`
- Entity: `SyncroCacheEntry`（见 `@docs/POJU_Development_Document_v3.0.1_Final.md` 第 03 章）

### 需要调用的 API

- `POST /api/ai/syncro`（生成 8 方位读数）
- `POST /api/ai/syncro/narrative-only`（仅重写叙事层）
- `POST /api/sms/send-link`（PC 端 SMS 发送）

### 需要的客户端能力

- Geolocation API
- DeviceOrientationEvent（罗盘）
- DeviceMotionEvent（加速度计）
- getUserMedia（摄像头，仅 AR）
- WebGL / Three.js

---

## 响应式行为

### Desktop (≥1024px)

- 显示 PC 端内容（介绍 + 扫码 + SMS）
- **不启动**粒子球
- 提示用户移动端才能使用

### Mobile (<1024px)

- 直接进入交互流程（权限 → 校准 → 双区登录 → 主体验）
- 横屏时提示 `Hold upright for best experience.`

---

## 空状态与错误状态

### 空状态

- 首次访问 → 权限请求流程

### 错误状态

- 权限拒绝 → `Syncro needs these to work. Go to Settings → Safari → enable compass/location.`
- GPS 获取失败 → `Can't find your location. Try moving to an open area.`
- 罗盘不稳定（> 15°/s 波动）→ `⚠️ Nearby metal or electronics may distort your reading. Move to an open area.`
- AI 调用失败 → `Something in the signal is unclear. Try again in a moment.`
- 设备不支持（老浏览器）→ `Your browser doesn't support Syncro. Try Safari, Chrome, or Firefox on a recent mobile device.`

---

## 验收标准

### PC 端

- [ ] 访问 `/syncro` 显示介绍页（不启动粒子球）
- [ ] Hero 视频/GIF 自动循环播放
- [ ] 二维码扫码后在手机上能访问 `/syncro`
- [ ] SMS 输入框能发送短信到指定美国/加拿大号码
- [ ] 5 个使用场景清晰展示
- [ ] 科学 × 东方对照区完整显示
- [ ] Footer 完整

### 移动端（iPhone / Android 真机）

- [ ] 权限请求流程完整（iOS + Android 都过）
- [ ] 罗盘校准动画正确，2 秒稳定后自动进入下一步
- [ ] 双区登录页：教学区可关闭 + 信息输入区预填
- [ ] 5 种分支逻辑各自表现正确（见上方伪代码）
- [ ] 平放 ↔ 竖立自动切换模式
- [ ] AR 模式中心视窗摄像头画面实时
- [ ] 手机旋转 → 方位卡片 300ms 渐变切换
- [ ] 长按视窗 1 秒 → 触发精准拍照完整流程
- [ ] 精准拍照结果方位用自然语言（无度数）
- [ ] 用户命名输入 + 保存到 IndexedDB
- [ ] 时辰切换整点触发仪式动画
- [ ] PNG 分享导出正确（9:16，包含钩子）
- [ ] `Ask POJU to go deeper · $9.99` 跳转 Stripe Checkout（metadata 正确）
- [ ] 粒子球在旗舰机 60fps，中端 60fps，低端 30fps

---

## 关联资源

### 视觉参考

- `@docs/visual-reference/poju-visual-style-master.png`（参考 04 区块 SYNCRO 主流程）

### 相关文档

- `@.cursor/rules/05-visual-language.mdc` — 粒子球 / AR 视觉规范
- `@.cursor/rules/02-tech-stack.mdc` — React Three Fiber / GLSL
- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 03 章 Syncro + 第 03A 章学理根基
- `@docs/pages/05-chat.md` — 召唤 Syncro 时的底部抽屉集成
- `@docs/pages/06-archive.md` — Syncro 条目展示

### 关键约束

- 摄像头数据**绝不上传服务器**
- 方位**绝不用度数**，用自然语言
- 所有用户数据本地存储，加密

---

✦
