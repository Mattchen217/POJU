import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

function parseSize(input: string | null): number {
  const n = Number(input ?? "512");
  if (!Number.isFinite(n)) return 512;
  if (n <= 64) return 64;
  if (n >= 1024) return 1024;
  return Math.round(n);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const size = parseSize(url.searchParams.get("size"));

  const filePath = path.join(process.cwd(), "assets", "images", "POJUlogo.png");
  const buf = await readFile(filePath);
  const base64 = buf.toString("base64");
  const src = `data:image/png;base64,${base64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <img
          src={src}
          alt="POJU icon"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}

