import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/** Favicon / PWA mark — Eastern OS emblem (transparent background). */
export const POJU_LOGO_PATH = path.join(process.cwd(), "assets", "images", "LOGOE.png");

export async function readPojuLogoDataUrl(): Promise<string> {
  const buf = await readFile(POJU_LOGO_PATH);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/**
 * Square PNG from LOGOE with transparent field (no black plate).
 * Uses sharp so alpha is preserved — next/og ImageResponse flattens to opaque.
 */
export async function pojuLogoImageResponse(size: number) {
  const src = await readFile(POJU_LOGO_PATH);
  const png = await sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
