import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

import { BrandLockup } from "@/components/marketing/brand-lockup";

export async function MarketingLogoLink({
  size = "subpage",
  className,
}: {
  size?: "header" | "subpage";
  className?: string;
}) {
  const t = await getTranslations("common");
  const brand = t("brand");
  return (
    <Link href="/" className={`inline-flex min-w-0 items-center ${className ?? ""}`} aria-label={`${brand} — ${t("domain")}`}>
      <BrandLockup label={brand} size={size} />
    </Link>
  );
}
