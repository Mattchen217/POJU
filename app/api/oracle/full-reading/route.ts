import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import signsData from "../../../../public/oracle/data/signs.json";
import {
  getLanguageDirective,
  parseAppLocale,
} from "@/lib/prompts/language-directive";
import { calculateProfile } from "@/lib/calculations";
import { legacyFormToBirthInfo } from "@/lib/profile/birth-info-utils";
import { isOpenRouterConfigured, openRouterChatCompletion } from "@/lib/llm/openrouter-shared";
import type { SignData } from "@/types/oracle";

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

function normalizeGeminiModelId(modelId: string): string {
  const normalized = modelId.trim();
  // Google's model ids may require preview/latest suffixes in v1beta.
  if (normalized === "gemini-3-flash") return "gemini-3-flash-preview";
  return normalized;
}

const GEMINI_MODEL = normalizeGeminiModelId(
  process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-3-flash-preview",
);
const GEMINI_FALLBACK_MODELS = [
  "gemini-3-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

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

function createInvalidInputReading(
  question: string,
  locale: string,
): {
  wind_category_blurb: string;
  classical_voice: string;
  meaning_for_question: string;
  hidden_tension: string;
  your_moment: string;
  exploration: {
    text: string;
    timeframe: "today";
    duration_estimate: "5 minutes";
    is_solo: true;
  };
  reflection_question: string;
  invalid_input: true;
} {
  const q = question.trim() || "(empty input)";
  const message =
    locale === "zh"
      ? `我收到了你的输入「${q}」，但目前无法识别为一个可解读的真实问题。请用一两句话清楚描述你当下真实的处境与困惑后再试。`
      : `I received your input "${q}", but I cannot parse it as a real, interpretable life question. Please rewrite it in one or two clear sentences about your actual situation and dilemma, then try again.`;
  return {
    wind_category_blurb: message,
    classical_voice: "",
    meaning_for_question: "",
    hidden_tension: "",
    your_moment: "",
    exploration: { text: "", timeframe: "today", duration_estimate: "5 minutes", is_solo: true },
    reflection_question: "",
    invalid_input: true,
  };
}

function isInvalidInputStyleReading(r: Record<string, unknown>): boolean {
  const all = `${String(r.wind_category_blurb ?? "")}\n${String(r.meaning_for_question ?? "")}\n${String(r.classical_voice ?? "")}`.toLowerCase();
  return (
    all.includes("cannot understand the question you entered") ||
    all.includes("please re-enter your question") ||
    all.includes("please enter a real question") ||
    all.includes("无法理解") ||
    all.includes("请输入真实问题")
  );
}

const SYSTEM_PROMPT = `You are POJU's Oracle Interpreter.

FIRST GATE (MANDATORY INPUT VALIDATION): Before any interpretation, decide whether the user's question is a real, understandable question/dilemma or obvious gibberish/noise (examples: "阿萨法发撒", "dsfasasfADA DASG DAF", random keyboard mashing, or meaningless fragments). If input is gibberish or not interpretable, DO NOT generate a normal reading. Instead, still return STRICT JSON using the SAME keys as a normal reading, and set "invalid_input": true. Put the full rejection message in wind_category_blurb (include the user's original input in quotes). Use empty strings for classical_voice, meaning_for_question, hidden_tension, your_moment; exploration with empty text and timeframe "today"; reflection_question empty string.
For this invalid-input case:
- Output a COMPACT rejection only (one short paragraph in wind_category_blurb). Do not write a full reading in the other fields.
- Keep the tone respectful, firm, and clear.

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

Total word count: 800-1100 English words (when invalid_input is false).

You MUST use these exact top-level keys (the client parses only this shape):

{
  "wind_category_blurb": "120-180 words. Restate the user's question and the real situation as you read it. Reference the question directly.",
  "classical_voice": "150-220 words. Tell the story behind the glyph as a universal narrative (no Chinese names). Connect the ancient pattern to the user's modern situation.",
  "meaning_for_question": "180-250 words. What does THIS glyph reveal about THIS question? Quote the verse imagery; make it personal and current.",
  "hidden_tension": "80-120 words. Name the inner friction or paradox the user may be avoiding.",
  "your_moment": "80-120 words. What this moment asks of them emotionally and practically.",
  "exploration": {
    "text": "40-80 words. One concrete next step they can try.",
    "timeframe": "today | tonight | within_24h | this_week",
    "duration_estimate": "e.g. 5 minutes, 20 minutes, 1 hour",
    "is_solo": true
  },
  "reflection_question": "20-35 words. One non-rhetorical question to sit with after they close the page.",
  "metadata": { "word_count": 0 }
}

Set metadata.word_count to your best estimate of total English words in the text fields (integer).

Return ONLY the JSON object. No preamble. No explanation. No markdown 
code blocks. Just valid parseable JSON.

# Safety Override

If the user's question contains indicators of suicide, self-harm, 
violence toward others, or illegal activity (in any language), DO NOT 
interpret the glyph normally. Return this exact safety response (same key names):

{
  "wind_category_blurb": "I see weight in this question — more than the words can hold. Before we look at the glyph, I want to make sure you're safe right now.",
  "classical_voice": "The Oracle was made for sincere questions about life direction. What you're carrying might need something more immediate than this conversation can offer.",
  "meaning_for_question": "You don't have to face this alone. People trained to listen — really listen — are available right now.",
  "hidden_tension": "Immediate safety support matters more than interpretation right now.",
  "your_moment": "Please pause and reach out now. You do not need to carry this alone.",
  "exploration": {
    "text": "If you're in the United States: Call or text 988 (Suicide & Crisis Lifeline). They're available 24/7, free, and confidential. If you're outside the US: visit findahelpline.com to find a service in your country.",
    "timeframe": "today",
    "duration_estimate": "5 minutes",
    "is_solo": false
  },
  "reflection_question": "Is there one person in your life who would want to know what you're going through right now?",
  "metadata": { "word_count": 0 }
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
  "wind_category_blurb": "You're holding a question with weight...",
  "classical_voice": "Centuries ago, a man of great skill lived in obscurity...",
  "meaning_for_question": "The verse speaks of someone hidden in shadow...",
  "hidden_tension": "The tension between urgency and the need to let something finish forming beneath the surface.",
  "your_moment": "This is not a moment to force clarity; it is a moment to listen to what the pause is teaching you.",
  "exploration": {
    "text": "Write down what your current role is teaching you before you decide to leave it.",
    "timeframe": "today",
    "duration_estimate": "15 minutes",
    "is_solo": true
  },
  "reflection_question": "If you knew the right moment to leave was six months from now, what would you do today?",
  "metadata": { "word_count": 650 }
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
  "wind_category_blurb": "You're asking whether to file for divorce now...",
  "classical_voice": "There's an old story of a sailor who survived a typhoon...",
  "meaning_for_question": "The verse points to the center of a storm...",
  "hidden_tension": "You want a single decisive move while the situation still churns around you.",
  "your_moment": "Stillness here is not passivity; it is how you keep your judgment from being stolen by the noise.",
  "exploration": {
    "text": "Write one page describing only what you see right now, without deciding the next legal step.",
    "timeframe": "tonight",
    "duration_estimate": "30 minutes",
    "is_solo": true
  },
  "reflection_question": "If this clarity faded in two weeks, what would you want your future self to remember about today?",
  "metadata": { "word_count": 720 }
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
  wind_category_blurb:
    "I see weight in this question - more than the words can hold. Before we look at the glyph, I want to make sure you're safe right now.",
  classical_voice:
    "The Oracle was made for sincere questions about life direction. What you're carrying might need something more immediate than this conversation can offer.",
  meaning_for_question:
    "You don't have to face this alone. People trained to listen - really listen - are available right now.",
  hidden_tension: "Immediate safety support matters more than interpretation right now.",
  your_moment: "Please pause and reach out now. You do not need to carry this alone.",
  exploration: {
    text: "If possible, text one trusted person right now with: I need support tonight. Then contact a local helpline.",
    timeframe: "today",
    duration_estimate: "5 minutes",
    is_solo: false,
  },
  reflection_question: "Who can help you stay safe in the next hour?",
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

/** Older prompts asked for situation/meaning/wisdom/actions; map into the UI schema if the model still returns that shape. */
function normalizeLegacyReadingShape(raw: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...raw };
  if (typeof o.wind_category_blurb !== "string" || !String(o.wind_category_blurb).trim()) {
    if (typeof o.situation === "string" && o.situation.trim()) o.wind_category_blurb = o.situation;
  }
  if (typeof o.classical_voice !== "string" || !String(o.classical_voice).trim()) {
    if (typeof o.wisdom === "string" && o.wisdom.trim()) o.classical_voice = o.wisdom;
  }
  if (typeof o.meaning_for_question !== "string" || !String(o.meaning_for_question).trim()) {
    if (typeof o.meaning === "string" && o.meaning.trim()) o.meaning_for_question = o.meaning;
  }
  const actions = Array.isArray(o.actions) ? o.actions.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  if (typeof o.hidden_tension !== "string" || !String(o.hidden_tension).trim()) {
    if (actions[1]) o.hidden_tension = actions[1];
    else if (actions[0]) o.hidden_tension = actions[0];
    else if (typeof o.meaning_for_question === "string" && o.meaning_for_question.trim()) {
      o.hidden_tension =
        "The pressure in your question is real; hold it without forcing a single clean story yet.";
    }
  }
  if (typeof o.your_moment !== "string" || !String(o.your_moment).trim()) {
    if (actions[0]) o.your_moment = actions[0];
    else if (typeof o.revisit_timing === "string" && o.revisit_timing.trim()) o.your_moment = o.revisit_timing;
    else if (typeof o.wind_category_blurb === "string" && o.wind_category_blurb.trim()) {
      o.your_moment = "Stay with one small next step rather than solving the whole horizon today.";
    }
  }
  if (typeof o.reflection_question !== "string" || !String(o.reflection_question).trim()) {
    const refs = Array.isArray(o.reflections) ? o.reflections : [];
    if (refs.length > 0) o.reflection_question = String(refs[0] ?? "").trim();
    else if (typeof o.revisit_timing === "string" && o.revisit_timing.trim()) {
      o.reflection_question = "What would you want to remember about how you felt at the end of this reading?";
    }
  }
  const explorationTextFallback =
    (actions[2] as string | undefined) ||
    (actions[1] as string | undefined) ||
    (actions[0] as string | undefined) ||
    (typeof o.revisit_timing === "string" ? o.revisit_timing : "");
  if (!o.exploration || typeof o.exploration !== "object" || o.exploration === null) {
    if (explorationTextFallback) {
      o.exploration = {
        text: explorationTextFallback,
        timeframe: "today",
        duration_estimate: "5 minutes",
        is_solo: true,
      };
    }
  } else {
    const ex = o.exploration as Record<string, unknown>;
    if (!String(ex.text ?? "").trim() && explorationTextFallback) {
      ex.text = explorationTextFallback;
      if (!ex.timeframe) ex.timeframe = "today";
      if (!ex.duration_estimate) ex.duration_estimate = "5 minutes";
      if (typeof ex.is_solo !== "boolean") ex.is_solo = true;
      o.exploration = ex;
    }
  }
  return o;
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

const requestDedupe = new Map<string, Promise<string>>();

export async function POST(req: Request) {
  try {
    if (!isOpenRouterConfigured() && !getGeminiClient()) {
      return NextResponse.json(
        {
          error:
            "Server missing OPENROUTER_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY",
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

    const userProfile = await calculateProfile(
      legacyFormToBirthInfo({
        year: body.user_birth.year,
        month: body.user_birth.month,
        day: body.user_birth.day,
        hour: 12,
        minute: 0,
        gender: "male",
      }),
    );

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

Now generate the JSON response using exactly the key names defined in the system instruction (wind_category_blurb, classical_voice, meaning_for_question, hidden_tension, your_moment, exploration, reflection_question, metadata). Do not use situation, meaning, wisdom, actions, reflections, or revisit_timing as JSON keys.
Target length: 600-900 English words for a normal reading. Strict JSON only, no preamble.

User profile diagnosis:
${JSON.stringify(userProfile.diagnosis, null, 2)}`;

    const candidateModels = Array.from(
      new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]),
    );
    const dedupeKey = JSON.stringify({
      sign_number: body.sign_number,
      level: body.level,
      user_birth: body.user_birth,
      user_question: body.user_question,
      locale,
    });

    const useOpenRouter = isOpenRouterConfigured();

    const runPromise =
      requestDedupe.get(dedupeKey) ??
      (async (): Promise<string> => {
        if (useOpenRouter) {
          const { text } = await openRouterChatCompletion({
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 8192,
            json_mode: true,
            reasoning_effort: "high",
          });
          return text;
        }

        const genAI = getGeminiClient()!;
        let lastError: unknown = null;

        for (const modelName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction,
            });
            const result = await model.generateContent({
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
              },
            });
            return result.response.text();
          } catch (err) {
            const message = formatGeminiError(err);
            const isModelNotFound =
              /models\/[\w.-]+ is not found|not supported for generateContent|404|NOT_FOUND/i.test(
                message,
              ) || /Requested entity was not found/i.test(message);
            if (!isModelNotFound) throw err;
            lastError = err;
          }
        }

        throw (
          lastError ??
          new Error(
            `No available Gemini model. Tried: ${candidateModels.join(", ")}`,
          )
        );
      })().finally(() => {
        requestDedupe.delete(dedupeKey);
      });
    requestDedupe.set(dedupeKey, runPromise);

    const responseText = await runPromise;

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

    reading = normalizeLegacyReadingShape(reading as Record<string, unknown>);

    let r = reading as {
      wind_category_blurb?: string;
      classical_voice?: string;
      meaning_for_question?: string;
      hidden_tension?: string;
      your_moment?: string;
      exploration?: { text?: string; timeframe?: string; duration_estimate?: string; is_solo?: boolean };
      reflection_question?: string;
      invalid_input?: boolean;
      metadata?: { word_count?: number };
    };

    // Enforce compact output for gibberish/uninterpretable-input cases.
    if (isInvalidInputStyleReading(r)) {
      r = createInvalidInputReading(body.user_question, locale);
    }

    if (
      !r.wind_category_blurb ||
      (!r.invalid_input &&
        (!r.classical_voice ||
          !r.meaning_for_question ||
          !r.hidden_tension ||
          !r.your_moment ||
          !r.exploration?.text ||
          !r.reflection_question))
    ) {
      throw new Error("LLM response missing required fields");
    }

    if (!r.invalid_input) {
      const tf = r.exploration?.timeframe;
      if (tf !== "today" && tf !== "tonight" && tf !== "within_24h" && tf !== "this_week") {
        r.exploration = {
          ...r.exploration,
          timeframe: "today",
        };
      }
      r.exploration = {
        text: r.exploration?.text ?? "",
        timeframe: (r.exploration?.timeframe as "today" | "tonight" | "within_24h" | "this_week") ?? "today",
        duration_estimate: r.exploration?.duration_estimate ?? "5 minutes",
        is_solo: r.exploration?.is_solo ?? true,
      };
    }

    if (locale === "en" && !r.invalid_input) {
      const totalWords =
        countWords(r.wind_category_blurb as string) +
        countWords(r.classical_voice as string) +
        countWords(r.meaning_for_question as string) +
        countWords(r.hidden_tension as string) +
        countWords(r.your_moment as string) +
        countWords(r.exploration?.text ?? "") +
        countWords(r.reflection_question as string);
      if (totalWords < 520 || totalWords > 900) {
        throw new Error(`LLM response word count out of range: ${totalWords}`);
      }
      r.metadata = { ...(r.metadata ?? {}), word_count: totalWords };
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
