/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 在 `pnpm build` 后，将 public 与 .next/static 复制到 standalone 输出目录并启动服务。
 * 用于 Vultr 等无 Docker 的轻量部署；绑定 0.0.0.0 以便用公网 IP 访问。
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const publicDir = path.join(root, "public");
const staticDir = path.join(root, ".next", "static");
const serverJs = path.join(standalone, "server.js");

if (!fs.existsSync(standalone) || !fs.existsSync(serverJs)) {
  console.error("未找到 .next/standalone，请先执行: pnpm build");
  process.exit(1);
}

const destPublic = path.join(standalone, "public");
const destNext = path.join(standalone, ".next");
const destStatic = path.join(destNext, "static");

fs.mkdirSync(destNext, { recursive: true });
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, destPublic, { recursive: true, force: true });
}
if (fs.existsSync(staticDir)) {
  fs.mkdirSync(path.dirname(destStatic), { recursive: true });
  fs.cpSync(staticDir, destStatic, { recursive: true, force: true });
}

const port = process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";

const child = spawn(process.execPath, [serverJs], {
  cwd: standalone,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: host,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
