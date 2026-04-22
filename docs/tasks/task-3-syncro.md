# 📦 Task 3 · Syncro 完整实现（最复杂）

> 预计耗时：AI 输出 3-4 次，你验证 4-7 天

## 目标

Syncro 是整个项目技术最难的部分。包括 3D 粒子球、摄像头 AR 视口、罗盘感知、GPS、加速度计、8 方位 AI 分析、纯前端锁定机制、登录页双区结构、精准拍照。

## 交付范围

### 1. Syncro 登录页双区结构

**区域 A · 教学区（可关闭）**：
- 内容：四大学科速览（Ganzhi / Bagua / Wuxing / Kanyu）+ 使用说明
- 勾选 `Don't show this again` + `Got it, continue ↓`
- localStorage flag 记录

**区域 B · 信息输入区（永久显示）**：
- Date of Birth（iOS 滚轮式选择器）
- Time of Birth（12 时辰段下拉，见主文档 02.4.8 表格）
- Gender（Male / Female / Other）
- Profession（12 项预设 + 自定义输入，见主文档 03.2.3）
- 自动预填 localStorage 里上次的值
- `[ Begin Reading → ]`

### 2. 设备权限请求流程

按主文档 03.13 的 6 步：

```
Step 1 · 设备权限请求
Step 2 · iOS 罗盘特殊授权（DeviceOrientationEvent.requestPermission()）
Step 3 · 罗盘校准引导（∞ 字手势动画）
Step 4 · 双区登录页（见上）
Step 5 · 首次 AI 分析（mock）
Step 6 · 进入主界面
```

### 3. 3D 粒子能量球（平放模式）

用 React Three Fiber + GLSL shader：

- 深空紫蓝背景 + 金色高光粒子
- 5000 / 2000 / 800 粒子三级性能分级（自动检测设备 GPU）
- Curl Noise 驱动粒子流动，呈"能量场呼吸"感
- 8 方位光点标识（N / NE / E / SE / S / SW / W / NW）
- 手机罗盘朝向 → 对应方位的粒子高亮
- 手指可拖拽旋转视角
- 轻点方位光点 → 展开详细卡片

粒子 shader 参考主文档 06.4.1 / 06.4.2 的代码示例。

### 4. AR 模式（伪增强）

手机竖立时自动切换：

- 屏幕占满粒子能量球（用户在球内部视角）
- 中央圆形视窗：实时显示摄像头画面（用 `getUserMedia` + `<video>` → Three.js VideoTexture）
- 视窗边缘极简渐变光晕，颜色随当前朝向方位属性变化
- 视窗上下方：AR 模式中心卡片（见本 Task 第 6 条）
- 手指可通过锁定按钮强制平放/AR 模式

**关键**：摄像头内容不记录、不分析、不上传。

自动切换逻辑：用 `DeviceMotionEvent` 读 z 轴加速度（平放 z > 0.8 / 竖立 z < 0.3）。

### 5. 8 方位表格渲染（按主文档 03.5.2）

AI 返回结构化 JSON 后渲染为如下 8 行表格：

```
| Direction | Rating   | Best For...     | Avoid...        |
| East      | Excellent| Growth & Healing...| Loud noises...   |
| Southeast | Good     | Deep Rest...    | High-stakes neg...|
| ...（共 8 行）
```

Rating 可视化：
```
Excellent  ✦✦✦✦✦
Good       ✦✦✦✦
Neutral    ✦✦✦
Weak       ✦✦
Poor       ✦
```

报告顶部元数据行：
```
SYNCRO READING
Shen hour (3 PM – 5 PM) · Apr 20, 2026
39.68°N, 75.75°W · Newark, DE
Yi-Wood Day Master · M · Lawyer
Valid until You hour (5 PM EDT)
```

平放模式：可通过 UI 切换"粒子球视图 / 表格视图"查看全部 8 方位。
AR 模式：中心视窗只显示手机当前朝向的那一行。

### 6. AR 模式中心视窗卡片

当前朝向方位卡片内容：

```
┌────────────────────────┐
│  EAST · Zhen Palace    │
│  ✦✦✦✦✦ Excellent       │
│  ── Best For ──        │
│  Growth & Healing.     │
│  Perfect for brain-    │
│  storming long-term    │
│  goals.                │
│  ── Avoid ──           │
│  Loud noises,          │
│  renovations.          │
└────────────────────────┘
```

手机旋转 → 视窗内容 300ms 渐变过渡。

### 7. 纯前端锁定机制

按主文档 03.8 节完整实现：

- `SyncroCacheEntry` 数据结构（IndexedDB）
- 三维度锁定键：bazi_hash + geohash_6 + shichen_id + gender
- 9 个 geohash 邻居判断
- GPS 稳定性缓冲（主文档 03.14 的 isGPSStable 函数）
- Begin 按钮五种分支逻辑（见主文档 03.8.3）
- 职业切换时只重写 narrative_by_profession 对应 key

### 8. 时辰切换自动仪式

用 setTimeout 在下一时辰整点触发：
- 粒子球旋转渐变 2s
- Toast 提示："Shen hour has closed. You hour (Sunset) begins. Your field is being retuned..."
- Mock AI 重新生成
- 递归设置下一个 timer

### 9. 精准拍照模式

AR 模式下长按视窗 1 秒：
- 视窗边缘光晕收缩到中心（快门效果）
- 画面冻结 0.5 秒
- 粒子球缩小到画面中央
- 一束金光从天而降
- 2 秒加载 → 结果浮出
- 方位用自然语言（"Northwest, slightly toward North"），**绝不显示度数**
- 结果页底部：`Name this direction` 输入框
- **照片不保存**，仅保存方位数据 + 用户命名

### 10. 磁场校准与真北修正

- WMM (World Magnetic Model) 客户端计算磁偏角
- 罗盘数据波动 > 15°/s → 判定干扰 → 弹提示"⚠️ Nearby metal or electronics may distort your reading"

### 11. 结果 PNG 导出

按主文档 03.11.2 格式生成 9:16 PNG（用 html2canvas）：
- 标准格式 vs 精准拍照变体
- 一键保存到相册
- 底部钩子：`Ask POJU to see what's underneath · $9.99`

### 12. PC 端 Fallback

PC 访问 `/syncro` 不启动粒子球，显示：
- 宣传图片/视频
- 二维码（链接到移动版）
- SMS 引导（输入手机号发送链接，Task 5 接入 Twilio）

### 13. Mock AI

创建 `lib/ai/mock-syncro.ts`：
- 接收 bazi + gender + profession + geohash + shichen + current_azimuth
- 返回主文档 03.5.4 的完整 JSON 结构
- 包含 `directions_core` + `narrative_by_profession[current_profession]`

## 验证标准

- [ ] 真机（iPhone / Android）访问 `/syncro` 体验完整流程
- [ ] 教学区可关闭且记住
- [ ] 信息输入预填上次值
- [ ] 权限请求流程 iOS 不报错
- [ ] 粒子球 60fps（旗舰机），降级后低端机也流畅
- [ ] 手机平放 ↔ 竖立能自动切换模式
- [ ] AR 模式中心视窗摄像头画面实时
- [ ] 手机旋转 → 视窗卡片内容切换流畅
- [ ] 平放模式可切换到 8 方位表格视图查看全部
- [ ] 连续打开 Syncro → 同八字同位置同时辰 → 返回完全一致的报告（锁定生效）
- [ ] 改变职业 → 只重写叙事层（验证 IndexedDB 里 directions_core 未变）
- [ ] 整点时辰切换 → 自动触发仪式动画 + 重新生成
- [ ] 长按视窗触发精准拍照流程
- [ ] PNG 导出格式正确可分享

---