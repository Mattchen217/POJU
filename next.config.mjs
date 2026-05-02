import withSerwistInit from "@serwist/next";

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
