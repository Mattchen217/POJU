# Visual Reference · 视觉参考图

此目录存放 POJU 的视觉参考图，供 Cursor 开发时对照。

## 文件清单

### 必须放入的文件

**`poju-visual-style-master.png`** — 主视觉方案总图
- 尺寸：你最新上传的那张 9 屏全貌图
- 包含：Web 全局页面 + iOS APP 视觉 + POJU 核心流程 + Syncro & Oracle 主流程
- 用途：整体视觉语言的权威参考

## 如何使用

### 方式 1：Cursor 自动识别

当你的代码开发涉及视觉细节时，直接在对话中说：

```
@docs/visual-reference/poju-visual-style-master.png 
参照图里的 Hero 区样式，实现落地页首屏
```

Cursor 会读取图片并精确对照实现。

### 方式 2：针对性局部参考

当需要 Cursor 参考**某个局部细节**时：

```
@docs/visual-reference/poju-visual-style-master.png
请重点参考左上 01 区块的 Hero 屏 —— 
注意紫色星云的位置、文字对齐方式、"AI-Powered" 的紫色强调。
```

明确告诉 Cursor 看图的**哪个区域**，比让它自己找更准。

## 以后要补的图（随项目进展追加）

建议未来补充以下局部高清大图，进一步提升 Cursor 实现精度：

```
poju-chat-detail.png          — POJU Chat 界面局部放大
syncro-compass-detail.png     — Syncro 罗盘细节
oracle-card-variants.png      — Oracle 7 等级卡片差异对照
button-states.png             — 按钮所有状态（default/hover/active/disabled）
glassmorphism-samples.png     — 毛玻璃卡片质感样本
nebula-particle-samples.png   — 星云粒子效果样本
```

每次补图后，在对应的 Cursor 对话中 `@` 引用即可生效。

## 图片规范

- **格式**：PNG（无损）或 JPG（大图）
- **尺寸**：长边至少 1920px（保证 Cursor 看清细节）
- **命名**：小写 + 连字符，不含空格或中文
- **内容标注**：复杂图可以用箭头和文字标注关键元素

## 与 Cursor Rules 的关系

- `.cursor/rules/05-visual-language.mdc` — 视觉语言的**文字规则**（Cursor 自动加载）
- `docs/visual-reference/*.png` — 视觉语言的**图像参考**（用户主动 `@` 引用）

两者互补：规则负责日常自动约束，图片负责精确视觉校对。

## 冲突处理

当 `05-visual-language.mdc` 文字规则与参考图片冲突时：

1. **默认以图片为准**（图片是视觉最终源）
2. Cursor 应主动汇报冲突，并建议同步更新文字规则
3. 用户确认后，由 Cursor 修订 `05-visual-language.mdc`

这样视觉语言始终保持"文字 + 图像"两份来源一致。
