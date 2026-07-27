"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type Props = {
  className?: string;
};

/** Gold underlined usage-guide link under birth copy / collection form. */
export function WorkspaceUsageGuideLink({ className }: Props) {
  const t = useTranslations("workspace");
  return (
    <p className={`workspace-usage-guide${className ? ` ${className}` : ""}`}>
      <Link href="/#v2-faq" className="workspace-usage-guide__link" target="_top">
        {t("usageGuide")}
      </Link>
    </p>
  );
}
