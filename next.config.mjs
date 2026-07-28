import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 绝对路径，避免 Turbopack / Windows 下相对 `resolveAlias` 未指向仓库内 `i18n/request.ts` 而落到 next-intl 占位模块 */
const nextIntlRequestConfig = path.resolve(__dirname, "i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // 在开发环境下禁用 Serwist 以避免 Turbopack 冲突
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Keep sharp as a native Node package — webpack must not try to resolve
   * optional platform stubs like `@img/sharp-wasm32` during the Vercel build.
   */
  serverExternalPackages: ["sharp"],
  /**
   * Allow LAN-origin dev resources (HMR/chunks) when opening the site on phones
   * via http://192.168.31.197:3000 during local development.
   */
  allowedDevOrigins: ["192.168.31.197", "localhost", "127.0.0.1"],
  // 便于在 VPS / Docker 用「单进程 + 小 node_modules」部署
  output: "standalone",
  /**
   * Windows：终端 cwd 与编辑器打开路径大小写不一致（如 pojulife vs POJULIFE）时，
   * Webpack 会把同一物理目录当成两套模块，Next/React 加载两份 → App Router 报错
   * 「invariant expected layout router to be mounted」。统一解析到真实路径。
   */
  webpack: (config, { dir }) => {
    try {
      const root = realpathSync.native(dir || __dirname);
      config.context = root;
      config.resolve.modules = [path.join(root, "node_modules"), ...(config.resolve.modules || []).filter(Boolean)];
    } catch {
      /* ignore */
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/api/pwa-icon?size=32",
        permanent: false,
      },
      {
        source: "/oracle",
        destination: "/glyph",
        permanent: true,
      },
      {
        source: "/oracle/reading",
        destination: "/glyph/reading",
        permanent: true,
      },
      {
        source: "/oracle/stage-1",
        destination: "/glyph/stage-1",
        permanent: true,
      },
    ];
  },
};

const mergedConfig = withNextIntl(withSerwist(nextConfig));

/** @type {import('next').NextConfig} */
const finalConfig = {
  ...mergedConfig,
  turbopack: {
    ...mergedConfig.turbopack,
    resolveAlias: {
      ...mergedConfig.turbopack?.resolveAlias,
      "next-intl/config": nextIntlRequestConfig,
    },
  },
};

if (typeof mergedConfig.webpack === "function") {
  const previousWebpack = mergedConfig.webpack;
  finalConfig.webpack = (config, options) => {
    const out = previousWebpack(config, options);
    out.resolve ||= {};
    out.resolve.alias = {
      ...out.resolve.alias,
      "next-intl/config": nextIntlRequestConfig,
    };
    return out;
  };
}

export default finalConfig;
