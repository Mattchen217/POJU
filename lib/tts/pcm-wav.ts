/**
 * Shared PCM → WAV (browser + Node). 16-bit little-endian.
 */

export const DEFAULT_PCM_RATE = 24_000;
export const DEFAULT_PCM_CHANNELS = 1;

export function parsePcmContentType(contentType: string | null | undefined): {
  rate: number;
  channels: number;
} {
  const ct = contentType || "";
  const rateMatch = /rate=(\d+)/i.exec(ct);
  const chMatch = /channels=(\d+)/i.exec(ct);
  const rate = rateMatch ? Number(rateMatch[1]) : DEFAULT_PCM_RATE;
  const channels = chMatch ? Number(chMatch[1]) : DEFAULT_PCM_CHANNELS;
  return {
    rate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_PCM_RATE,
    channels: Number.isFinite(channels) && channels > 0 ? channels : DEFAULT_PCM_CHANNELS,
  };
}

export function concatUint8(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

/** Wrap PCM bytes as a WAV container (header needs final size). */
export function pcmToWavBytes(
  pcm: Uint8Array,
  sampleRate = DEFAULT_PCM_RATE,
  channels = DEFAULT_PCM_CHANNELS,
  bitsPerSample = 16,
): Uint8Array {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;
  const out = new Uint8Array(44 + dataSize);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i);
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  out.set(pcm, 44);
  return out;
}
