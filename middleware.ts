import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(es|zh|fr|de)/:path*",
    "/((?!api|_next|_vercel|oracle-test|oracle-fronts-preview|unsubscribe|.*\\..*).*)",
  ],
};
