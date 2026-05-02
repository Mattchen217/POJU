/**
 * 将 `assets/images` 中的五风卡面 PNG 复制到 `public/oracle/wind-cards/`，
 * 产出无空格的文件名，供抽签动效、内容卡片等用 URL 引用。
 *
 * 用法（在 pojulife 目录）: pnpm copy:oracle-wind-cards
 *
 * 若仍为 0 个文件：请先把 5 张 PNG 放进 `assets/images/`（以下任一文件名命中即可）。
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "assets", "images");
const outDir = path.join(root, "public", "oracle", "wind-cards");

/** [输出文件名, 允许的源文件名列表（先试第一个匹配的）] */
const jobs = [
  ["crosswind.png", ["crosswind.png", "crosswind1.png"]],
  ["divine-tailwind.png", ["divine tailwind.png", "divine tailwind1.png", "divine-tailwind.png"]],
  ["eye-of-storm.png", ["eye of storm.png", "eye of storm1.png", "eye-of-storm.png"]],
  ["fair-sky.png", ["fair sky.png", "fair sky1.png", "fair-sky.png"]],
  ["still-water.png", ["still water.png", "still water1.png", "still-water.png"]],
];

fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const [destName, candidates] of jobs) {
  let srcPath = null;
  for (const name of candidates) {
    const p = path.join(assetsDir, name);
    if (fs.existsSync(p)) {
      srcPath = p;
      break;
    }
  }
  const dest = path.join(outDir, destName);
  if (!srcPath) {
    console.warn(
      `[copy-oracle-wind-cards] 跳过（未找到源）: ${destName} ← 试过: ${candidates.join(", ")}`,
    );
    continue;
  }
  fs.copyFileSync(srcPath, dest);
  ok += 1;
  console.log(`[copy-oracle-wind-cards] ${path.basename(srcPath)} → ${destName}`);
}

if (ok === 0) {
  console.warn(
    "\n[copy-oracle-wind-cards] 未复制任何文件。\n" +
      "请把 5 张 PNG 放到: " +
      assetsDir +
      "\n然后再执行: pnpm copy:oracle-wind-cards\n",
  );
}
