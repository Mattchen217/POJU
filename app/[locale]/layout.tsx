import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { PWAInstallGate } from "@/components/pwa/PWAInstallGate";
import { PwaAppShell } from "@/components/pwa/PwaAppShell";
import { PwaModeBootstrap } from "@/components/pwa/PwaModeBootstrap";
import { SiteChrome } from "@/components/marketing/site-chrome";
import { routing } from "@/i18n/routing";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <PWAInstallGate>
        <PwaModeBootstrap />
        <PwaAppShell>
          <SiteChrome>{children}</SiteChrome>
        </PwaAppShell>
      </PWAInstallGate>
    </NextIntlClientProvider>
  );
}
