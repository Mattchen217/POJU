# 📦 Task 4 · Oracle 完整实现

> 预计耗时：AI 输出 2-3 次，你验证 2-4 天

## 目标

Oracle 的"爆炸粒子 + 神秘卡片 + 毛笔写入"完整仪式流，以及 POJU 付费用户的 3 签联动（Past / Present / Future）。

## 交付范围

### 1. Oracle 登录页

按主文档 04.4.1 的 Stage 1-2 实现：

- 静态粒子球缓缓旋转（比 Syncro 简单，更偏诗意）
- 上方三行仪式提示（严肃 but 不吓人）：
  ```
  ◉ One question per reading.
    Asking many things at once dilutes the sign.
  
  ◉ If the same question calls you back, wait 48 hours.
    Answers need time to settle.
  
  ◉ Compress your question into 60 characters.
    The compression is the beginning of the answer.
  ```
- 单行输入框，**强制限制 60 字符**
- 按钮：`[ Continue → ]`

### 2. 召唤仪式（Stage 3-6）

**Stage 3 · Respond**：
- 用户按 Continue → 粒子球加速流动 + 颜色加深
- 屏幕中央显示：`Hold to summon your sign`
- 背景音效：低频嗡鸣（hum.mp3）由弱变强

**Stage 4 · Summon**：
- 用户长按屏幕 3 秒
- 按住期间粒子向中心凝聚
- 进度光环倒计时（克制视觉）
- 3 秒完成 → 爆炸
- 音效：叮一声 + 画面震动

**Stage 5 · Reveal**：
- 爆炸碎粒子中浮现一张卡片
- 卡片材质随签等级变化（见第 4 条）
- 卡片缓缓展开（2-3 秒）
- 音效：纸张沙沙声（paper.mp3）

**Stage 6 · Inscribe**：
- 内容从上到下写入卡片
- **毛笔字效果**（用 SVG `stroke-dasharray` 动画实现，参考主文档 06.5.2）
- 总时长 15-20 秒
- 背景音效：毛笔划纸循环（brush.mp3）
- 每行写完后 1.5 秒再写下一行
- 最后一行完成：钟响一声（bell.mp3）

### 3. 风向系 7 级视觉差异

按主文档 04.3 表格实现，每级对应不同粒子颜色 + 卡片纹理：

| 等级 | 粒子色 | 卡片纹理 | 概率 |
|---|---|---|---|
| Divine Tailwind | 金白光粒 #f0e7c8 | 金色光晕 | 5% |
| Fair Sky | 天青 #a8c4d8 | 淡蓝纹理 | 15% |
| Calm Current | 蓝绿 #7fa896 | 水纹底 | 20% |
| Still Water | 素白 #d0d0d0 | 极简纸面 | 25% |
| Crosswind | 橘黄 #c89a6a | 斜纹底 | 20% |
| Headwind | 深红 #8a4a4a | 粗糙纹 | 10% |
| Eye of Storm | 暗紫 #4a3a5a | 裂纹墨染 | 5% |

**Eye of Storm 特别处理**：卡片上显示额外副标题 `The eye is the calm in the storm. This is where clarity lives.`

视觉差异要有但不过度——不做 Co-Star 式的黑红刺眼对比，保持克制美学。

### 4. 卡片固定格式

按主文档 04.5.1 结构：

```
┌──────────────────────────────────────┐
│          ✦  A  SIGN  ✦               │
│                                      │
│       ✦ Divine Tailwind ✦            │
│        (Sign of Grace)               │
│                                      │
│  ──────  THE VERSE  ──────           │
│  [禅诗 · 4-6 行]                     │
│                                      │
│  ──────  WHAT IT MEANS  ──────       │
│  [AI 实时生成 · 50-80 英文字]        │
│                                      │
│  ──────  FOR TODAY  ──────           │
│  [AI 实时生成 · 20-40 英文字]        │
│                                      │
│  ──────                              │
│                                      │
│  If this knot needs untying,         │
│  POJU will sit with you.             │
│  One question · $9.99                │
│                                      │
│            Your Sign                 │
│           pojulife.com               │
└──────────────────────────────────────┘
```

9:16 竖屏尺寸，自动保存到 IndexedDB。

### 5. 48 小时相似度检测

- 用户每次抽签记录问题哈希 + 时间戳到 IndexedDB
- 新问题提交前用 Claude Haiku 做语义相似度检测（Mock 阶段用简单字符串相似度替代）
- 相似度 > 80% 且 48h 内 → 弹温柔劝退弹窗：

```
You've already asked this.

Your sign from [2 hours ago]:
✦ Calm Current

Answers don't change just because you ask again.
Give it 48 hours.

[ Read my previous sign ]
[ Ask a different question ]
[ I know. Draw anyway. ]
```

第三个按钮允许强抽。

### 6. POJU 3 签联动流程

当用户从 POJU Chat 召唤 Oracle 时：

- 从 POJU Chat 底部抽屉弹出 Oracle 完整面板
- 完成 Stage 1-6 得到 Present 卡
- 关闭抽屉，数据回传 POJU Chat
- POJU Chat AI 说："这是'现在'。让我们看'过去'：`[ Draw your Past ]`"
- 用户点击 → 再次打开 Oracle 面板（保留 linked_session_id）
- 完成后回传 → POJU 继续说 → `[ Draw your Future ]`
- 三签合看

Oracle 面板以**底部抽屉**形式内嵌在 POJU Chat，不是跳转。用户完成后抽屉自动关闭。

### 7. The Archive 中的 Oracle

Oracle 抽过的签自动存 IndexedDB（结构见主文档 04.8）。Archive 页展示缩略图网格（本 Task 只存数据，Archive UI 在 Task 5）。

### 8. 结果卡片分享

用户可长按或点击 Share 图标保存为 PNG 到相册。卡片本身就是 9:16 分享格式，不需要额外导出 PDF。

### 9. 音效系统

创建 `lib/audio/sfx.ts`（参考主文档 06.5.3）：
- 使用 Howler.js
- 预加载 hum / explosion / paper / brush / bell
- 全局静音开关（localStorage 持久化）

### 10. Mock Oracle AI

创建 `lib/ai/mock-oracle.ts`：
- 接收 question + sign + role (past/present/future)
- 返回 `what_it_means` + `for_today` + `visual_hint`

### 11. 签诗静态库占位

创建 `data/oracle-signs.json`，包含 100 签的基础数据结构（禅诗可以先用占位文案，真签诗本土化是独立工作包，见主文档附录 B）。

## 验证标准

- [ ] 完整 7 Stage 仪式流畅
- [ ] 60 字符限制工作
- [ ] 长按 3 秒触发爆炸
- [ ] 毛笔写入动画诗意感强
- [ ] 音效与动画严格同步
- [ ] 7 级风向系视觉区分合理但不刺眼
- [ ] 48h 相似度检测弹出 + 三个按钮都工作
- [ ] PNG 分享格式正确
- [ ] 从 POJU Chat 召唤 Oracle 作为底部抽屉弹出
- [ ] 3 签联动流程完整（Present → Past → Future → 回传）
- [ ] 静音开关工作

---