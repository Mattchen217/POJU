/**
 * Live listen probe: OpenRouter Kokoro-82M — professional report-broadcast samples.
 *
 * Run:
 *   pnpm exec tsx scripts/probe-kokoro-tts-listen.ts
 *   pnpm exec tsx scripts/probe-kokoro-tts-listen.ts --lang=en|es|fr|zh
 *
 * 中文主播向试听（男声成熟 + 女声对照）:
 *   pnpm exec tsx scripts/probe-kokoro-tts-listen.ts --zh-anchor
 *   pnpm exec tsx scripts/probe-kokoro-tts-listen.ts --zh-bakeoff --speed=1.15
 *
 * Output: tmp/kokoro-listen/*.mp3
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "tmp/kokoro-listen");
const MODEL = "hexgrad/kokoro-82m";
const SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

/** Default broadcast-leaning voices. */
const VOICE = {
  en: "af_heart",
  es: "ef_dora",
  fr: "ff_siwis",
  /**
   * 中文：Kokoro 女声（xiaoyi/xiaobei…）普遍幼/幼师感。
   * 新闻主播/成熟向先用男声 zm_yunxi（稳）/ zm_yunyang（沉）。
   */
  zh: "zm_yunyang",
} as const;

/** 中文成熟向试听（女幼声对比 + 男主播向）。 */
const ZH_ANCHOR_VOICES = [
  "zm_yunxi",
  "zm_yunyang",
  "zm_yunjian",
  "zm_yunxia",
  "zf_xiaoyi",
] as const;

const ZH_FEMALE_VOICES = ["zf_xiaoyi", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaobei"] as const;

type Lang = "en" | "es" | "fr" | "zh";

type Sample = {
  id: string;
  lang: Lang;
  voice: string;
  role: "body";
  text: string;
  /** Slight speed bump for 专业播报（上游若不支持则忽略） */
  speed?: number;
};

const BROADCAST_SAMPLES: Sample[] = [
  {
    id: "broadcast-en",
    lang: "en",
    voice: VOICE.en,
    role: "body",
    speed: 1.05,
    text:
      "According to our latest mid-year market intelligence report, global enterprise spending on artificial intelligence infrastructure reached 4.2 billion dollars in the second quarter of 2026, representing an 18.5% increase year-over-year. While short-term macroeconomic volatility continues to pressure traditional IT budgets, decision-makers are aggressively reprioritizing capital toward predictive analytics and automated workflow engines. Over the next eighteen months, organizations that successfully integrate these tools into core operations are projected to outperform industry benchmarks by at least 12% in operational efficiency.",
  },
  {
    id: "broadcast-es",
    lang: "es",
    voice: VOICE.es,
    role: "body",
    speed: 1.05,
    text:
      "De acuerdo con nuestro último informe de inteligencia de mercado de mitad de año, el gasto global de las empresas en infraestructura de inteligencia artificial alcanzó los 4.200 millones de dólares en el segundo trimestre de 2026, lo que representa un incremento del 18,5% en comparación con el año anterior. Aunque la volatilidad macroeconómica a corto plazo sigue presionando los presupuestos tradicionales de tecnología, los ejecutivos están redirigiendo el capital de forma agresiva hacia el análisis predictivo. Se prevé que las organizaciones que adopten estas tecnologías superen el promedio del sector en más de un 12% durante los próximos dieciocho meses.",
  },
  {
    id: "broadcast-fr",
    lang: "fr",
    voice: VOICE.fr,
    role: "body",
    speed: 1.05,
    text:
      "Selon notre dernier rapport d'intelligence stratégique de milieu d'année, les dépenses mondiales des entreprises dans les infrastructures d'intelligence artificielle ont atteint 4,2 milliards de dollars au deuxième trimestre 2026, soit une hausse de 18,5 % sur un an. Malgré la volatilité macroéconomique à court terme qui pèse sur les budgets informatiques traditionnels, les dirigeants réorientent massivement leurs capitaux vers l'analyse prédictive. Au cours des dix-huit prochains mois, les entreprises qui intégreront efficacement ces technologies devraient dépasser les performances de leur secteur d'au moins 12 %.",
  },
  {
    id: "broadcast-zh",
    lang: "zh",
    voice: VOICE.zh,
    role: "body",
    /** 中文默认略提速，减轻「慢放」感 */
    speed: 1.15,
    text:
      "根据我们最新的年中综合分析报告，2026年第二季度，全球企业在人工智能基础设施领域的资本支出达到了42亿美元，同比大幅增长18.5%。尽管短期内的宏观经济波动仍在对传统IT预算造成一定压力，但多数商业决策者正积极将资金转向智能化分析与自动化流程再造。展望未来18个月，能够率先实现这些技术深度融合的企业，预计将在运营效率和市场响应速度上领先同行至少12个百分点。",
  },
];

const ZH_BAKEOFF_TEXT = BROADCAST_SAMPLES.find((s) => s.lang === "zh")!.text;

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgNumber(prefix: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const n = Number(arg.slice(prefix.length));
  if (!Number.isFinite(n) || n < 0.5 || n > 2) {
    console.error(`${prefix} must be between 0.5 and 2`);
    process.exit(1);
  }
  return n;
}

function buildZhBakeoff(speed: number): Sample[] {
  return ZH_FEMALE_VOICES.map((voice) => ({
    id: `bakeoff-zh-${voice}`,
    lang: "zh" as const,
    voice,
    role: "body" as const,
    speed,
    text: ZH_BAKEOFF_TEXT,
  }));
}

function buildZhAnchor(speed: number): Sample[] {
  return ZH_ANCHOR_VOICES.map((voice) => ({
    id: `anchor-zh-${voice}`,
    lang: "zh" as const,
    voice,
    role: "body" as const,
    speed,
    text: ZH_BAKEOFF_TEXT,
  }));
}

async function synthesize(
  sample: Sample,
  apiKey: string,
  speedOverride?: number,
): Promise<{ bytes: number; ms: number }> {
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://easternos.com";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Pojulife";
  const speed = speedOverride ?? sample.speed;

  const payload: Record<string, unknown> = {
    model: MODEL,
    input: sample.text,
    voice: sample.voice,
    response_format: "mp3",
  };
  if (typeof speed === "number") {
    payload.speed = speed;
  }

  const t0 = Date.now();
  const res = await fetch(SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": title,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`${sample.id} HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 64) {
    throw new Error(`${sample.id} empty/tiny audio (${buf.byteLength} bytes)`);
  }

  const speedTag =
    typeof speed === "number" ? `__spd${String(speed).replace(".", "p")}` : "";
  const file = resolve(OUT_DIR, `${sample.id}__${sample.voice}${speedTag}.mp3`);
  writeFileSync(file, buf);
  return { bytes: buf.byteLength, ms: Date.now() - t0 };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error("missing OPENROUTER_API_KEY — add to .env.local");
    process.exit(1);
  }

  const speedOverride = parseArgNumber("--speed=");
  const bakeoff = process.argv.includes("--zh-bakeoff");
  const zhAnchor = process.argv.includes("--zh-anchor");
  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const langFilter = langArg?.slice("--lang=".length).toLowerCase() as Lang | undefined;

  let samples: Sample[];
  if (zhAnchor) {
    samples = buildZhAnchor(speedOverride ?? 1.1);
  } else if (bakeoff) {
    samples = buildZhBakeoff(speedOverride ?? 1.15);
  } else if (langFilter) {
    samples = BROADCAST_SAMPLES.filter((s) => s.lang === langFilter);
  } else {
    samples = BROADCAST_SAMPLES;
  }

  if (samples.length === 0) {
    console.error(`no samples (lang=en|es|fr|zh)`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`model=${MODEL} · broadcast sample pack`);
  console.log(`out=${OUT_DIR}`);
  console.log(
    `clips=${samples.length}${zhAnchor ? " zh-anchor" : ""}${bakeoff ? " zh-bakeoff" : ""}${
      langFilter ? ` lang=${langFilter}` : ""
    }${typeof speedOverride === "number" ? ` speed=${speedOverride}` : ""}`,
  );
  console.log("---");

  let fail = 0;
  for (const sample of samples) {
    const spd = speedOverride ?? sample.speed;
    process.stdout.write(
      `[${sample.id}] ${sample.lang}/${sample.voice}${spd ? `@${spd}` : ""} … `,
    );
    try {
      const { bytes, ms } = await synthesize(sample, apiKey, speedOverride);
      console.log(`ok ${bytes}B ${ms}ms`);
    } catch (e) {
      fail += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`FAIL\n  ${msg}`);
    }
  }

  console.log("---");
  console.log(fail === 0 ? "done ok" : `done with ${fail} fail(s)`);
  console.log(`Play: ${OUT_DIR}`);
  console.log(
    "ZH default=zm_yunxi（男·稳）；--zh-anchor 含 yunxi/yunyang/yunjian/yunxia + xiaoyi 对照。Kokoro 无真正中年女声。",
  );
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
