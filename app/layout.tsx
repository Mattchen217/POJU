import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import {
  EB_Garamond,
  Inter,
  JetBrains_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { EARLY_BEFORE_INSTALL_PROMPT_SCRIPT } from "@/lib/pwa/early-before-install-prompt";

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

/** 移动端 / PWA：禁止手势缩放（与 manifest standalone 一致由同一文档加载） */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      { url: "/v2/LOGOE.png", type: "image/png" },
      { url: "/api/pwa-icon?size=32", sizes: "32x32", type: "image/png" },
      { url: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { url: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/v2/LOGOE.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/v2/LOGOE.png"],
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
        <link rel="apple-touch-icon" href="/v2/LOGOE.png" />
        <meta name="theme-color" content="#000000" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
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
        <div className="site-starry-bg" aria-hidden />
        <Providers>
          <div className="relative z-[1] min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
