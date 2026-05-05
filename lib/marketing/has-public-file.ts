import fs from "node:fs";
import path from "node:path";

/** Server-only：检测 `public/` 下是否存在该路径（不含域名，以 `/` 开头）。 */
export function hasPublicFile(publicUrlPath: string): boolean {
  const clean = publicUrlPath.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", clean);
  try {
    return fs.existsSync(full) && fs.statSync(full).isFile();
  } catch {
    return false;
  }
}
