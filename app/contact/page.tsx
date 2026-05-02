import Link from "next/link";
import { Suspense } from "react"; //
import type { Metadata } from "next";

import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { MarketingLocaleProvider } from "@/components/marketing/marketing-locale";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";

// 1. 强制动态渲染
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — POJU",
  description: "Contact POJU",
};

const contactCards = [
  {
    title: "Support",
    desc: "For payments, refunds, technical issues",
    email: "support@pojulife.com",
    button: "Email Support →",
    items: ["支付问题", "退款请求", "技术故障", "找不到历史 Session", "PDF 邮件未收到"],
  },
  {
    title: "Privacy",
    desc: "For data questions, CCPA/GDPR requests",
    email: "privacy@pojulife.com",
    button: "Email Privacy Team →",
    items: ["数据删除请求", "CCPA / GDPR 权利行使", "第三方服务使用疑问", "数据泄露报告"],
  },
  {
    title: "Legal",
    desc: "For legal matters, press inquiries",
    email: "legal@pojulife.com",
    button: "Email Legal →",
    items: ["合作咨询", "媒体采访", "法律问题", "版权事宜"],
  },
] as const;

const contactIntro = `POJU is a small operation. We don't have a help center or 
chatbot support. Real humans read every message, and we 
respond as fast as we can.`;

const responseTimeText = `Response times:

· Support: within 24 hours on business days
· Privacy: within 48 hours (priority: CCPA/GDPR deletion)
· Legal: within 5 business days

If you're in crisis (mental health emergency), please do 
NOT email us. Contact:

· 988 Suicide & Crisis Lifeline (US)
· 911 for emergencies
· Crisis Text Line: Text HOME to 741741`;

const faqText = `Common questions:

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
  Syncro and Glyph are completely free, no account needed. 
  POJU (the breakthrough chat) is $9.99 per session.

▸ How does POJU make money if it doesn't sell data?
  Users pay $9.99 per session. That's the whole business 
  model.`;

const faqItems = [
  {
    q: "Can I get a refund?",
    a: "See our Terms of Service, section 4. Most refunds are processed within 7 days of purchase.",
  },
  {
    q: "How do I delete my data?",
    a: "Use \"End & Wipe\" in any POJU Session, or \"Wipe everything\" in The Archive. Everything local to your device disappears immediately.",
  },
  {
    q: "Does POJU work on Android?",
    a: "Yes, as a PWA (Progressive Web App). Visit pojulife.com in Chrome and \"Add to Home Screen\" for the full experience.",
  },
  {
    q: "Can I use POJU without payment?",
    a: "Syncro and Glyph are completely free, no account needed. POJU (the breakthrough chat) is $9.99 per session.",
  },
  {
    q: "How does POJU make money if it doesn't sell data?",
    a: "Users pay $9.99 per session. That's the whole business model.",
  },
] as const;

// 2. 将核心 UI 抽离到 Content 组件中
function ContactContent() {
  return (
    <MarketingLocaleProvider>
      <main className="bg-bg-deep text-text-body">
        <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
          <header className="px-1 py-2.5 sm:py-3 md:px-2">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-0">
                <PojuMarkLogo />
                <span className="inline-flex items-center text-[14px] font-semibold leading-none tracking-[0.09em] text-text-primary sm:text-[15px] md:text-[16px]">
                  POJU
                </span>
              </Link>
              <nav className="hidden items-center gap-7 text-[12px] uppercase tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
                <Link href="/poju" className="hover:text-text-primary">
                  POJU 破局
                </Link>
                <Link href="/syncro" className="hover:text-text-primary">
                  POJU SYNCRO
                </Link>
                <Link href="/glyph" className="hover:text-text-primary">
                  POJU GLYPH
                </Link>
                <Link href="/archive" className="hover:text-text-primary">
                  THE ARCHIVE
                </Link>
              </nav>
              <MarketingLanguageSwitcher />
            </div>
          </header>

          <section className="mx-auto mt-2 w-full max-w-5xl rounded-2xl border border-white/10 bg-black/25 px-5 py-8 sm:px-7 md:px-10">
            <h1 className="text-center text-[30px] font-semibold text-text-primary sm:text-[36px]">Contact</h1>
            <p className="mt-2 text-center text-[15px] text-text-secondary">We read every email.</p>
            <pre className="mx-auto mt-5 max-w-2xl whitespace-pre-wrap text-center text-sm leading-7 text-text-dim">
              {contactIntro}
            </pre>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {contactCards.map((card) => (
                <article key={card.title} className="rounded-xl border border-white/10 bg-bg-layer-1/40 p-5">
                  <h2 className="text-lg font-semibold text-text-primary">{card.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">{card.desc}</p>
                  <ul className="mt-2 space-y-1 text-xs leading-6 text-text-dim">
                    {card.items.map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                  <a
                    href={`mailto:${card.email}?subject=POJU%20${encodeURIComponent(card.title)}%20Request`}
                    className="mt-4 inline-flex text-sm text-text-accent hover:text-purple-vivid"
                  >
                    {card.button}
                  </a>
                  <p className="mt-1 text-xs text-text-dim">{card.email}</p>
                </article>
              ))}
            </div>

            <div className="mt-7 rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/10 px-4 py-4 text-sm leading-7 text-text-secondary">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">{responseTimeText}</pre>
            </div>

            <div className="mt-7 rounded-xl border border-white/10 bg-bg-layer-1/30 px-4 py-4 text-sm leading-7 text-text-secondary">
              <p className="font-medium text-text-primary">FAQ</p>
              <div className="mt-3 space-y-2">
                {faqItems.map((item) => (
                  <details key={item.q} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                    <summary className="cursor-pointer text-sm text-text-primary">{item.q}</summary>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">{item.a}</p>
                  </details>
                ))}
              </div>
              <pre className="mt-4 whitespace-pre-wrap text-xs leading-6 text-text-dim">{faqText}</pre>
            </div>
          </section>

          <footer className="mt-8 w-full rounded-xl bg-bg-layer-1/60 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-lg font-semibold tracking-[0.12em] text-text-primary">POJU</p>
              <p className="mt-1 text-sm text-text-secondary">pojulife.com</p>
              <div className="my-4 h-px bg-gradient-to-r from-transparent via-glass-border to-transparent" />
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
                <Link href="/" className="hover:text-text-primary">
                  Home
                </Link>
                <Link href="/disclaimer" className="hover:text-text-primary">
                  Disclaimer
                </Link>
                <Link href="/privacy" className="hover:text-text-primary">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-text-primary">
                  Terms of Service
                </Link>
                <Link href="/contact" className="hover:text-text-primary">
                  Contact
                </Link>
              </div>
              <p className="mt-4 text-center text-xs text-text-dim">© 2026 POJU. All rights reserved.</p>
              <p className="mt-2 text-center text-xs text-text-dim">
                For reflection and entertainment. POJU does not predict outcomes or replace professional advice.
              </p>
            </div>
          </footer>
        </div>
      </main>
    </MarketingLocaleProvider>
  );
}

// 3. 最终导出的入口组件，添加 Suspense 保护
export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <ContactContent />
    </Suspense>
  );
}