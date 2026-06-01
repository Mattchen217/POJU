"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLockup } from "@/components/marketing/brand-lockup";

const LEGAL_LINKS = [
  { href: "/disclaimer", key: "disclaimer" as const },
  { href: "/privacy", key: "privacy" as const },
  { href: "/terms", key: "terms" as const },
  { href: "/refund", key: "refund" as const },
  { href: "/cookies", key: "cookies" as const },
  { href: "/contact", key: "contact" as const },
] as const;

export function SiteFooter() {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const brandLabel = tCommon("brand");

  return (
    <footer className="marketing-footer mt-16 w-full px-4 py-8 md:mt-24 md:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <div className="flex flex-col items-center gap-2">
          <Link href="/" className="inline-flex" aria-label={brandLabel}>
            <BrandLockup label={brandLabel} size="footer" />
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-text-secondary">
          {LEGAL_LINKS.map(({ href, key }) => (
            <Link key={key} href={href} className="hover:text-text-primary">
              {tNav(key)}
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-text-dim">{tCommon("copyright")}</p>
        <p className="mt-2 text-center text-xs text-text-dim">{tCommon("footerTagline")}</p>
      </div>
    </footer>
  );
}
