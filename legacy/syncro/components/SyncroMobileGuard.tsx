"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { canUseSyncro, detectDeviceCapability } from "@/lib/syncro/device-capability";

type SyncroMobileGuardProps = {
  children: ReactNode;
};

/**
 * Blocks desktop browsers from Syncro feature routes; redirects to marketing home.
 */
export function SyncroMobileGuard({ children }: SyncroMobileGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("syncro");

  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    void detectDeviceCapability().then((cap) => {
      if (canUseSyncro(cap)) {
        setAllowed(true);
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.set("desktop", "true");
        const qs = params.toString();
        router.replace(qs ? `/syncro?${qs}` : "/syncro?desktop=true");
      }
    });
  }, [router, searchParams]);

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-deep text-text-secondary">
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
