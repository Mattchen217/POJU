import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/** Favicon / PWA mark — Eastern OS 3D gold E (LOGO1). */
export const POJU_LOGO_PATH = path.join(
  process.cwd(),
  "assets",
  "images",
  "EASTERN OS LOGO1.png",
);

export async function readPojuLogoDataUrl(): Promise<string> {
  const buf = await readFile(POJU_LOGO_PATH);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/**
 * Square PNG from LOGO1 (gold E mark) on black field.
 * Uses sharp so alpha/compositing is preserved — next/og ImageResponse flattens to opaque.
 */
export async function pojuLogoImageResponse(size: number) {
  const src = await readFile(POJU_LOGO_PATH);
  const png = await sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
