# 10 · 联系我们 `/contact`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/contact` |
| 文件位置 | `app/(marketing)/contact/page.tsx` |
| 页面标题 | `Contact — POJU` |
| 目标用户 | 需要支持、查询隐私、法律咨询的用户 |
| 核心目标 | 提供清晰的联系渠道，按问题类型分类 |
| 优先级 | 中（Task 1） |
| 所属 Task | Task 1 |

---

## 访问条件

- 所有人可访问
- 无需登录
- 入口：Footer → Contact

---

## 页面结构清单

1. 顶部区（标题）
2. 三类联系方式（按场景分类）
3. 响应时间说明
4. FAQ 快速索引（可选）
5. Footer

---

## 区块详细内容

### 1. 顶部区

**标题**：`Contact`

**副标题**：`We read every email.`

**简短说明**：
```
POJU is a small operation. We don't have a help center or 
chatbot support. Real humans read every message, and we 
respond as fast as we can.
```

---

### 2. 三类联系方式

**三张卡片**（垂直排列或横向三列）：

#### ✦ Support

- 图标：生活支持
- 标题：**Support**
- 说明：`For payments, refunds, technical issues`
- 邮箱：**`support@pojulife.com`**
- 按钮：`Email Support →`（`mailto:` 链接）

**常见咨询**：
- 支付问题
- 退款请求
- 技术故障
- 找不到历史 Session
- PDF 邮件未收到

#### ✦ Privacy

- 图标：锁
- 标题：**Privacy**
- 说明：`For data questions, CCPA/GDPR requests`
- 邮箱：**`privacy@pojulife.com`**
- 按钮：`Email Privacy Team →`

**常见咨询**：
- 数据删除请求
- CCPA / GDPR 权利行使
- 第三方服务使用疑问
- 数据泄露报告

#### ✦ Legal

- 图标：文件
- 标题：**Legal**
- 说明：`For legal matters, press inquiries`
- 邮箱：**`legal@pojulife.com`**
- 按钮：`Email Legal →`

**常见咨询**：
- 合作咨询
- 媒体采访
- 法律问题
- 版权事宜

---

### 3. 响应时间说明

```
Response times:

· Support: within 24 hours on business days
· Privacy: within 48 hours (priority: CCPA/GDPR deletion)
· Legal: within 5 business days

If you're in crisis (mental health emergency), please do 
NOT email us. Contact:

· 988 Suicide & Crisis Lifeline (US)
· 911 for emergencies
· Crisis Text Line: Text HOME to 741741
```

**视觉处理**：危机资源部分有紫色警示色边框，防止用户错过。

---

### 4. FAQ 快速索引（可选）

对于常见问题，可以加一个小 FAQ 区域，避免重复邮件：

```
Common questions:

▸ Can I get a refund?
  See our Terms of Service, section 4. Most refunds are 
  processed within 7 days of purchase.

▸ How do I delete my data?
  Use "End & Wipe" in any POJU Session, or "Wipe everything" 
  in The Archive. Everything local to your device disappears 
  immediately.

▸ Does POJU work on Android?
  Yes, as a PWA (Progressive Web App). Visit pojulife.com 
  in Chrome and "Add to Home Screen" for the full experience.

▸ Can I use POJU without payment?
  Syncro and Oracle are completely free, no account needed. 
  POJU (the breakthrough chat) is $9.99 per session.

▸ How does POJU make money if it doesn't sell data?
  Users pay $9.99 per session. That's the whole business 
  model.
```

FAQ 区折叠式（手风琴），默认关闭，点击展开。

---

### 5. Footer

见 `@docs/pages/00-overview.md`

---

## 功能与交互

### `mailto:` 链接

每个邮箱按钮都是 `mailto:` 链接：
```html
<a href="mailto:support@pojulife.com?subject=POJU Support Request">
  Email Support →
</a>
```

- 可选预填主题行便于分类
- 打开用户默认邮箱客户端

### 邮箱复制

点击邮箱文本（如 `support@pojulife.com`）→ 复制到剪贴板 + Toast：`Copied!`

**目的**：有些用户浏览器没配置邮箱客户端，需要手动复制粘贴。

### FAQ 展开

手风琴风格，点击问题展开答案。

---

## 数据依赖

### 需要的数据

- 静态内容

### 需要调用的 API

- 无

---

## 响应式行为

### Desktop

- 三联系卡片横向三列
- FAQ 居中，最大宽度 720px

### Tablet / Mobile

- 三联系卡片垂直堆叠
- FAQ 全宽

---

## 验收标准

- [ ] 访问 `/contact` 显示三类联系方式
- [ ] 每个 `mailto:` 链接点击打开邮箱客户端
- [ ] 点击邮箱文本复制到剪贴板
- [ ] 响应时间说明清晰
- [ ] 危机资源有视觉强调
- [ ] FAQ 展开收起流畅
- [ ] Mobile 下卡片垂直堆叠
- [ ] Footer 完整

---

## 关联资源

### 相关文档

- `@docs/pages/07-disclaimer.md` — 免责（Crisis Resources 参考）
- `@docs/pages/09-terms.md` — 退款政策（FAQ 引用）

### 关键约束

- 邮箱地址**必须真实可用**（不能填占位符）
- 响应时间承诺**必须能做到**（小团队可以调整为更长）
- 不提供电话号码（降低运营负担）
- 不提供实时聊天（保持克制）

---

✦
