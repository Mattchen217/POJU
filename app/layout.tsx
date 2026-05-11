import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { EB_Garamond, Inter } from "next/font/google";
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

/** 移动端 / PWA：禁止手势缩放（与 manifest standalone 一致由同一文档加载） */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "pojulife",
  description:
    "Where AI meets a thousand years of wisdom. Decision support for the questions that won't let you go.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { url: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/pwa-icon?size=180", sizes: "180x180", type: "image/png" }],
    shortcut: ["/api/pwa-icon?size=192"],
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
      className={`${GeistSans.variable} ${inter.variable} ${garamond.variable} h-full antialiased notranslate`}
    >
      <head>
        <meta name="google" content="notranslate" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-full">
        <Providers>
          <div className="min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
