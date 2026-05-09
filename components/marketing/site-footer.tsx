"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getFooterDisclaimerKeyFromPathname } from "@/lib/i18n/pathname-without-locale";
import { BrandLockup } from "@/components/marketing/brand-lockup";

export function SiteFooter() {
  const pathname = usePathname();
  const disclaimerKey = getFooterDisclaimerKeyFromPathname(pathname);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tFooter = useTranslations("marketingSite.footer");
  const brandLabel = tCommon("brand").replace(/^p/, "P");

  const tagline = disclaimerKey ? tFooter(`disclaimers.${disclaimerKey}`) : tCommon("footerTagline");

  return (
    <footer className="mt-16 w-full px-4 py-8 md:mt-24 md:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <div className="flex justify-center">
          <Link href="/" className="inline-flex" aria-label={`${brandLabel} — ${tCommon("domain")}`}>
            <BrandLockup label={brandLabel} size="footer" />
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
          <Link href="/disclaimer" className="hover:text-text-primary">
            {tNav("disclaimer")}
          </Link>
          <Link href="/privacy" className="hover:text-text-primary">
            {tNav("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-text-primary">
            {tNav("terms")}
          </Link>
          <Link href="/contact" className="hover:text-text-primary">
            {tNav("contact")}
          </Link>
        </div>
        <p className="mt-5 text-center text-xs text-text-dim">{tCommon("copyright")}</p>
        <p className="mt-2 text-center text-xs text-text-dim">{tagline}</p>
      </div>
    </footer>
  );
}
