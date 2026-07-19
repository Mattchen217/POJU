/** Decode data URL or raw base64 to Buffer. */
export function decodeAttachmentDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  const trimmed = dataUrl.trim();
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (m) {
    return { buffer: Buffer.from(m[2], "base64"), mime: m[1].trim() };
  }
  return { buffer: Buffer.from(trimmed, "base64"), mime: "application/octet-stream" };
}

export function estimateDecodedBytes(dataUrl: string): number {
  const trimmed = dataUrl.trim();
  const idx = trimmed.indexOf("base64,");
  const b64 = idx >= 0 ? trimmed.slice(idx + 7) : trimmed;
  return Math.floor((b64.length * 3) / 4);
}
