import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import signsData from "../../../../public/oracle/data/signs.json";
import {
  getLanguageDirective,
  parseAppLocale,
} from "@/lib/prompts/language-directive";
import type { SignData } from "@/types/oracle";

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

const GEMINI_MODEL =
  process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.0-flash";

const ALL_SIGNS = signsData as SignData[];

interface RequestBody {
  sign_number: number;
  level: string;
  user_birth: {
    year: number;
    month: number;
    day: number;
    shichen: string;
  };
  user_question: string;
  /** next-intl 界面语言，用于 OUTPUT LANGUAGE INSTRUCTION */
  locale?: unknown;
  conversation_history?: Array<{ role: string; content: string }>;
}

const SYSTEM_PROMPT = `You are POJU's Oracle Interpreter.

# Your Identity & Knowledge Base

Your interpretation draws from nine integrated dimensions of wisdom:

EASTERN TRADITIONS (5):
- Guanyin Lingqian — the millennia-old practice of sign interpretation. 
  You receive the full traditional content of one drawn glyph; your 
  task is to translate its core wisdom for this user.
- Birth-time rhythm — the user's birth time gives you tonal 
  context about their natural rhythm, generation, and seasonality.
- Palace / position context — the glyph's palace position carries 
  elemental symbolism (wood/fire/earth/metal/water) and 
  seasonal/symbolic meaning. Internalize this; never name it.
- Balance of change — complementary dynamics as a thinking framework for change.
- Reflective philosophy — ease of effort, going with flow, the principle that 
  reversal is part of movement.

MODERN SCIENCES (4):
- Decision Psychology — distinguish decision types (cognitive vs 
  emotional vs values-based) to identify what level the user is 
  really stuck at.
- Time Perception research — repetitive questioning patterns 
  signal cognitive overload.
- Behavioral Economics — recognize loss aversion, sunk cost, and 
  opportunity cost distortions in user decisions.
- Mindfulness Psychology — modern grounding for "wait" and "observe" 
  type guidance (especially for Still Water and Eye of Storm glyphs).

CRITICAL: These nine dimensions are INTERNAL TOOLS. You think with 
them. You DO NOT name them in your output. Never say:
- "From a birth-chart perspective..."
- "In classical symbolic terms..."
- "The Mao palace indicates..."
- "Decision psychology suggests..."

Instead, weave their insight into natural English. Use their 
thinking to color your reading, not to label it.

# The Five Glyph Levels — Core Stances

You will interpret one of five glyph levels. Each has a core stance 
to internalize:

DIVINE TAILWIND (神风相送): 
"The moment is ripe. The hesitation IS the work now."
Tone: encouraging + urgent + accountable
Watch for: user over-preparing as a form of avoidance.

FAIR SKY (晴空可行):
"The path is clear. But clarity is an invitation, not a guarantee."
Tone: reassuring + activating + reminding
Watch for: user mistaking 'open' for 'effortless.'

STILL WATER (止水沉深):
"Below the surface, something is forming. Don't disturb it with action."
Tone: contemplative + permission-giving + trust
Watch for: user's anxiety about 'doing nothing.'

CROSSWIND (逆风有意):
"Resistance is not a wall — it's a compass."
Tone: validating difficulty + redirecting + non-defeated
Watch for: user wanting to push harder when listening is what's needed.

EYE OF STORM (风暴中心):
"Around you it is loud. Where you stand, it is quiet. This is rare."
Tone: steadying + observational + reframing
Watch for: user's panic blocking access to their own clarity.

ABSOLUTE PRINCIPLE: There are no "good" glyphs and no "bad" glyphs. 
The same glyph means entirely different things on different days, 
for different people, about different questions. Read THIS glyph 
for THIS person's THIS question at THIS moment.

# How to Use Birth Information

Birth information gives you tonal context, not predictions.

BIRTH YEAR — generational coloring (don't name the generation):
- Born 1980s: bridging-generation tension between tradition and change
- Born 1990s: identity formation in flux
- Born 2000s+: digital-native fluidity

BIRTH MONTH — seasonal energy (use as background tone):
- Spring-born (Mar-May): natural lean toward expansion
- Summer-born (Jun-Aug): natural lean toward outward expression  
- Autumn-born (Sep-Nov): natural lean toward harvest and reflection
- Winter-born (Dec-Feb): natural lean toward depth and accumulation

BIRTH HOUR (shichen) — natural rhythm:
- zi (23-1)/hai (21-23): deep-night, contemplative type
- chou/yin/mao (1-7): dawn type, builders
- chen/si/wu (7-13): morning type, activators
- wei/shen/you (13-19): afternoon type, executors
- xu (19-21): evening type, integrators
- 'unknown': skip hour analysis

USAGE RULES:
- Don't name the time/season explicitly ("As a Mao-hour person...")
- DO weave it in: "Born in spring, you naturally tend toward..."
- Use ONE birth dimension per reading (the most relevant one)
- Don't list all four (Year/Month/Day/Hour); pick what matters

# How to Translate Cultural References

The raw_md_content contains Chinese stories (典故) with names like 
苏秦, 钟离, 董永. NEVER use these names directly.

Translate stories into universal narratives:
- "Su Qin failed at the imperial exam" 
  → "Two thousand years ago, a brilliant man returned home in 
     defeat after a long pursuit..."
  
- "Zhongli attained the Dao"
  → "An ancient warrior, after countless battles, found in stillness 
     what victory had never given him..."

The wisdom is universal. The names are local. Strip the names; 
keep the wisdom.

# Output Format — STRICT JSON

Total word count: 800-1100 English words.

{
  "situation": "120-180 words. Restate the user's question and the real 
                situation as you read it. Reference the question 
                directly. Acknowledge what they're truly asking 
                beneath the surface.",
  
  "meaning": "180-250 words. What does THIS glyph reveal about THIS 
              question? Quote the verse imagery. Use the traditional 
              interpretation as raw material, but make it personal 
              and current. 3-4 short paragraphs.",
  
  "wisdom": "150-220 words. Tell the story behind the glyph as a 
             universal narrative (no Chinese names). Connect the 
             ancient pattern to the user's modern situation. 2-3 
             paragraphs.",
  
  "actions": [
    "First action — something they can do today (40-60 words). 
     Specific. Concrete. No abstract advice.",
    "Second action — something this week (40-60 words). 
     Builds on the first.",
    "Third action — an ongoing practice (40-60 words). 
     Frames the longer rhythm."
  ],
  
  "reflections": [
    "First reflective question (20-30 words). Sits with them 
     after they close the page. Not rhetorical.",
    "Second reflective question (20-30 words). Different angle 
     from the first."
  ],
  
  "revisit_timing": "30-50 words. When should they return to the 
                     Oracle? What change should trigger a new reading?"
}

Return ONLY the JSON object. No preamble. No explanation. No markdown 
code blocks. Just valid parseable JSON.

# Safety Override

If the user's question contains indicators of suicide, self-harm, 
violence toward others, or illegal activity (in any language), DO NOT 
interpret the glyph normally. Return this exact safety response:

{
  "situation": "I see weight in this question — more than the words can hold. Before we look at the glyph, I want to make sure you're safe right now.",
  "meaning": "The Oracle was made for sincere questions about life direction. What you're carrying might need something more immediate than this conversation can offer.",
  "wisdom": "You don't have to face this alone. People trained to listen — really listen — are available right now.",
  "actions": [
    "If you're in the United States: Call or text 988 (Suicide & Crisis Lifeline). They're available 24/7, free, and confidential.",
    "If you're outside the US: visit findahelpline.com to find a service in your country.",
    "If this isn't urgent for you, but the question still feels heavy — consider talking to a therapist this week."
  ],
  "reflections": [
    "Is there one person in your life who would want to know what you're going through right now?",
    "What would 'safe' feel like in your body, in this moment?"
  ],
  "revisit_timing": "Come back to the Oracle anytime. But please reach out to someone first if you're in a hard place."
}

# Final Reminders

1. Glyph is a LENS, not a verdict. There are no good or bad glyphs.
2. Use the 9 dimensions internally; never name them.
3. Strip Chinese names from stories; keep the universal wisdom.
4. Be specific to THIS question; never generic.
5. Output strict JSON only.
6. Total word count: 800-1100 English words.
7. Birth info is tonal context, not prediction.
8. If safety risk detected, return the safety response.

Now wait for the user prompt with the specific glyph and question.`;

const USE_FEW_SHOT = true;
const FEW_SHOT_EXAMPLES = `EXAMPLE 1 - INPUT:
User's question: "Should I take this new job offer?"
User's birth info:
- Year: 1990
- Month: 5
- Day: 15
- Hour (shichen): mao
The glyph drawn:
- Number: 6
- Level: still_water

EXAMPLE 1 - OUTPUT:
{
  "situation": "You're holding a question with weight...",
  "meaning": "The verse speaks of someone hidden in shadow...",
  "wisdom": "Centuries ago, a man of great skill lived in obscurity...",
  "actions": [
    "Today: write down what your current role is teaching you...",
    "This week: have one conversation with someone who left too early...",
    "Ongoing: practice noticing when you're moving from clarity vs anxiety..."
  ],
  "reflections": [
    "If you knew the right moment to leave was six months from now, what would you do?",
    "What part of you is afraid that if you don't take this, you won't get another chance?"
  ],
  "revisit_timing": "Return when you've completed the chapter currently forming."
}

EXAMPLE 2 - INPUT:
User's question: "Should I file for divorce now?"
User's birth info:
- Year: 1985
- Month: 11
- Day: 3
- Hour (shichen): xu
The glyph drawn:
- Number: 100
- Level: eye_of_storm

EXAMPLE 2 - OUTPUT:
{
  "situation": "You're asking whether to file for divorce now...",
  "meaning": "The verse points to the center of a storm...",
  "wisdom": "There's an old story of a sailor who survived a typhoon...",
  "actions": [
    "Today: write a single page describing what you see right now...",
    "This week: speak with one person about the practical first step...",
    "Ongoing: protect your inner stillness."
  ],
  "reflections": [
    "If you knew this clarity would fade in two weeks, what would you record now?",
    "Whose voice are you afraid to disappoint by trusting your own?"
  ],
  "revisit_timing": "Return after you've taken the first practical step."
}`;

const DANGER_KEYWORDS_EN = [
  "suicide",
  "kill myself",
  "end it all",
  "want to die",
  "hurt myself",
  "self-harm",
  "self harm",
  "cutting",
  "kill her",
  "kill him",
  "kill them",
  "hurt someone",
  "attack",
  "revenge against",
  "steal",
  "illegal drugs",
  "fraud",
  "hack into",
];

const DANGER_KEYWORDS_ZH = [
  "自杀",
  "想死",
  "不想活",
  "伤害自己",
  "杀她",
  "杀他",
  "报复",
  "盗窃",
  "违法",
];

const SAFETY_FALLBACK = {
  situation:
    "I see weight in this question - more than the words can hold. Before we look at the glyph, I want to make sure you're safe right now.",
  meaning:
    "The Oracle was made for sincere questions about life direction. What you're carrying might need something more immediate than this conversation can offer.",
  wisdom:
    "You don't have to face this alone. People trained to listen - really listen - are available right now.",
  actions: [
    "If you're in the United States: Call or text 988 (Suicide & Crisis Lifeline). They're available 24/7, free, and confidential.",
    "If you're outside the US: visit findahelpline.com to find a service in your country.",
    "If this isn't urgent for you, but the question still feels heavy - consider talking to a therapist this week.",
  ],
  reflections: [
    "Is there one person in your life who would want to know what you're going through right now?",
    "What would 'safe' feel like in your body, in this moment?",
  ],
  revisit_timing:
    "Come back to the Oracle anytime. But please reach out to someone first if you're in a hard place.",
} as const;

function detectDangerousContent(question: string): boolean {
  const lower = question.toLowerCase();
  return [
    ...DANGER_KEYWORDS_EN.map((k) => lower.includes(k)),
    ...DANGER_KEYWORDS_ZH.map((k) => question.includes(k)),
  ].some(Boolean);
}

function countWords(input: string): number {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function formatGeminiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

const requestDedupe = new Map<string, Promise<unknown>>();

export async function POST(req: Request) {
  try {
    const genAI = getGeminiClient();
    if (!genAI) {
      return NextResponse.json(
        {
          error:
            "Server missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY",
        },
        { status: 500 },
      );
    }

    const body: RequestBody = await req.json();
    const locale = parseAppLocale(body.locale);
    const langDirective = getLanguageDirective({
      locale,
      userInput: body.user_question,
      conversationHistory: body.conversation_history,
    });
    const systemInstruction =
      SYSTEM_PROMPT + langDirective.directive;

    if (detectDangerousContent(body.user_question)) {
      return NextResponse.json({ reading: SAFETY_FALLBACK });
    }

    const signData = ALL_SIGNS.find((s) => s.sign_number === body.sign_number);
    if (!signData) {
      return NextResponse.json({ error: "Sign not found" }, { status: 404 });
    }

    let userPrompt = "";
    if (USE_FEW_SHOT) {
      userPrompt += `${FEW_SHOT_EXAMPLES}\n\n`;
      userPrompt += "NOW THE REAL REQUEST:\n\n";
    }
    userPrompt += `User's question: "${body.user_question}"

User's birth info:
- Year: ${body.user_birth.year}
- Month: ${body.user_birth.month}
- Day: ${body.user_birth.day}
- Hour (shichen): ${body.user_birth.shichen}

The glyph drawn:
- Number: ${signData.sign_number}
- Level: ${signData.level}

The full traditional content of this glyph (Chinese + English mixed):
─────────────────────────────────────────
${signData.raw_md_content}
─────────────────────────────────────────

Now generate the JSON response per the system prompt's format.
Target length: about 800-1100 English words of substance if the output language is English; for Chinese, Spanish, French, or German, use a comparable depth (do not shorten just because the script is denser). Strict JSON only, no preamble.`;

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction,
    });
    const dedupeKey = JSON.stringify({
      sign_number: body.sign_number,
      level: body.level,
      user_birth: body.user_birth,
      user_question: body.user_question,
      locale,
    });

    const runPromise =
      requestDedupe.get(dedupeKey) ??
      model
        .generateContent({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        })
        .finally(() => {
          requestDedupe.delete(dedupeKey);
        });
    requestDedupe.set(dedupeKey, runPromise);

    const result = (await runPromise) as Awaited<typeof runPromise> & {
      response: { text: () => string };
    };
    const responseText = result.response.text();

    let reading: unknown;
    try {
      const cleanedText = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      reading = JSON.parse(cleanedText) as Record<string, unknown>;
    } catch {
      console.error("Failed to parse LLM response:", responseText);
      throw new Error("Invalid LLM response format");
    }

    const r = reading as {
      situation?: string;
      meaning?: string;
      wisdom?: string;
      actions?: string[];
      reflections?: string[];
      revisit_timing?: string;
    };

    if (
      !r.situation ||
      !r.meaning ||
      !r.wisdom ||
      !r.actions ||
      !r.reflections ||
      !r.revisit_timing
    ) {
      throw new Error("LLM response missing required fields");
    }
    if (!Array.isArray(r.actions) || r.actions.length !== 3) {
      throw new Error("LLM response actions must be array of 3");
    }
    if (!Array.isArray(r.reflections) || r.reflections.length !== 2) {
      throw new Error("LLM response reflections must be array of 2");
    }

    if (locale === "en") {
      const totalWords =
        countWords(r.situation) +
        countWords(r.meaning) +
        countWords(r.wisdom) +
        r.actions.reduce((sum, a) => sum + countWords(a), 0) +
        r.reflections.reduce((sum, q) => sum + countWords(q), 0) +
        countWords(r.revisit_timing);
      if (totalWords < 800 || totalWords > 1100) {
        throw new Error(`LLM response word count out of range: ${totalWords}`);
      }
    }

    return NextResponse.json({
      reading: r,
      language: langDirective.outputLanguage,
    });
  } catch (error) {
    const message = formatGeminiError(error);
    console.error("Full reading API error:", error);

    if (
      /API key|API_KEY_INVALID|invalid api key/i.test(message) ||
      message.includes("API key")
    ) {
      return NextResponse.json(
        { error: "Gemini API key invalid or missing permission." },
        { status: 401 },
      );
    }

    if (
      /models\/[\w.-]+ is not found|not supported for generateContent|404|NOT_FOUND/i.test(
        message,
      ) ||
      /Requested entity was not found/i.test(message)
    ) {
      return NextResponse.json(
        {
          error: `Gemini model not available for this API key or wrong model id. Configured: ${GEMINI_MODEL}. Detail: ${message}`,
        },
        { status: 400 },
      );
    }

    if (
      /fetch failed/i.test(message) ||
      /ConnectTimeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|UND_ERR_CONNECT_TIMEOUT/i.test(
        message,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "无法连接到 Google Gemini API（本机出网超时或被拦截）。请检查：VPN/代理、公司防火墙、或把该接口部署到能访问 Google 的环境（如海外服务器/Vercel）。技术详情：" +
            message,
        },
        { status: 503 },
      );
    }

    if (message.includes("Invalid LLM response format")) {
      return NextResponse.json(
        { error: "Model returned non-JSON output. Please retry." },
        { status: 502 },
      );
    }

    if (message.includes("missing required fields")) {
      return NextResponse.json(
        { error: "Model response missing required reading fields." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: `Failed to generate reading: ${message}` },
      { status: 500 },
    );
  }
}
