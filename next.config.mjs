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
  // 强制指定使用 webpack 避免 Turbopack 自动开启
  transpilePackages: ["three"], 
  
  webpack(config) {
    // 兼容 GLSL
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: "asset/source",
    });
    return config;
  },
};

export default withSerwist(nextConfig);