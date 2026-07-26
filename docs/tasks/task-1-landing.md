# 📦 Task 1 · 项目初始化 + 落地页 + 导航 + 免责协议

> 预计耗时：AI 输出 1-2 次，你验证 1-2 天

## 目标

搭建 POJU 项目的技术骨架，完成对外展示的所有静态页面，让你能访问 `easternos.com` 看到品牌的完整第一印象。

## 交付范围

### 1. 项目初始化
- Next.js 14 App Router 项目 (TypeScript + Tailwind)
- PWA 配置（Serwist + manifest.json）
- Design Tokens 系统（按 Master Prompt 颜色/字体/间距完整配置）
- Tailwind 配置映射所有 tokens
- 基础字体加载（EB Garamond + Inter，用 `next/font`）
- 全局布局、错误边界、路径结构

### 2. 主落地页（`/`）6 屏

按顺序实现：
- **Screen 1 · Hero**：破局 POJU 艺术字 + `The wisdom that costs $300 with a master. Delivered in one conversation. $9.99.` + 主 CTA `Ask your question — $9.99` + 副 CTA `See your energy map · Free`
- **Screen 2 · 四元素品牌叙事**：Ancient · Modern · AI Agent · You（参见主文档 07.3.3 节结构）
- **Screen 3 · 三产品入口**：Syncro / POJU（中间略大）/ Oracle 三卡片，POJU 标 $9.99，其他标 Free
- **Screen 4 · 科学叙事锚点**：Modern Science Anchor 列 4 条研究引用 + QI/BAZI/XUAN/YUAN 桥梁
- **Screen 5 · Three Nevers**：Never stored / Never required / Never manipulative
- **Screen 6 · Footer**：Logo + Legal 链接 + 版权 + 免责

### 3. 三产品介绍页

- `/poju` · POJU 产品深度介绍页（5 个 Section，见主文档 07.4）
- `/syncro` · Syncro PC 端介绍页（PC 上显示二维码 + SMS 引导，**不启动粒子球**）
- `/oracle` · Oracle 介绍页（PC 端完整可用，Task 4 实装交互，本 Task 只做静态介绍）

### 4. 导航系统

- 桌面端顶栏：破局 POJU Logo | POJU · SYNCRO · ORACLE · ✦ Archive
- 移动端顶栏：破局 POJU Logo + ≡ 汉堡按钮 → 侧滑抽屉
- PWA standalone 模式：底部 5 Tab 导航（⌂ · POJU · SYNCRO · ORACLE · ✦）

### 5. 免责协议弹窗（全站首次访问弹一次）

- localStorage flag: `pojulife_disclaimer_v1`
- 核心 5 条摘要 + `[Read the full Disclaimer →]` 可展开完整文档
- 必须勾选 `I have read and agree to the Disclaimer, Privacy Policy, and Terms of Service.`
- 勾选后按钮激活 → `[Enter POJU]`
- 版本号升级时重新弹（version flag 机制）

### 6. 合规页

- `/disclaimer` · 免责声明完整版（用主文档 09.3.2 的 10 节框架作为占位，等律师起草后替换）
- `/privacy` · 隐私政策（用主文档 09.2.2 的 12 节框架作占位）
- `/terms` · 服务条款（占位）
- `/contact` · 联系方式（简单页，只展示 support@easternos.com）

## 验证标准

完成后用户应能：
- [ ] 访问 `/` 看到完整 6 屏，滚动流畅，动画有呼吸感
- [ ] 首次访问任何页面 → 免责弹窗出现 → 必须勾选才能继续
- [ ] 勾选后刷新任意页面 → 不再弹
- [ ] 清除浏览器数据 → 弹窗重新出现
- [ ] 访问 `/poju` / `/syncro` / `/oracle` 三个产品页可读可浏览
- [ ] `/syncro` PC 端显示二维码和 SMS 引导，而不是直接启动粒子球
- [ ] 导航栏在 desktop / mobile / PWA standalone 模式下表现正确
- [ ] 页面在 iPhone 尺寸到桌面都良好响应
- [ ] Lighthouse 分数：Performance > 90, Accessibility > 95, PWA installable

## 不做的

本 Task 不涉及：
- POJU Chat 页面（Task 2）
- Syncro 粒子球和 AR 实际功能（Task 3）
- Oracle 抽签实际功能（Task 4）
- The Archive 页面（Task 5）
- Stripe 支付集成（Task 5）
- AI 调用（Task 2）

落地页上所有 `$9.99` 按钮当前可以只做**视觉静态**，点击暂不跳支付（留着 Task 5 接入）。

## 对 AI 的明确指令

- 所有英文文案必须严格按 Master Prompt 提供的版本，不要"优化"或"改写"
- 破局 POJU 艺术字用 SVG 或 webfont 实现（若无字体资源，用 Noto Serif CJK SC 的极深金色渲染"破局"二字作为 Logo 占位）
- 粒子背景效果可以用简化版 React Three Fiber 实现（适度的金色粒子缓慢流动），不要做得太复杂（真正的粒子系统是 Task 3 的事）
- 所有按钮、卡片 hover 状态克制 —— 金色微光 + 1px 位移，不要 dramatic
- 页面之间 Framer Motion 平滑过渡

---