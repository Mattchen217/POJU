import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { EB_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** UI：Geist Sans 为主，Inter 作回退（与建议一致） */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
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
      className={`${GeistSans.variable} ${inter.variable} ${garamond.variable} ${jetbrainsMono.variable} h-full antialiased notranslate`}
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
