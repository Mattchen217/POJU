import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import withSerwistInit from "@serwist/next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // 在开发环境下禁用 Serwist 以避免 Turbopack 冲突
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

export default withSerwist(nextConfig);
