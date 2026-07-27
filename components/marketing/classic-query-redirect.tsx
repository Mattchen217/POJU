"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { useRouter } from "@/i18n/navigation";

/**
 * Back-compat: `/?ui=classic` used to swap the home tree.
 * Classic marketing now lives at `/classic`.
 */
function ClassicQueryRedirectInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ui = (searchParams.get("ui") ?? "").trim().toLowerCase();
    if (ui === "classic" || ui === "marketing" || ui === "0" || ui === "false") {
      router.replace("/classic");
    }
  }, [searchParams, router]);

  return null;
}

export function ClassicQueryRedirect() {
  return (
    <Suspense fallback={null}>
      <ClassicQueryRedirectInner />
    </Suspense>
  );
}
