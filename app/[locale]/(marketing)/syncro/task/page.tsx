import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SyncroTaskPage } from "@/components/syncro/SyncroTaskPage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("syncro.task");
  return {
    title: `${t("title")} — Syncro`,
    description: t("subtitle"),
  };
}

export default function SyncroTaskRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-deep text-text-secondary">
          …
        </div>
      }
    >
      <SyncroTaskPage />
    </Suspense>
  );
}
