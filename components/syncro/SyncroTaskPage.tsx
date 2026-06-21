"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { useRouter } from "@/i18n/navigation";

/**
 * Deprecated standalone task page — flow merged into /syncro/prepare.
 */
export function SyncroTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/syncro/prepare?${qs}` : "/syncro/prepare");
  }, [router, searchParams]);

  return null;
}
