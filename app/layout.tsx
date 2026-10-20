import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import {
  EB_Garamond,
  Inter,
  JetBrains_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { EARLY_BEFORE_INSTALL_PROMPT_SCRIPT } from "@/lib/pwa/early-before-install-prompt";
import { SiteStarryBackground } from "@/components/layout/site-starry-background";

/**
 * Site typography SSOT (see `.cursor/rules/10-site-typography.mdc`):
 * UI = Geist → Inter → Noto Sans SC; verse = EB Garamond; mono = JetBrains;
 * CJK logo/ritual = Noto Serif SC. Prefer next/font over runtime Google CSS.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin", "latin-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
});

/** Large CJK — swap + no preload to protect first paint */
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** Allow pinch-zoom for a11y / Lighthouse (maximum-scale >= 5). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#07091A",
};

export const metadata: Metadata = {
  title: "Eastern OS",
  applicationName: "Eastern OS",
  description:
    "Where AI meets a thousand years of wisdom. Decision support for the questions that won't let you go.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/v2/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/v2/EASTERN-OS-LOGO1.png", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/api/pwa-icon?size=32", sizes: "32x32", type: "image/png" },
      { url: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { url: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/v2/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/v2/EASTERN-OS-LOGO1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      translate="no"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${inter.variable} ${garamond.variable} ${jetbrainsMono.variable} ${notoSansSC.variable} ${notoSerifSC.variable} h-full antialiased notranslate`}
    >
      <head>
        <meta name="google" content="notranslate" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Eastern OS" />
        <link rel="apple-touch-icon" href="/v2/apple-touch-icon.png" />
        <meta name="theme-color" content="#000000" />
        {/* Material Symbols: non-blocking (print→all) so icon CSS does not delay LCP */}
        <link
          id="eos-material-symbols"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          media="print"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.getElementById('eos-material-symbols');if(!l)return;var go=function(){l.media='all'};if(l.sheet)go();else l.addEventListener('load',go);})();`,
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          />
        </noscript>
        {/* Before React: default V2 shell + avoid classic chrome flash on home */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='poju.uiShell',m='poju.uiShell.defaultV2';if(!localStorage.getItem(m)){localStorage.setItem(k,'workspace');localStorage.setItem(m,'1');}var s=localStorage.getItem(k)||'workspace';document.documentElement.setAttribute('data-ui-shell',s);}catch(e){document.documentElement.setAttribute('data-ui-shell','workspace');}})();`,
          }}
        />
        {/* Capture beforeinstallprompt before React mounts — required for one-tap Install CTA */}
        <script
          dangerouslySetInnerHTML={{ __html: EARLY_BEFORE_INSTALL_PROMPT_SCRIPT }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <Suspense fallback={null}>
          <SiteStarryBackground />
        </Suspense>
        <Providers>
          <div className="relative z-[1] min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
