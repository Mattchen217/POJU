# 08 · 隐私政策 `/privacy`

## 页面身份

| 项 | 值 |
|---|---|
| 路由 | `/privacy` |
| 文件位置 | `app/(marketing)/privacy/page.tsx` |
| 页面标题 | `Privacy Policy — POJU` |
| 目标用户 | 所有访问者，尤其隐私敏感用户（西方用户高度关注） |
| 核心目标 | 提供符合 CCPA / GDPR 的完整隐私政策，**也作为 POJU 品牌护城河的关键文档** |
| 优先级 | **必须**（上线前必需，律师起草后定稿） |
| 所属 Task | Task 1（占位版本）→ 律师审核后替换 |

---

## 访问条件

- 所有人可访问
- 无需登录
- 可从以下入口到达：
  - Footer → Privacy Policy
  - 免责协议弹窗 → 嵌入链接
  - 落地页 Screen 7 `Read our full Privacy Policy →`
  - POJU 产品页 Before You Pay 的链接

---

## 页面结构清单

1. 顶部区（标题 + 生效日期）
2. 开篇陈述（我们的隐私哲学）
3. 12 节详细内容
4. 底部联系方式
5. Footer

---

## 区块详细内容

### 1. 顶部区

**标题**：`Privacy Policy`

**副标题小字**：`Last updated: [日期]`

**版本标记**：`Version 1.0`

---

### 2. 开篇陈述（POJU 独有）

```
POJU was built differently.

Most products talk about "respecting your privacy." 
We built a product that doesn't need your data to work.

Here's the full picture.
```

**视觉强调**：这段用斜体或引用样式，区分于法律条款。

---

### 3. 12 节详细内容

#### 1. What We Collect

```
Minimal, by design:

· Device fingerprint (one-way hash)
  Used to restore your paid session if you refresh.

· Payment records (no personal info)
  Amount, timestamp, Stripe session ID.
  Kept for 7 years for tax compliance.

· Email (only when you explicitly provide it)
  Used to deliver PDF readings and one check-in email.
  Deleted within 24 hours after sending.

· Aggregated usage stats (anonymous)
  Total sessions, not per-user behavior.
```

#### 2. What We Don't Collect

```
What stays off our servers:

✗ Your conversations (lives encrypted on your device only)
✗ Your name, address, phone number (never asked)
✗ Your precise location (only country from GeoIP)
✗ Your behavioral tracking across websites
✗ Cookies for advertising
✗ IP addresses (Cloudflare/Vercel may log briefly)
```

#### 3. How We Use Your Data

```
· Device fingerprint: fraud prevention and session restoration only
· Payment records: tax compliance (required by law)
· Email: send PDF + optional check-in, then deleted
· Aggregate stats: improve product

We NEVER:
- Sell your data
- Use your data for advertising
- Share your data with marketing partners
- Use your conversations to train AI models
```

#### 4. Data Encryption

```
Conversations on your device: AES-256-GCM encryption
Encryption key: generated on your device, never sent to us
Transmission: HTTPS only (TLS 1.2+)
Payment: handled by Stripe (PCI DSS Level 1 certified)

Even if our servers were breached, there are no 
conversations to steal.
```

#### 5. Data Deletion

```
· Your local data: clear your browser OR click "End & Wipe"
· Email: physically deleted within 24 hours after delivery
· Device fingerprint: auto-deleted after 365 days of inactivity
· Payment records: kept 7 years (tax requirement), then deleted

You can request immediate deletion of all server-side data 
associated with your device by emailing privacy@pojulife.com.
```

#### 6. Third-Party Services

```
Services we use and their privacy policies:

· Anthropic (Claude API)
  AI processing. Zero Data Retention enabled — they don't 
  save your conversations.
  Privacy: https://www.anthropic.com/privacy

· OpenAI
  Used ONLY for embedding (converting knowledge base to 
  vectors). Your conversations never go to OpenAI.
  Privacy: https://openai.com/privacy/

· ElevenLabs
  Text-to-speech for reading aloud. Optional, user-initiated.
  Privacy: https://elevenlabs.io/privacy

· Stripe
  Payment processing. They handle your payment method.
  Privacy: https://stripe.com/privacy

· Resend
  Email delivery. Auto-deletes messages after 30 days.
  Privacy: https://resend.com/legal/privacy-policy

· Vercel
  Hosting. Standard web server logs (IP, user agent, URL).
  Privacy: https://vercel.com/legal/privacy-policy

· Supabase
  Database (for payment records + knowledge base).
  Privacy: https://supabase.com/privacy

· FingerprintJS (OSS version)
  Device identification. Runs entirely on your device.
  Privacy: no data sent to FingerprintJS servers (OSS version).
```

#### 7. AI Model Data Handling

```
Your conversations are sent to Anthropic for processing 
by Claude. We've specifically enabled:

✓ Zero Data Retention (ZDR)
  Anthropic does not keep your API requests or responses.

✓ No training on your data
  Your conversations are not used to improve Claude.

✓ No human review
  Unless you explicitly flag content for abuse, no Anthropic 
  employee will see your conversations.

This guarantee is contractual — we pay extra for ZDR.
```

#### 8. Children's Privacy

```
POJU is not intended for users under 18.

We do not knowingly collect data from minors. If you 
believe a minor has used POJU, contact privacy@pojulife.com 
and we'll delete any associated data immediately.
```

#### 9. Your Rights (CCPA — California Residents)

```
As a California resident, you have the right to:

· Know what personal information we collect, use, disclose
· Delete personal information we hold about you
· Opt out of the "sale" of personal information
  (We don't sell data, so this is automatic)
· Non-discrimination for exercising your rights

To exercise any of these rights, email privacy@pojulife.com 
with "CCPA Request" in the subject line.
```

#### 10. GDPR Specific (EU Residents)

```
If you're in the EU, you also have:

· Right to access your personal data
· Right to rectification (correct inaccurate data)
· Right to erasure ("right to be forgotten")
· Right to data portability
· Right to withdraw consent
· Right to object to processing

Legal basis for processing:
· Contract (providing the service you paid for)
· Legitimate interest (fraud prevention)

Data Protection Officer: privacy@pojulife.com
```

#### 11. Contact

```
For privacy questions:
privacy@pojulife.com

For general questions:
support@pojulife.com

For legal matters:
legal@pojulife.com

Physical address (if required by your jurisdiction):
[待律师确定后填入]
```

#### 12. Updates to This Policy

```
When we update this policy, we'll:

· Notify users via in-app banner on next visit
· Continued use after update = acceptance
· Major changes (new data collection, etc.) require 
  re-agreement
```

---

### 4. 底部联系方式

```
Questions? Email privacy@pojulife.com.
We read every message.
```

---

### 5. Footer

见 `@docs/pages/00-overview.md`

---

## 功能与交互

### 目录导航

顶部条款目录，点击平滑滚动到对应章节。

### 打印友好

支持浏览器打印为 PDF，用户可下载留存。

### 第三方服务链接

每个第三方服务名称都是可点击链接，跳转其隐私政策。

---

## 数据依赖

### 需要的数据

- 静态内容（律师审核后定稿）

### 需要调用的 API

- 无

---

## 响应式行为

### Desktop

- 最大宽度 800px 居中
- 目录固定左侧

### Mobile

- 全宽
- 目录折叠手风琴

---

## 验收标准

- [ ] 访问 `/privacy` 显示完整 12 节内容
- [ ] 开篇段落有视觉区分
- [ ] 第三方服务链接有效
- [ ] 目录导航工作
- [ ] Mobile 下目录折叠
- [ ] 打印 PDF 格式正确
- [ ] **上线前必须律师审核定稿**
- [ ] GDPR 部分如果不服务欧盟可以简化（但仍保留以防将来扩展）

---

## 关联资源

### 相关文档

- `@docs/POJU_Development_Document_v3.0.1_Final.md` — 第 09.2.2 节（12 节框架）
- `@docs/pages/01-landing.md` — Screen 7 隐私机制说明
- `@docs/pages/07-disclaimer.md` — 免责声明

### 关键约束

- 此文档是 POJU **品牌护城河的核心**
- 内容必须 100% 与技术实现一致（承诺什么就真的做什么）
- 律师定稿后严禁修改
- 所有第三方服务变更需同步更新此文档

---

✦
