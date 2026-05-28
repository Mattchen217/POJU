"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { POJUChatUI } from "@/components/poju/POJUChatUI";
import { usePojuFromToolJoin } from "@/components/poju/use-poju-from-tool-join";
import type { POJUSessionState } from "@/lib/poju/types";

type Props = {
  session: POJUSessionState;
  locale: string;
  onSessionUpdate: (s: POJUSessionState) => void;
  onReload: () => void;
};

function Inner({ session, locale, onSessionUpdate, onReload }: Props) {
  const t = useTranslations("cross_product.from_tool_entry");
  const { joiningFromTool } = usePojuFromToolJoin(session.session_id, onReload);

  if (joiningFromTool) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-white/70">{t("joining")}</main>
    );
  }

  return <POJUChatUI session={session} onSessionUpdate={onSessionUpdate} locale={locale} />;
}

export function PojuSessionChatShell(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[50vh] items-center justify-center text-white/70">Loading...</main>
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}
