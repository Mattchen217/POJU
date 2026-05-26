import { getRequestConfig } from "next-intl/server";

import { loadLocaleMessages } from "@/lib/i18n/load-locale-messages";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: await loadLocaleMessages(locale),
  };
});
