# POJU 修复文档 #03 · LLM 多语言改造 + 5 语言翻译

> **使用时机**:Fix 02 完成后,接入 LLM API 之前
>
> **目标**:
> - 让 LLM(POJU/Glyph/Syncro)输出根据用户语言自适应
> - 提供 5 种语言的网站界面翻译文本
> - 单一 Prompt 架构(不重复维护 5 套)
>
> **核心策略**:
> - System Prompt:英文(永远不变)
> - RAG 知识库:英文或中文原文(不翻译)
> - 用户输出:根据【3 级语言判断】决定

---

## 目录

```
Part 1: 3 级语言判断逻辑(核心架构)
Part 2: 各产品的语言判断特殊性
  - POJU Agent (有文字输入)
  - Glyph (有文字输入)
  - Syncro (无文字输入,特殊情况)
Part 3: 工程实现 - getLanguageDirective() 函数
Part 4: 改造 3 份 System Prompt
Part 5: 5 种语言完整翻译(messages/*.json)
Part 6: 翻译质量验证
Part 7: 多语言测试用例
Part 8: 给 Cursor 的执行指令
```

---

# Part 1: 3 级语言判断逻辑

## 核心规则

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  3 级语言判断优先级(从高到低):                       │
│                                                      │
│  Priority 3 (最高): 用户对话中明确要求               │
│    "请用中文回答" / "Answer in Spanish"              │
│    → 立即切换,覆盖一切                              │
│                                                      │
│  Priority 2 (中): 用户输入的语言                     │
│    用户用中文输入问题 → 默认中文回答                │
│    仅当 Priority 3 没触发时                         │
│                                                      │
│  Priority 1 (基础): 网站界面 locale                  │
│    用户在网站选了西语 → 默认西语                     │
│    所有其他规则的兜底                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 决策流程图

```
用户提交请求
    │
    ↓
[Step 1] 检查最近的用户消息
    │
    ├── 是否包含 "请用 X 语言" / "Answer in X" 等指令?
    │   ├── YES → Priority 3 触发 → 用 X 语言
    │   └── NO → 继续
    │
    ↓
[Step 2] 检查用户当前输入
    │
    ├── 输入是否包含足够文字(>= 5 字符)?
    │   ├── YES → 检测输入语言
    │   │      ├── 与 locale 一致 → 用 locale 语言
    │   │      └── 与 locale 不同 → Priority 2 触发 → 用输入语言
    │   └── NO (Syncro 等纯数据输入) → 跳过 Priority 2
    │
    ↓
[Step 3] 使用网站 locale
    │
    └── Priority 1 兜底 → 用 locale 语言
```

## 具体例子

```
例 1: 简单情况
  Locale: en
  用户输入: "Should I take this job?"
  → 用英文回答(Priority 1 + Priority 2 一致)

例 2: 用户切换了语言
  Locale: zh (中文界面)
  用户输入: "Should I take this job?"  (英文输入)
  → 用中文回答(Priority 1)
  
  原因:
    - 用户在网站选了中文界面 = 想读中文
    - 即使输入是英文(可能双语用户)
    - 应该按照界面语言

例 3: 对话中要求切换
  Locale: en
  用户第 1 轮: "Should I take this job?"
  AI 第 1 轮: [英文回复]
  用户第 2 轮: "请用中文继续"
  AI 第 2 轮: [中文回复] ← Priority 3 触发

例 4: Syncro 特殊情况
  Locale: es (西班牙语界面)
  用户输入: 出生日期 1990-05-15, mao 时
  → 用西班牙语输出(只能依赖 Priority 1)
  
  原因:
    - Syncro 没有文字输入
    - 唯一信号是网站 locale
```

---

# Part 2: 各产品的语言判断特殊性

## POJU Agent (多轮对话)

```
特点: 有文字输入,多轮对话

3 级判断完整启用:
  ✓ Priority 3: 检查每轮用户消息中的语言切换指令
  ✓ Priority 2: 检测用户输入语言
  ✓ Priority 1: 网站 locale 兜底

实现:
  每轮请求都重新判断
  如果用户中途切换,立即响应
  
持续性:
  一旦 Priority 3 触发,后续轮次保持该语言
  除非用户再次切换
```

## Glyph (单次报告)

```
特点: 有文字输入,单次输出

3 级判断:
  ✓ Priority 3: 检查用户输入中是否有切换请求
     例如: "请用中文给我反思" / "respond in Spanish"
  ✓ Priority 2: 检测用户问题的语言
  ✓ Priority 1: 网站 locale 兜底

实现:
  单次判断
  生成报告
```

## Syncro (无文字输入) ⚠️ 特殊

```
特点: 用户只输入数字(出生日期、时间)
      无法从输入判断语言

判断简化:
  ✗ Priority 3: 不适用(无文字输入)
  ✗ Priority 2: 不适用(无文字输入)
  ✓ Priority 1: 网站 locale (唯一信号)

实现:
  100% 依赖网站 locale
  Prompt 直接写: "Respond in ${locale}"

例外:
  如果将来 Syncro 加入"备注"字段
  可以从备注判断语言
```

---

# Part 3: 工程实现 - getLanguageDirective() 函数

## 完整函数代码

```typescript
// src/lib/prompts/language-directive.ts

interface LanguageDirectiveInput {
  locale: 'en' | 'es' | 'zh' | 'fr' | 'de';
  userInput?: string;          // 用户输入(POJU/Glyph 有,Syncro 没有)
  conversationHistory?: Array<{ role: string; content: string }>;  // 多轮对话
}

interface LanguageDirectiveOutput {
  outputLanguage: string;      // 实际输出语言
  directive: string;            // 加到 Prompt 末尾的指令文本
}

/**
 * 3 级语言判断 + 生成 Prompt 指令
 */
export function getLanguageDirective(
  input: LanguageDirectiveInput
): LanguageDirectiveOutput {
  
  const localeNames: Record<string, string> = {
    'en': 'English',
    'es': 'Mexican Spanish (es-MX) — warm and contemporary',
    'zh': 'Simplified Chinese (zh-CN) — preserve poetic depth',
    'fr': 'French — eloquent, slightly philosophical',
    'de': 'German — precise but warm',
  };
  
  // Priority 3: 检查用户对话中的语言切换指令
  const switchPatterns = [
    /please respond in (\w+)/i,
    /answer in (\w+)/i,
    /reply in (\w+)/i,
    /用(中文|英文|西班牙语|法语|德语)回复/,
    /用(中文|英文|西班牙语|法语|德语)回答/,
    /改用(中文|英文|西班牙语|法语|德语)/,
    /switch to (\w+)/i,
    /(?:in|en|auf) (Spanish|Chinese|French|German|English|español|chino|francés|alemán|inglés)/i,
  ];
  
  const allMessages = [
    ...(input.conversationHistory || []),
    ...(input.userInput ? [{ role: 'user', content: input.userInput }] : []),
  ];
  
  // 倒序检查最近的用户消息(最近的指令优先)
  const userMessages = allMessages
    .filter(m => m.role === 'user')
    .reverse();
  
  for (const msg of userMessages) {
    for (const pattern of switchPatterns) {
      const match = msg.content.match(pattern);
      if (match) {
        const detectedLang = mapToLocale(match[1]);
        if (detectedLang) {
          return {
            outputLanguage: localeNames[detectedLang],
            directive: buildDirective(localeNames[detectedLang], 'priority_3'),
          };
        }
      }
    }
  }
  
  // Priority 2: 检测用户输入语言
  if (input.userInput && input.userInput.length >= 5) {
    const detectedLocale = detectLanguage(input.userInput);
    if (detectedLocale && detectedLocale !== input.locale) {
      // 用户输入语言与界面 locale 不同
      // 优先使用界面 locale(因为用户主动选了界面语言)
      // 但记录这个差异,让 LLM 理解用户输入的语言
      return {
        outputLanguage: localeNames[input.locale],
        directive: buildDirective(
          localeNames[input.locale], 
          'priority_1_with_input_note',
          detectedLocale
        ),
      };
    }
  }
  
  // Priority 1: 默认使用网站 locale
  return {
    outputLanguage: localeNames[input.locale],
    directive: buildDirective(localeNames[input.locale], 'priority_1'),
  };
}

/**
 * 把字符串映射到 locale code
 */
function mapToLocale(text: string): string | null {
  const map: Record<string, string> = {
    'english': 'en',
    'inglés': 'en',
    'english': 'en',
    'en': 'en',
    
    'spanish': 'es',
    'español': 'es',
    'es': 'es',
    'mexican': 'es',
    
    'chinese': 'zh',
    '中文': 'zh',
    '汉语': 'zh',
    'mandarin': 'zh',
    'zh': 'zh',
    
    'french': 'fr',
    'français': 'fr',
    'francés': 'fr',
    'fr': 'fr',
    
    'german': 'de',
    'deutsch': 'de',
    'alemán': 'de',
    'de': 'de',
  };
  
  return map[text.toLowerCase().trim()] || null;
}

/**
 * 简单语言检测(基于字符特征)
 * 生产环境建议用 franc 或 cld3 库
 */
function detectLanguage(text: string): string | null {
  // 中文检测(CJK 字符)
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
  
  // 简单的特征词检测
  const lowerText = text.toLowerCase();
  
  if (/\b(hola|cómo|qué|por|para|hacer|sí|gracias)\b/.test(lowerText)) return 'es';
  if (/\b(bonjour|comment|pour|faire|merci|oui|est-ce)\b/.test(lowerText)) return 'fr';
  if (/\b(hallo|wie|was|bitte|danke|ja|nein|machen)\b/.test(lowerText)) return 'de';
  
  // 默认假设英文(因为我们的 base locale)
  return 'en';
}

/**
 * 构建 Prompt 指令
 */
function buildDirective(
  language: string,
  priorityType: 'priority_1' | 'priority_1_with_input_note' | 'priority_3',
  userInputLanguage?: string
): string {
  let priorityNote = '';
  
  if (priorityType === 'priority_3') {
    priorityNote = `
The user has explicitly requested a response in this language. 
Honor this request immediately.`;
  } else if (priorityType === 'priority_1_with_input_note') {
    priorityNote = `
Note: The user wrote their question in ${userInputLanguage}, 
but they have selected ${language} as their interface language. 
Respond in ${language}, but understand their question in 
${userInputLanguage}.`;
  } else {
    priorityNote = `
This is the user's selected interface language.`;
  }
  
  return `

# OUTPUT LANGUAGE INSTRUCTION

Respond entirely in ${language}.
${priorityNote}

CRITICAL — Do NOT translate these brand names; keep them in English:
- POJU
- Glyph
- Syncro
- Divine Tailwind
- Fair Sky
- Still Water
- Crosswind
- Eye of Storm

When using these names mid-sentence, integrate them naturally 
into the target language's grammar. Examples:

  Spanish:  "El patrón de Divine Tailwind sugiere..."
  Chinese:  "Divine Tailwind 这个图案暗示..."  
  French:   "Le motif Divine Tailwind suggère..."
  German:   "Das Muster von Divine Tailwind deutet darauf hin..."

Maintain the brand voice across all languages:
- Warm but not effusive
- Direct but not harsh
- Wise but not preachy
- Poetic but not flowery

The user may have written in any language. Understand them in 
their language. Respond in the language specified above.
`;
}
```

---

# Part 4: 改造 3 份 System Prompt

## POJU Agent

```typescript
// src/app/api/poju/route.ts

import { POJU_SYSTEM_PROMPT } from '@/lib/prompts/poju';
import { getLanguageDirective } from '@/lib/prompts/language-directive';

export async function POST(req: Request) {
  const { 
    question, 
    birth, 
    conversationHistory, 
    locale 
  } = await req.json();
  
  const langDirective = getLanguageDirective({
    locale,
    userInput: question,
    conversationHistory,
  });
  
  const fullSystemPrompt = POJU_SYSTEM_PROMPT + langDirective.directive;
  
  // 调用 Anthropic
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: fullSystemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: question }
    ],
  });
  
  return NextResponse.json({
    response: message.content[0].text,
    language: langDirective.outputLanguage,
  });
}
```

## Glyph

```typescript
// src/app/api/glyph/route.ts

import { GLYPH_SYSTEM_PROMPT } from '@/lib/prompts/glyph';
import { getLanguageDirective } from '@/lib/prompts/language-directive';

export async function POST(req: Request) {
  const { question, birth, sign_number, locale } = await req.json();
  
  const langDirective = getLanguageDirective({
    locale,
    userInput: question,
  });
  
  const fullSystemPrompt = GLYPH_SYSTEM_PROMPT + langDirective.directive;
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: fullSystemPrompt,
    messages: [{
      role: 'user',
      content: `Question: ${question}\nBirth: ${JSON.stringify(birth)}\nSign: ${sign_number}`
    }],
  });
  
  return NextResponse.json({
    report: JSON.parse(message.content[0].text),
    language: langDirective.outputLanguage,
  });
}
```

## Syncro (特殊处理)

```typescript
// src/app/api/syncro/route.ts

import { SYNCRO_SYSTEM_PROMPT } from '@/lib/prompts/syncro';
import { getLanguageDirective } from '@/lib/prompts/language-directive';
import { computeSyncroData } from '@/lib/syncro/algorithm';

export async function POST(req: Request) {
  const { birth, current_time, locale } = await req.json();
  
  // Syncro 没有文字输入,只能用 Priority 1 (locale)
  const langDirective = getLanguageDirective({
    locale,
    // 不传 userInput,自动使用 Priority 1
  });
  
  const algoData = computeSyncroData({ birth, current_time });
  
  const fullSystemPrompt = SYNCRO_SYSTEM_PROMPT + langDirective.directive;
  
  const userPrompt = `Algorithm output for translation:
User element pattern: ${algoData.current_window.user_element}
Current period element: ${algoData.current_window.period_element}
8 Directions: ${JSON.stringify(algoData.directions, null, 2)}

Generate the JSON guidance per the system prompt format.`;
  
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    system: fullSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  
  return NextResponse.json({
    syncro: JSON.parse(message.content[0].text),
    language: langDirective.outputLanguage,
  });
}
```

---

# Part 5: 5 种语言完整翻译

> **重要提醒**:
> - 翻译保持品牌词不变(POJU, Glyph, Syncro, 5 个等级名)
> - 保持文学性,不做生硬直译
> - 每种语言都经过【调性匹配】,不只是字面翻译

## messages/en.json (英文 - 主语言)

```json
{
  "common": {
    "tagline": "Where AI meets a thousand years of wisdom.",
    "footer_disclaimer": "For self-reflection and entertainment. POJU offers perspectives, not predictions. All decisions are yours alone.",
    "trust_line": "No account · No subscription · Yours to decide",
    "read_with_wink": "Read with a wink. The patterns mirror, they don't predict."
  },
  
  "nav": {
    "poju": "POJU",
    "glyph": "Glyph",
    "syncro": "Syncro",
    "archive": "Archive"
  },
  
  "home": {
    "hero": {
      "subtitle": "Where AI meets a thousand years of wisdom.",
      "cta_primary": "Start a POJU session · $9.99",
      "cta_secondary": "Try Glyph · Free"
    },
    "three_ways": {
      "heading": "Three ways in. One way through.",
      "poju": {
        "tagline": "For the question that won't let you go.",
        "description": "A single deep conversation, until you see it through."
      },
      "glyph": {
        "tagline": "A 60-second mirror.",
        "description": "Hold a question. Draw a pattern. Read a reflection."
      },
      "syncro": {
        "tagline": "See your natural rhythms.",
        "description": "Updated every two hours, on your phone."
      },
      "try_it": "Try it →"
    },
    "two_languages": {
      "heading": "Where two languages meet.",
      "subtitles": [
        "Two thousand years of human reflection.",
        "Modern AI translation.",
        "One conversation that helps you see clearly."
      ],
      "pattern": {
        "title": "PATTERN",
        "description": "Ancient observation on what recurs."
      },
      "direction": {
        "title": "DIRECTION", 
        "description": "Spatial psychology on what we notice."
      },
      "timing": {
        "title": "TIMING",
        "description": "Cycles that shape biology."
      },
      "you": {
        "title": "YOU",
        "description": "Your birth context, moment, and question."
      }
    },
    "promises": {
      "heading": "Three promises we don't break.",
      "never_stored": {
        "title": "Never stored",
        "description": "Your conversations live encrypted on your device. We can't read them. No one can."
      },
      "never_required": {
        "title": "Never required",
        "description": "No account. No login. No password. Email only when you want a PDF."
      },
      "never_manipulative": {
        "title": "Never manipulative",
        "description": "No dark patterns. No fake urgency. One price: $9.99 when you need it."
      },
      "read_more": "Read the full privacy architecture →"
    },
    "final_cta": {
      "heading": "When the question won't let you go.",
      "subtitle": "Stop reading. Start moving through it.",
      "primary": "Ask Your Question — $9.99",
      "secondary": "Or try Glyph for free first →"
    }
  },
  
  "poju": {
    "hero": {
      "heading": "Sometimes reading isn't enough.",
      "description": "You've already read the books, talked to the friends, and weighed the pros and cons. The question still won't let you go.",
      "tagline": "POJU is what comes after thinking alone.",
      "cta_primary": "Ask your question — $9.99",
      "cta_secondary": "See how it works ↓"
    },
    "when_to_come": {
      "heading": "When to come to POJU.",
      "stuck": {
        "title": "You're stuck between two paths",
        "description": "Career change. Relationship decision. Where to live."
      },
      "confused": {
        "title": "You've done your research and you're more confused",
        "description": "Conflicting advice. Family pressure. A ticking clock."
      },
      "repeating": {
        "title": "Something keeps repeating and you don't know why",
        "description": "Same kind of relationship. Same blocks. Same setbacks."
      },
      "depth": {
        "title": "You need depth that friends can't give",
        "description": "No one around you has the distance to see clearly."
      },
      "direction": {
        "title": "You want direction, not prediction",
        "description": "\"Will X happen\" is astrology. \"What should I do\" is POJU."
      }
    },
    "how_it_works": {
      "heading": "How POJU works",
      "subtitle": "Not a single answer — a continuous breakthrough loop.",
      "steps": {
        "1": "Issue Identification",
        "2": "Information Collection",
        "3": "Pattern Analysis",
        "4": "Core Analysis",
        "5": "Action Generation",
        "6": "Implementation Tracking"
      },
      "footer": "You act. You come back. The path adjusts. Until you move through."
    },
    "two_columns": {
      "heading": "Two columns, one promise.",
      "included": {
        "title": "What's included",
        "items": [
          "Unlimited depth in a single session",
          "Action plan you can act on tomorrow",
          "Reflection prompts to sit with",
          "30-day session access"
        ]
      },
      "not_included": {
        "title": "What it's not",
        "items": [
          "Does not predict your future",
          "Does not replace professional advice",
          "Does not make decisions for you"
        ]
      },
      "tagline": "POJU is a thinking partner. The decisions remain yours.",
      "cta": "Ask your question — $9.99",
      "footnote": "One question · Unlimited depth · Deletes when you close"
    }
  },
  
  "glyph": {
    "hero": {
      "heading": "Glyph",
      "subtitle": "A 60-second mirror.",
      "description": "Hold a question. Draw a pattern. Read a reflection.",
      "footnote": "Free. No signup. Read with a wink.",
      "cta": "Try Glyph — Free"
    },
    "five_winds": {
      "heading": "Five winds — five archetypal patterns",
      "description": "The five patterns are mirrors, not predictions. Each one describes a human situation and helps you frame what is already happening.",
      "divine_tailwind": {
        "name": "Divine Tailwind",
        "description": "The rare grace of full alignment. Everything you need is already moving toward you."
      },
      "fair_sky": {
        "name": "Fair Sky",
        "description": "Clear paths with gentle support. The way is open, but you must still walk it."
      },
      "still_water": {
        "name": "Still Water",
        "description": "The time for patience and stillness. Neither forward nor backward. Sit with what is."
      },
      "crosswind": {
        "name": "Crosswind",
        "description": "Competing forces are pulling at you. This is not a cue to push harder. It's a cue to listen more carefully."
      },
      "eye_of_storm": {
        "name": "Eye of Storm",
        "description": "The deep stillness found at the center of a storm. When everything external is turbulent, clarity lives in the one place nothing can reach."
      }
    },
    "on_the_cards": {
      "heading": "On the cards.",
      "paragraphs": [
        "The five glyphs are not labels of fortune. They are not \"good cards\" or \"bad cards.\"",
        "Each one is a lens — a way of reading this particular moment, for this particular question, held by this particular person.",
        "The same glyph can mean entirely different things on different days, for different people, about different questions.",
        "What you receive is not a verdict. It is a perspective — and an invitation to look more carefully."
      ]
    },
    "how_it_works": {
      "heading": "How Glyph works.",
      "step_1": {
        "title": "Hold your question.",
        "description": "Compress it to 60 characters. The compression begins the answer."
      },
      "step_2": {
        "title": "Draw your pattern.",
        "description": "One of 100 archetypal forms, refined over a thousand years."
      },
      "step_3": {
        "title": "Read your reflection.",
        "description": "A short response — grounded in wisdom traditions and modern psychology."
      },
      "rules": [
        "One question per reading. Don't ask many things at once.",
        "Wait 48 hours before asking the same thing again. Answers need time to settle.",
        "Compress your question into 60 characters. The compression is the beginning of the answer."
      ]
    },
    "final_cta": {
      "heading": "Hold one question.",
      "subtitle": "What you receive is not a verdict. It is an invitation to look more carefully.",
      "cta": "Try Glyph — Free"
    }
  },
  
  "syncro": {
    "hero": {
      "heading": "Syncro",
      "subtitle": "See your natural rhythms.",
      "description": "Based on your birth context, Syncro reflects how the day's patterns align with you. Where to lean in. Where to slow down.",
      "tagline": "A weather forecast for your inner life, updated every two hours.",
      "footnote": "Free · Opens on mobile only",
      "cta": "Open Syncro",
      "qr_label": "easternos.com/syncro",
      "sms_label": "Text yourself the link",
      "sms_button": "Text me the link"
    },
    "what_shows": {
      "heading": "What Syncro shows.",
      "intro": "Hold your phone toward a direction. See what's available. See what isn't.",
      "items_intro": "Each direction shows:",
      "items": [
        "A short description of the current pattern",
        "What this period suits (for example, slow conversations)",
        "What this period doesn't suit (for example, wait on big asks)"
      ],
      "footnote": "Updated every two hours, with your context."
    },
    "use_cases": {
      "heading": "Where people use Syncro",
      "study": {
        "title": "Study spot",
        "description": "Choose a desk orientation that supports steady focus before a deep work block."
      },
      "negotiation": {
        "title": "Negotiation",
        "description": "Find a seating orientation that supports confidence and steadier communication."
      },
      "bed": {
        "title": "Bed orientation",
        "description": "Test sleeping directions and compare how your rest quality changes over time."
      },
      "travel": {
        "title": "Travel decision",
        "description": "Check directional tone before heading out when timing and clarity both matter."
      },
      "companion": {
        "title": "POJU companion",
        "description": "Use Syncro as a real-world layer, then return to POJU for deeper decision strategy."
      }
    },
    "what_it_is": {
      "heading": "What it is. What it isn't.",
      "shows": {
        "title": "What it shows",
        "items": [
          "Current rhythm pattern for the next 2 hours",
          "Eight directions with what they suit",
          "Where to lean in, where to slow down"
        ]
      },
      "isnt": {
        "title": "What it isn't",
        "items": [
          "A predictor of events",
          "A promiser of outcomes",
          "A replacement for your own judgment"
        ]
      }
    },
    "always_free": {
      "heading": "Always free.",
      "description": "Syncro stays free as your everyday rhythm companion. Open it whenever you need clarity on the moment.",
      "cta": "Open Syncro on mobile"
    }
  },
  
  "footer": {
    "disclaimers": {
      "home": "For self-reflection and entertainment. POJU offers perspectives, not predictions. All decisions are yours alone.",
      "poju": "POJU is a thinking partner. It offers perspectives, not prophecies. All decisions are yours alone.",
      "glyph": "Read with a wink. The patterns mirror, they don't predict. All decisions are yours alone.",
      "syncro": "Syncro is a self-awareness tool. Take what resonates. Decisions are yours alone."
    },
    "links": {
      "home": "Home",
      "disclaimer": "Disclaimer",
      "privacy": "Privacy Policy",
      "terms": "Terms of Service",
      "contact": "Contact"
    },
    "copyright": "© 2026 POJU. All rights reserved."
  }
}
```

## messages/zh.json (简体中文)

```json
{
  "common": {
    "tagline": "AI 与千年智慧的相遇。",
    "footer_disclaimer": "POJU 用于自我反思与启发。我们提供视角,而非预测。所有决定都由你自己做出。",
    "trust_line": "无需账户 · 无需订阅 · 由你决定",
    "read_with_wink": "带一丝玩味去读。这些图案是镜子,不是预言。"
  },
  
  "nav": {
    "poju": "POJU",
    "glyph": "Glyph",
    "syncro": "Syncro",
    "archive": "存档"
  },
  
  "home": {
    "hero": {
      "subtitle": "AI 与千年智慧的相遇。",
      "cta_primary": "开启 POJU 对话 · $9.99",
      "cta_secondary": "免费体验 Glyph"
    },
    "three_ways": {
      "heading": "三种入口。一种穿越。",
      "poju": {
        "tagline": "为那个挥之不去的问题。",
        "description": "一次深入对话,直到你看清。"
      },
      "glyph": {
        "tagline": "60 秒的镜子。",
        "description": "握住问题。抽取图案。读一次反射。"
      },
      "syncro": {
        "tagline": "看见你的自然节奏。",
        "description": "每两小时更新一次,在你的手机上。"
      },
      "try_it": "试试看 →"
    },
    "two_languages": {
      "heading": "两种语言的相遇。",
      "subtitles": [
        "两千年的人类沉思。",
        "现代 AI 的翻译。",
        "一次对话,帮你看得更清。"
      ],
      "pattern": {
        "title": "图案",
        "description": "古人对反复出现之事的观察。"
      },
      "direction": {
        "title": "方向",
        "description": "空间心理学,关乎我们看见什么。"
      },
      "timing": {
        "title": "时机",
        "description": "塑造生命的节律周期。"
      },
      "you": {
        "title": "你",
        "description": "你的出生背景、当下、和问题。"
      }
    },
    "promises": {
      "heading": "我们不会打破的三个承诺。",
      "never_stored": {
        "title": "从不存储",
        "description": "你的对话以加密形式存在你的设备上。我们读不到。任何人都读不到。"
      },
      "never_required": {
        "title": "从不强制",
        "description": "无需账户。无需登录。无需密码。除非你想要 PDF,否则也不需要邮箱。"
      },
      "never_manipulative": {
        "title": "从不操纵",
        "description": "没有黑暗模式。没有虚假紧迫。一个价格:$9.99,在你需要时。"
      },
      "read_more": "阅读完整隐私架构 →"
    },
    "final_cta": {
      "heading": "当问题挥之不去。",
      "subtitle": "停止阅读。开始穿越它。",
      "primary": "提出你的问题 — $9.99",
      "secondary": "或者先免费试试 Glyph →"
    }
  },
  
  "poju": {
    "hero": {
      "heading": "有时候,光是读还不够。",
      "description": "你已经读过书,跟朋友谈过,权衡过利弊。这个问题仍然不放过你。",
      "tagline": "POJU 在你独自思考之后开始。",
      "cta_primary": "提出你的问题 — $9.99",
      "cta_secondary": "看看它如何运作 ↓"
    },
    "when_to_come": {
      "heading": "什么时候来 POJU。",
      "stuck": {
        "title": "你卡在两条路之间",
        "description": "职业转变。关系抉择。在哪里生活。"
      },
      "confused": {
        "title": "你做了功课,反而更困惑",
        "description": "建议相互冲突。家庭压力。时间在流逝。"
      },
      "repeating": {
        "title": "某种模式不断重复,你不知道为什么",
        "description": "同样类型的关系。同样的阻塞。同样的挫折。"
      },
      "depth": {
        "title": "你需要朋友给不了的深度",
        "description": "你身边没人能拉开距离看清楚。"
      },
      "direction": {
        "title": "你想要方向,而不是预测",
        "description": "\"X 会发生吗\" 是占星。\"我该怎么做\" 是 POJU。"
      }
    },
    "how_it_works": {
      "heading": "POJU 如何运作",
      "subtitle": "不是一个答案 — 而是一个持续的破局循环。",
      "steps": {
        "1": "问题识别",
        "2": "信息收集",
        "3": "图案分析",
        "4": "核心分析",
        "5": "行动生成",
        "6": "执行追踪"
      },
      "footer": "你行动。你回来。路径调整。直到你穿越。"
    },
    "two_columns": {
      "heading": "两栏,一个承诺。",
      "included": {
        "title": "包含什么",
        "items": [
          "单次会话中无限的深度",
          "明天就能开始的行动计划",
          "可以静思的反思提示",
          "30 天会话访问"
        ]
      },
      "not_included": {
        "title": "不是什么",
        "items": [
          "不预测你的未来",
          "不替代专业建议",
          "不替你做决定"
        ]
      },
      "tagline": "POJU 是思考伙伴。决定永远是你的。",
      "cta": "提出你的问题 — $9.99",
      "footnote": "一个问题 · 无限深度 · 关闭即删除"
    }
  },
  
  "glyph": {
    "hero": {
      "heading": "Glyph",
      "subtitle": "60 秒的镜子。",
      "description": "握住一个问题。抽取一个图案。读一次反射。",
      "footnote": "免费。无需注册。带一丝玩味去读。",
      "cta": "免费体验 Glyph"
    },
    "five_winds": {
      "heading": "五种风 — 五种原型图案",
      "description": "这五种图案是镜子,不是预测。每一种都描述一种人类处境,帮你看清正在发生什么。",
      "divine_tailwind": {
        "name": "Divine Tailwind",
        "description": "完全对齐的稀有恩典。你需要的一切已经在朝你而来。"
      },
      "fair_sky": {
        "name": "Fair Sky",
        "description": "通畅的路,带着温柔的支持。道路开放,但你仍要走过去。"
      },
      "still_water": {
        "name": "Still Water",
        "description": "耐心和静止的时候。既不向前,也不向后。与当下共处。"
      },
      "crosswind": {
        "name": "Crosswind",
        "description": "互相竞争的力量在拉扯你。这不是用力推的信号。这是更仔细地倾听的信号。"
      },
      "eye_of_storm": {
        "name": "Eye of Storm",
        "description": "暴风眼中心的深度静止。当外面一切都在动荡时,清晰住在那个无可触及的地方。"
      }
    },
    "on_the_cards": {
      "heading": "关于图案。",
      "paragraphs": [
        "这五种 Glyph 不是命运的标签。它们不是\"好牌\"或\"坏牌\"。",
        "每一种都是一面透镜 — 一种阅读这个特定时刻、这个特定问题、由这个特定的人持有的方式。",
        "同一个 Glyph 在不同的日子、对不同的人、关于不同的问题,可以意味着完全不同的东西。",
        "你收到的不是判决。它是一个视角 — 一个邀请,让你更仔细地看。"
      ]
    },
    "how_it_works": {
      "heading": "Glyph 如何运作。",
      "step_1": {
        "title": "握住你的问题。",
        "description": "压缩到 60 个字符。压缩本身就是答案的开始。"
      },
      "step_2": {
        "title": "抽取你的图案。",
        "description": "100 种原型形态之一,经过千年提炼。"
      },
      "step_3": {
        "title": "读你的反射。",
        "description": "一份简短的回应 — 根植于智慧传统和现代心理学。"
      },
      "rules": [
        "每次一个问题。不要一次问很多。",
        "同一个问题,等 48 小时再问。答案需要时间沉淀。",
        "把你的问题压缩到 60 个字符。压缩是答案的开始。"
      ]
    },
    "final_cta": {
      "heading": "握住一个问题。",
      "subtitle": "你收到的不是判决。它是邀请,让你更仔细地看。",
      "cta": "免费体验 Glyph"
    }
  },
  
  "syncro": {
    "hero": {
      "heading": "Syncro",
      "subtitle": "看见你的自然节奏。",
      "description": "基于你的出生信息,Syncro 反映当日的能量如何与你对齐。哪里该投入,哪里该慢下来。",
      "tagline": "为你的内在世界提供天气预报,每两小时更新一次。",
      "footnote": "免费 · 仅在手机上打开",
      "cta": "打开 Syncro",
      "qr_label": "easternos.com/syncro",
      "sms_label": "把链接发给自己",
      "sms_button": "把链接发给我"
    },
    "what_shows": {
      "heading": "Syncro 显示什么。",
      "intro": "把手机指向某个方向。看到什么开放,什么不开放。",
      "items_intro": "每个方向显示:",
      "items": [
        "当前图案的简短描述",
        "这段时间适合什么(例如,缓慢的对话)",
        "这段时间不适合什么(例如,等等再提大要求)"
      ],
      "footnote": "每两小时更新一次,根据你的背景。"
    },
    "use_cases": {
      "heading": "人们在哪里使用 Syncro",
      "study": {
        "title": "学习场所",
        "description": "在深度工作前,选择一个支持稳定专注的桌子方向。"
      },
      "negotiation": {
        "title": "谈判",
        "description": "找一个支持自信和稳定沟通的座位方向。"
      },
      "bed": {
        "title": "床的方向",
        "description": "测试睡眠方向,比较休息质量随时间的变化。"
      },
      "travel": {
        "title": "出行决定",
        "description": "出发前查看方向基调,当时机和清晰都重要时。"
      },
      "companion": {
        "title": "POJU 伴侣",
        "description": "把 Syncro 作为现实层,然后回到 POJU 进行更深的决策策略。"
      }
    },
    "what_it_is": {
      "heading": "它是什么。它不是什么。",
      "shows": {
        "title": "它显示什么",
        "items": [
          "未来 2 小时的当前节奏图案",
          "八个方向以及它们适合什么",
          "哪里该投入,哪里该慢下来"
        ]
      },
      "isnt": {
        "title": "它不是什么",
        "items": [
          "事件的预测者",
          "结果的承诺者",
          "你自己判断的替代品"
        ]
      }
    },
    "always_free": {
      "heading": "永远免费。",
      "description": "Syncro 永远免费,作为你日常的节奏伴侣。当你需要对当下的清晰时,随时打开。",
      "cta": "在手机上打开 Syncro"
    }
  },
  
  "footer": {
    "disclaimers": {
      "home": "POJU 用于自我反思与启发。我们提供视角,而非预测。所有决定都由你自己做出。",
      "poju": "POJU 是思考伙伴。它提供视角,不是预言。所有决定都由你自己做出。",
      "glyph": "带一丝玩味去读。这些图案是镜子,不是预言。所有决定都由你自己做出。",
      "syncro": "Syncro 是自我觉察工具。取走与你共鸣的。决定由你自己做出。"
    },
    "links": {
      "home": "首页",
      "disclaimer": "免责声明",
      "privacy": "隐私政策",
      "terms": "服务条款",
      "contact": "联系我们"
    },
    "copyright": "© 2026 POJU. 版权所有。"
  }
}
```

## messages/es.json (墨西哥西班牙语)

```json
{
  "common": {
    "tagline": "Donde la IA se encuentra con mil años de sabiduría.",
    "footer_disclaimer": "Para autorreflexión y entretenimiento. POJU ofrece perspectivas, no predicciones. Todas las decisiones son tuyas.",
    "trust_line": "Sin cuenta · Sin suscripción · Tú decides",
    "read_with_wink": "Léelo con una sonrisa. Los patrones reflejan, no predicen."
  },
  
  "nav": {
    "poju": "POJU",
    "glyph": "Glyph",
    "syncro": "Syncro",
    "archive": "Archivo"
  },
  
  "home": {
    "hero": {
      "subtitle": "Donde la IA se encuentra con mil años de sabiduría.",
      "cta_primary": "Inicia una sesión POJU · $9.99",
      "cta_secondary": "Prueba Glyph · Gratis"
    },
    "three_ways": {
      "heading": "Tres formas de entrar. Una de salir.",
      "poju": {
        "tagline": "Para esa pregunta que no te suelta.",
        "description": "Una sola conversación profunda, hasta verla con claridad."
      },
      "glyph": {
        "tagline": "Un espejo de 60 segundos.",
        "description": "Sostén una pregunta. Saca un patrón. Lee un reflejo."
      },
      "syncro": {
        "tagline": "Ve tus ritmos naturales.",
        "description": "Actualizado cada dos horas, en tu teléfono."
      },
      "try_it": "Pruébalo →"
    },
    "two_languages": {
      "heading": "Donde dos lenguajes se encuentran.",
      "subtitles": [
        "Dos mil años de reflexión humana.",
        "Traducción moderna por IA.",
        "Una conversación que te ayuda a ver con claridad."
      ],
      "pattern": {
        "title": "PATRÓN",
        "description": "Observación antigua sobre lo que se repite."
      },
      "direction": {
        "title": "DIRECCIÓN",
        "description": "Psicología espacial sobre lo que notamos."
      },
      "timing": {
        "title": "TIEMPO",
        "description": "Ciclos que dan forma a la biología."
      },
      "you": {
        "title": "TÚ",
        "description": "Tu contexto de nacimiento, tu momento, tu pregunta."
      }
    },
    "promises": {
      "heading": "Tres promesas que no rompemos.",
      "never_stored": {
        "title": "Nunca guardado",
        "description": "Tus conversaciones viven cifradas en tu dispositivo. No las podemos leer. Nadie puede."
      },
      "never_required": {
        "title": "Nunca requerido",
        "description": "Sin cuenta. Sin login. Sin contraseña. Email solo si quieres un PDF."
      },
      "never_manipulative": {
        "title": "Nunca manipulador",
        "description": "Sin patrones oscuros. Sin urgencia falsa. Un solo precio: $9.99 cuando lo necesites."
      },
      "read_more": "Lee la arquitectura de privacidad completa →"
    },
    "final_cta": {
      "heading": "Cuando la pregunta no te suelta.",
      "subtitle": "Deja de leer. Empieza a atravesarla.",
      "primary": "Haz tu pregunta — $9.99",
      "secondary": "O prueba Glyph gratis primero →"
    }
  },
  
  "poju": {
    "hero": {
      "heading": "A veces, leer no es suficiente.",
      "description": "Ya leíste los libros, hablaste con amigos y pesaste los pros y contras. La pregunta sigue sin soltarte.",
      "tagline": "POJU es lo que viene después de pensar a solas.",
      "cta_primary": "Haz tu pregunta — $9.99",
      "cta_secondary": "Ver cómo funciona ↓"
    },
    "when_to_come": {
      "heading": "Cuándo venir a POJU.",
      "stuck": {
        "title": "Estás atrapado entre dos caminos",
        "description": "Cambio de carrera. Decisión de relación. Dónde vivir."
      },
      "confused": {
        "title": "Investigaste y estás más confundido",
        "description": "Consejos contradictorios. Presión familiar. Reloj corriendo."
      },
      "repeating": {
        "title": "Algo se repite y no sabes por qué",
        "description": "El mismo tipo de relación. Los mismos bloqueos. Los mismos contratiempos."
      },
      "depth": {
        "title": "Necesitas profundidad que tus amigos no pueden dar",
        "description": "Nadie a tu alrededor tiene la distancia para ver con claridad."
      },
      "direction": {
        "title": "Quieres dirección, no predicción",
        "description": "\"¿Va a pasar X?\" es astrología. \"¿Qué debo hacer?\" es POJU."
      }
    },
    "how_it_works": {
      "heading": "Cómo funciona POJU",
      "subtitle": "No una sola respuesta — un ciclo continuo de avance.",
      "steps": {
        "1": "Identificación del problema",
        "2": "Recolección de información",
        "3": "Análisis de patrones",
        "4": "Análisis central",
        "5": "Generación de acciones",
        "6": "Seguimiento de implementación"
      },
      "footer": "Actúas. Vuelves. El camino se ajusta. Hasta que atraviesas."
    },
    "two_columns": {
      "heading": "Dos columnas, una promesa.",
      "included": {
        "title": "Lo que incluye",
        "items": [
          "Profundidad ilimitada en una sola sesión",
          "Plan de acción que puedes ejecutar mañana",
          "Preguntas reflexivas para sentarte con ellas",
          "30 días de acceso a la sesión"
        ]
      },
      "not_included": {
        "title": "Lo que no es",
        "items": [
          "No predice tu futuro",
          "No reemplaza el consejo profesional",
          "No toma decisiones por ti"
        ]
      },
      "tagline": "POJU es un compañero de pensamiento. Las decisiones siguen siendo tuyas.",
      "cta": "Haz tu pregunta — $9.99",
      "footnote": "Una pregunta · Profundidad ilimitada · Se borra al cerrar"
    }
  },
  
  "glyph": {
    "hero": {
      "heading": "Glyph",
      "subtitle": "Un espejo de 60 segundos.",
      "description": "Sostén una pregunta. Saca un patrón. Lee un reflejo.",
      "footnote": "Gratis. Sin registro. Léelo con una sonrisa.",
      "cta": "Prueba Glyph — Gratis"
    },
    "five_winds": {
      "heading": "Cinco vientos — cinco patrones arquetípicos",
      "description": "Los cinco patrones son espejos, no predicciones. Cada uno describe una situación humana y te ayuda a enmarcar lo que ya está pasando.",
      "divine_tailwind": {
        "name": "Divine Tailwind",
        "description": "La rara gracia del alineamiento total. Todo lo que necesitas ya viene hacia ti."
      },
      "fair_sky": {
        "name": "Fair Sky",
        "description": "Caminos despejados con apoyo gentil. La vía está abierta, pero aún tienes que caminarla."
      },
      "still_water": {
        "name": "Still Water",
        "description": "Tiempo de paciencia y quietud. Ni adelante, ni atrás. Siéntate con lo que es."
      },
      "crosswind": {
        "name": "Crosswind",
        "description": "Fuerzas en competencia te jalan. Esta no es señal de empujar más fuerte. Es señal de escuchar más cuidadosamente."
      },
      "eye_of_storm": {
        "name": "Eye of Storm",
        "description": "La quietud profunda en el centro de una tormenta. Cuando todo lo externo es turbulento, la claridad vive en el único lugar que nada puede alcanzar."
      }
    },
    "on_the_cards": {
      "heading": "Sobre las cartas.",
      "paragraphs": [
        "Los cinco glyphs no son etiquetas de fortuna. No son \"buenas cartas\" o \"malas cartas.\"",
        "Cada uno es una lente — una forma de leer este momento particular, para esta pregunta particular, sostenida por esta persona particular.",
        "El mismo glyph puede significar cosas completamente diferentes en días diferentes, para personas diferentes, sobre preguntas diferentes.",
        "Lo que recibes no es un veredicto. Es una perspectiva — y una invitación a mirar con más cuidado."
      ]
    },
    "how_it_works": {
      "heading": "Cómo funciona Glyph.",
      "step_1": {
        "title": "Sostén tu pregunta.",
        "description": "Compáctala a 60 caracteres. La compresión inicia la respuesta."
      },
      "step_2": {
        "title": "Saca tu patrón.",
        "description": "Una de 100 formas arquetípicas, refinadas durante mil años."
      },
      "step_3": {
        "title": "Lee tu reflejo.",
        "description": "Una respuesta breve — basada en tradiciones de sabiduría y psicología moderna."
      },
      "rules": [
        "Una pregunta por lectura. No preguntes muchas a la vez.",
        "Espera 48 horas antes de preguntar lo mismo de nuevo. Las respuestas necesitan tiempo para asentarse.",
        "Compacta tu pregunta a 60 caracteres. La compresión es el inicio de la respuesta."
      ]
    },
    "final_cta": {
      "heading": "Sostén una pregunta.",
      "subtitle": "Lo que recibes no es un veredicto. Es una invitación a mirar con más cuidado.",
      "cta": "Prueba Glyph — Gratis"
    }
  },
  
  "syncro": {
    "hero": {
      "heading": "Syncro",
      "subtitle": "Ve tus ritmos naturales.",
      "description": "Basado en tu contexto de nacimiento, Syncro refleja cómo los patrones del día se alinean contigo. Dónde inclinarte, dónde frenar.",
      "tagline": "Un pronóstico del clima para tu vida interior, actualizado cada dos horas.",
      "footnote": "Gratis · Solo se abre en móvil",
      "cta": "Abrir Syncro",
      "qr_label": "easternos.com/syncro",
      "sms_label": "Envíate el enlace",
      "sms_button": "Envíame el enlace"
    },
    "what_shows": {
      "heading": "Lo que Syncro muestra.",
      "intro": "Apunta tu teléfono hacia una dirección. Ve qué está disponible. Ve qué no.",
      "items_intro": "Cada dirección muestra:",
      "items": [
        "Una descripción breve del patrón actual",
        "Para qué sirve este período (por ejemplo, conversaciones lentas)",
        "Para qué no sirve (por ejemplo, espera para pedir cosas grandes)"
      ],
      "footnote": "Actualizado cada dos horas, con tu contexto."
    },
    "use_cases": {
      "heading": "Dónde la gente usa Syncro",
      "study": {
        "title": "Lugar de estudio",
        "description": "Elige una orientación de escritorio que apoye el enfoque sostenido antes de un bloque de trabajo profundo."
      },
      "negotiation": {
        "title": "Negociación",
        "description": "Encuentra una orientación de asiento que apoye la confianza y comunicación más estable."
      },
      "bed": {
        "title": "Orientación de cama",
        "description": "Prueba direcciones para dormir y compara cómo cambia la calidad de tu descanso con el tiempo."
      },
      "travel": {
        "title": "Decisión de viaje",
        "description": "Revisa el tono direccional antes de salir, cuando tanto el tiempo como la claridad importan."
      },
      "companion": {
        "title": "Compañero de POJU",
        "description": "Usa Syncro como capa del mundo real, luego vuelve a POJU para estrategia de decisión más profunda."
      }
    },
    "what_it_is": {
      "heading": "Lo que es. Lo que no es.",
      "shows": {
        "title": "Lo que muestra",
        "items": [
          "Patrón de ritmo actual para las próximas 2 horas",
          "Ocho direcciones con para qué sirven",
          "Dónde inclinarte, dónde frenar"
        ]
      },
      "isnt": {
        "title": "Lo que no es",
        "items": [
          "Un predictor de eventos",
          "Un prometedor de resultados",
          "Un reemplazo de tu propio juicio"
        ]
      }
    },
    "always_free": {
      "heading": "Siempre gratis.",
      "description": "Syncro se queda gratis como tu compañero diario de ritmo. Ábrelo cuando necesites claridad sobre el momento.",
      "cta": "Abrir Syncro en móvil"
    }
  },
  
  "footer": {
    "disclaimers": {
      "home": "Para autorreflexión y entretenimiento. POJU ofrece perspectivas, no predicciones. Todas las decisiones son tuyas.",
      "poju": "POJU es un compañero de pensamiento. Ofrece perspectivas, no profecías. Todas las decisiones son tuyas.",
      "glyph": "Léelo con una sonrisa. Los patrones reflejan, no predicen. Todas las decisiones son tuyas.",
      "syncro": "Syncro es una herramienta de auto-conciencia. Toma lo que resuene. Las decisiones son tuyas."
    },
    "links": {
      "home": "Inicio",
      "disclaimer": "Aviso legal",
      "privacy": "Política de privacidad",
      "terms": "Términos de servicio",
      "contact": "Contacto"
    },
    "copyright": "© 2026 POJU. Todos los derechos reservados."
  }
}
```

## messages/fr.json (法语)

```json
{
  "common": {
    "tagline": "Là où l'IA rencontre mille ans de sagesse.",
    "footer_disclaimer": "Pour la réflexion personnelle et le divertissement. POJU offre des perspectives, pas des prédictions. Toutes les décisions vous appartiennent.",
    "trust_line": "Pas de compte · Pas d'abonnement · À vous de décider",
    "read_with_wink": "Lisez avec un clin d'œil. Les motifs reflètent, ils ne prédisent pas."
  },
  
  "nav": {
    "poju": "POJU",
    "glyph": "Glyph",
    "syncro": "Syncro",
    "archive": "Archives"
  },
  
  "home": {
    "hero": {
      "subtitle": "Là où l'IA rencontre mille ans de sagesse.",
      "cta_primary": "Commencer une session POJU · $9.99",
      "cta_secondary": "Essayer Glyph · Gratuit"
    },
    "three_ways": {
      "heading": "Trois entrées. Un seul passage.",
      "poju": {
        "tagline": "Pour la question qui ne vous lâche pas.",
        "description": "Une seule conversation profonde, jusqu'à la traverser."
      },
      "glyph": {
        "tagline": "Un miroir de 60 secondes.",
        "description": "Tenez une question. Tirez un motif. Lisez un reflet."
      },
      "syncro": {
        "tagline": "Voyez vos rythmes naturels.",
        "description": "Mis à jour toutes les deux heures, sur votre téléphone."
      },
      "try_it": "Essayer →"
    },
    "two_languages": {
      "heading": "Là où deux langages se rencontrent.",
      "subtitles": [
        "Deux mille ans de réflexion humaine.",
        "Traduction moderne par IA.",
        "Une conversation qui vous aide à voir clair."
      ],
      "pattern": {
        "title": "MOTIF",
        "description": "Observation ancienne sur ce qui se répète."
      },
      "direction": {
        "title": "DIRECTION",
        "description": "Psychologie spatiale sur ce que nous remarquons."
      },
      "timing": {
        "title": "MOMENT",
        "description": "Cycles qui façonnent la biologie."
      },
      "you": {
        "title": "VOUS",
        "description": "Votre contexte de naissance, votre moment, votre question."
      }
    },
    "promises": {
      "heading": "Trois promesses que nous tenons.",
      "never_stored": {
        "title": "Jamais stocké",
        "description": "Vos conversations vivent chiffrées sur votre appareil. Nous ne pouvons pas les lire. Personne ne le peut."
      },
      "never_required": {
        "title": "Jamais requis",
        "description": "Pas de compte. Pas de connexion. Pas de mot de passe. Email seulement si vous voulez un PDF."
      },
      "never_manipulative": {
        "title": "Jamais manipulateur",
        "description": "Pas de schémas trompeurs. Pas de fausse urgence. Un seul prix : $9.99 quand vous en avez besoin."
      },
      "read_more": "Lire l'architecture complète de la confidentialité →"
    },
    "final_cta": {
      "heading": "Quand la question ne vous lâche pas.",
      "subtitle": "Arrêtez de lire. Commencez à la traverser.",
      "primary": "Posez votre question — $9.99",
      "secondary": "Ou essayez Glyph gratuitement d'abord →"
    }
  },
  
  "poju": {
    "hero": {
      "heading": "Parfois, lire ne suffit pas.",
      "description": "Vous avez déjà lu les livres, parlé aux amis, pesé le pour et le contre. La question continue de vous tenir.",
      "tagline": "POJU est ce qui vient après avoir pensé seul.",
      "cta_primary": "Posez votre question — $9.99",
      "cta_secondary": "Voir comment ça marche ↓"
    },
    "when_to_come": {
      "heading": "Quand venir vers POJU.",
      "stuck": {
        "title": "Vous êtes coincé entre deux chemins",
        "description": "Changement de carrière. Décision de relation. Où vivre."
      },
      "confused": {
        "title": "Vous avez fait vos recherches et êtes plus confus",
        "description": "Conseils contradictoires. Pression familiale. Le temps presse."
      },
      "repeating": {
        "title": "Quelque chose se répète et vous ne savez pas pourquoi",
        "description": "Le même type de relation. Les mêmes blocages. Les mêmes revers."
      },
      "depth": {
        "title": "Vous avez besoin d'une profondeur que vos amis ne peuvent donner",
        "description": "Personne autour de vous n'a la distance pour voir clairement."
      },
      "direction": {
        "title": "Vous voulez une direction, pas une prédiction",
        "description": "\"Est-ce que X va arriver\" est de l'astrologie. \"Que devrais-je faire\" est POJU."
      }
    },
    "how_it_works": {
      "heading": "Comment POJU fonctionne",
      "subtitle": "Pas une seule réponse — une boucle de percée continue.",
      "steps": {
        "1": "Identification du problème",
        "2": "Collecte d'informations",
        "3": "Analyse des motifs",
        "4": "Analyse centrale",
        "5": "Génération d'actions",
        "6": "Suivi de mise en œuvre"
      },
      "footer": "Vous agissez. Vous revenez. Le chemin s'ajuste. Jusqu'à ce que vous traversiez."
    },
    "two_columns": {
      "heading": "Deux colonnes, une promesse.",
      "included": {
        "title": "Ce qui est inclus",
        "items": [
          "Profondeur illimitée dans une seule session",
          "Plan d'action à exécuter dès demain",
          "Questions de réflexion à méditer",
          "Accès à la session pendant 30 jours"
        ]
      },
      "not_included": {
        "title": "Ce que ce n'est pas",
        "items": [
          "Ne prédit pas votre avenir",
          "Ne remplace pas un conseil professionnel",
          "Ne prend pas de décisions à votre place"
        ]
      },
      "tagline": "POJU est un partenaire de réflexion. Les décisions restent les vôtres.",
      "cta": "Posez votre question — $9.99",
      "footnote": "Une question · Profondeur illimitée · S'efface à la fermeture"
    }
  },
  
  "glyph": {
    "hero": {
      "heading": "Glyph",
      "subtitle": "Un miroir de 60 secondes.",
      "description": "Tenez une question. Tirez un motif. Lisez un reflet.",
      "footnote": "Gratuit. Pas d'inscription. Lisez avec un clin d'œil.",
      "cta": "Essayer Glyph — Gratuit"
    },
    "five_winds": {
      "heading": "Cinq vents — cinq motifs archétypaux",
      "description": "Les cinq motifs sont des miroirs, pas des prédictions. Chacun décrit une situation humaine et vous aide à cadrer ce qui se passe déjà.",
      "divine_tailwind": {
        "name": "Divine Tailwind",
        "description": "La grâce rare de l'alignement total. Tout ce dont vous avez besoin avance déjà vers vous."
      },
      "fair_sky": {
        "name": "Fair Sky",
        "description": "Chemins clairs avec un soutien doux. La voie est ouverte, mais vous devez encore la parcourir."
      },
      "still_water": {
        "name": "Still Water",
        "description": "Le temps de la patience et de l'immobilité. Ni en avant, ni en arrière. Asseyez-vous avec ce qui est."
      },
      "crosswind": {
        "name": "Crosswind",
        "description": "Des forces concurrentes vous tirent. Ce n'est pas un signal pour pousser plus fort. C'est un signal pour écouter plus attentivement."
      },
      "eye_of_storm": {
        "name": "Eye of Storm",
        "description": "La profonde immobilité au centre d'une tempête. Quand tout l'extérieur est turbulent, la clarté habite le seul endroit que rien ne peut atteindre."
      }
    },
    "on_the_cards": {
      "heading": "À propos des cartes.",
      "paragraphs": [
        "Les cinq glyphs ne sont pas des étiquettes de fortune. Ce ne sont pas des \"bonnes cartes\" ou \"mauvaises cartes\".",
        "Chacun est une lentille — une façon de lire ce moment particulier, pour cette question particulière, tenue par cette personne particulière.",
        "Le même glyph peut signifier des choses entièrement différentes selon les jours, pour des personnes différentes, sur des questions différentes.",
        "Ce que vous recevez n'est pas un verdict. C'est une perspective — et une invitation à regarder plus attentivement."
      ]
    },
    "how_it_works": {
      "heading": "Comment Glyph fonctionne.",
      "step_1": {
        "title": "Tenez votre question.",
        "description": "Compressez-la à 60 caractères. La compression commence la réponse."
      },
      "step_2": {
        "title": "Tirez votre motif.",
        "description": "L'une de 100 formes archétypales, raffinées sur mille ans."
      },
      "step_3": {
        "title": "Lisez votre reflet.",
        "description": "Une réponse brève — ancrée dans les traditions de sagesse et la psychologie moderne."
      },
      "rules": [
        "Une question par lecture. Ne demandez pas plusieurs choses à la fois.",
        "Attendez 48 heures avant de redemander la même chose. Les réponses ont besoin de temps pour se déposer.",
        "Compressez votre question à 60 caractères. La compression est le début de la réponse."
      ]
    },
    "final_cta": {
      "heading": "Tenez une question.",
      "subtitle": "Ce que vous recevez n'est pas un verdict. C'est une invitation à regarder plus attentivement.",
      "cta": "Essayer Glyph — Gratuit"
    }
  },
  
  "syncro": {
    "hero": {
      "heading": "Syncro",
      "subtitle": "Voyez vos rythmes naturels.",
      "description": "Basé sur votre contexte de naissance, Syncro reflète comment les motifs du jour s'alignent avec vous. Où s'engager. Où ralentir.",
      "tagline": "Une prévision météo pour votre vie intérieure, mise à jour toutes les deux heures.",
      "footnote": "Gratuit · S'ouvre uniquement sur mobile",
      "cta": "Ouvrir Syncro",
      "qr_label": "easternos.com/syncro",
      "sms_label": "Envoyez-vous le lien",
      "sms_button": "Envoyez-moi le lien"
    },
    "what_shows": {
      "heading": "Ce que Syncro montre.",
      "intro": "Pointez votre téléphone vers une direction. Voyez ce qui est disponible. Voyez ce qui ne l'est pas.",
      "items_intro": "Chaque direction montre :",
      "items": [
        "Une brève description du motif actuel",
        "À quoi cette période convient (par exemple, conversations lentes)",
        "À quoi cette période ne convient pas (par exemple, attendre pour les grandes demandes)"
      ],
      "footnote": "Mis à jour toutes les deux heures, avec votre contexte."
    },
    "use_cases": {
      "heading": "Où les gens utilisent Syncro",
      "study": {
        "title": "Lieu d'étude",
        "description": "Choisissez une orientation de bureau qui soutient une concentration stable avant un bloc de travail profond."
      },
      "negotiation": {
        "title": "Négociation",
        "description": "Trouvez une orientation d'assise qui soutient la confiance et une communication plus stable."
      },
      "bed": {
        "title": "Orientation du lit",
        "description": "Testez les directions de sommeil et comparez comment la qualité de votre repos change au fil du temps."
      },
      "travel": {
        "title": "Décision de voyage",
        "description": "Vérifiez le ton directionnel avant de partir, quand le timing et la clarté comptent tous les deux."
      },
      "companion": {
        "title": "Compagnon POJU",
        "description": "Utilisez Syncro comme couche du monde réel, puis revenez à POJU pour une stratégie de décision plus profonde."
      }
    },
    "what_it_is": {
      "heading": "Ce que c'est. Ce que ce n'est pas.",
      "shows": {
        "title": "Ce que ça montre",
        "items": [
          "Motif de rythme actuel pour les 2 prochaines heures",
          "Huit directions avec ce à quoi elles conviennent",
          "Où s'engager, où ralentir"
        ]
      },
      "isnt": {
        "title": "Ce que ce n'est pas",
        "items": [
          "Un prédicteur d'événements",
          "Un promesseur de résultats",
          "Un remplacement de votre propre jugement"
        ]
      }
    },
    "always_free": {
      "heading": "Toujours gratuit.",
      "description": "Syncro reste gratuit comme votre compagnon de rythme quotidien. Ouvrez-le quand vous avez besoin de clarté sur le moment.",
      "cta": "Ouvrir Syncro sur mobile"
    }
  },
  
  "footer": {
    "disclaimers": {
      "home": "Pour la réflexion personnelle et le divertissement. POJU offre des perspectives, pas des prédictions. Toutes les décisions vous appartiennent.",
      "poju": "POJU est un partenaire de réflexion. Il offre des perspectives, pas des prophéties. Toutes les décisions vous appartiennent.",
      "glyph": "Lisez avec un clin d'œil. Les motifs reflètent, ils ne prédisent pas. Toutes les décisions vous appartiennent.",
      "syncro": "Syncro est un outil de conscience de soi. Prenez ce qui résonne. Les décisions vous appartiennent."
    },
    "links": {
      "home": "Accueil",
      "disclaimer": "Avertissement",
      "privacy": "Politique de confidentialité",
      "terms": "Conditions d'utilisation",
      "contact": "Contact"
    },
    "copyright": "© 2026 POJU. Tous droits réservés."
  }
}
```

## messages/de.json (德语)

```json
{
  "common": {
    "tagline": "Wo KI auf tausend Jahre Weisheit trifft.",
    "footer_disclaimer": "Zur Selbstreflexion und Unterhaltung. POJU bietet Perspektiven, keine Vorhersagen. Alle Entscheidungen liegen bei dir.",
    "trust_line": "Kein Konto · Kein Abo · Du entscheidest",
    "read_with_wink": "Lies mit einem Augenzwinkern. Die Muster spiegeln, sie sagen nicht voraus."
  },
  
  "nav": {
    "poju": "POJU",
    "glyph": "Glyph",
    "syncro": "Syncro",
    "archive": "Archiv"
  },
  
  "home": {
    "hero": {
      "subtitle": "Wo KI auf tausend Jahre Weisheit trifft.",
      "cta_primary": "POJU-Sitzung starten · $9.99",
      "cta_secondary": "Glyph kostenlos testen"
    },
    "three_ways": {
      "heading": "Drei Wege hinein. Ein Weg hindurch.",
      "poju": {
        "tagline": "Für die Frage, die dich nicht loslässt.",
        "description": "Ein einziges tiefes Gespräch, bis du es durchschaut hast."
      },
      "glyph": {
        "tagline": "Ein 60-Sekunden-Spiegel.",
        "description": "Halte eine Frage. Ziehe ein Muster. Lies eine Spiegelung."
      },
      "syncro": {
        "tagline": "Sieh deine natürlichen Rhythmen.",
        "description": "Aktualisiert alle zwei Stunden, auf deinem Telefon."
      },
      "try_it": "Ausprobieren →"
    },
    "two_languages": {
      "heading": "Wo zwei Sprachen sich treffen.",
      "subtitles": [
        "Zweitausend Jahre menschlicher Reflexion.",
        "Moderne KI-Übersetzung.",
        "Ein Gespräch, das dir hilft, klar zu sehen."
      ],
      "pattern": {
        "title": "MUSTER",
        "description": "Alte Beobachtung dessen, was wiederkehrt."
      },
      "direction": {
        "title": "RICHTUNG",
        "description": "Räumliche Psychologie über das, was wir wahrnehmen."
      },
      "timing": {
        "title": "ZEITPUNKT",
        "description": "Zyklen, die die Biologie formen."
      },
      "you": {
        "title": "DU",
        "description": "Dein Geburtskontext, dein Moment, deine Frage."
      }
    },
    "promises": {
      "heading": "Drei Versprechen, die wir nicht brechen.",
      "never_stored": {
        "title": "Nie gespeichert",
        "description": "Deine Gespräche leben verschlüsselt auf deinem Gerät. Wir können sie nicht lesen. Niemand kann."
      },
      "never_required": {
        "title": "Nie erforderlich",
        "description": "Kein Konto. Kein Login. Kein Passwort. E-Mail nur, wenn du ein PDF willst."
      },
      "never_manipulative": {
        "title": "Nie manipulativ",
        "description": "Keine dunklen Muster. Keine falsche Dringlichkeit. Ein Preis: $9.99, wenn du es brauchst."
      },
      "read_more": "Vollständige Datenschutzarchitektur lesen →"
    },
    "final_cta": {
      "heading": "Wenn die Frage dich nicht loslässt.",
      "subtitle": "Hör auf zu lesen. Fang an, sie zu durchqueren.",
      "primary": "Stell deine Frage — $9.99",
      "secondary": "Oder probier Glyph erst kostenlos →"
    }
  },
  
  "poju": {
    "hero": {
      "heading": "Manchmal reicht Lesen nicht aus.",
      "description": "Du hast bereits die Bücher gelesen, mit Freunden gesprochen und das Für und Wider abgewogen. Die Frage lässt dich immer noch nicht los.",
      "tagline": "POJU ist das, was nach dem alleine Denken kommt.",
      "cta_primary": "Stell deine Frage — $9.99",
      "cta_secondary": "Wie es funktioniert ↓"
    },
    "when_to_come": {
      "heading": "Wann zu POJU kommen.",
      "stuck": {
        "title": "Du steckst zwischen zwei Wegen fest",
        "description": "Karrierewechsel. Beziehungsentscheidung. Wo wohnen."
      },
      "confused": {
        "title": "Du hast recherchiert und bist verwirrter",
        "description": "Widersprüchliche Ratschläge. Familiendruck. Eine tickende Uhr."
      },
      "repeating": {
        "title": "Etwas wiederholt sich und du weißt nicht warum",
        "description": "Die gleiche Art von Beziehung. Die gleichen Blockaden. Die gleichen Rückschläge."
      },
      "depth": {
        "title": "Du brauchst Tiefe, die Freunde nicht geben können",
        "description": "Niemand um dich herum hat den Abstand, klar zu sehen."
      },
      "direction": {
        "title": "Du willst Richtung, keine Vorhersage",
        "description": "\"Wird X passieren\" ist Astrologie. \"Was sollte ich tun\" ist POJU."
      }
    },
    "how_it_works": {
      "heading": "Wie POJU funktioniert",
      "subtitle": "Nicht eine einzelne Antwort — eine kontinuierliche Durchbruchschleife.",
      "steps": {
        "1": "Problemidentifikation",
        "2": "Informationssammlung",
        "3": "Musteranalyse",
        "4": "Kernanalyse",
        "5": "Aktionsgenerierung",
        "6": "Umsetzungsverfolgung"
      },
      "footer": "Du handelst. Du kommst zurück. Der Weg passt sich an. Bis du hindurchgehst."
    },
    "two_columns": {
      "heading": "Zwei Spalten, ein Versprechen.",
      "included": {
        "title": "Was enthalten ist",
        "items": [
          "Unbegrenzte Tiefe in einer einzigen Sitzung",
          "Aktionsplan, den du morgen umsetzen kannst",
          "Reflexionsfragen zum Verweilen",
          "30 Tage Sitzungszugang"
        ]
      },
      "not_included": {
        "title": "Was es nicht ist",
        "items": [
          "Sagt deine Zukunft nicht voraus",
          "Ersetzt keinen professionellen Rat",
          "Trifft keine Entscheidungen für dich"
        ]
      },
      "tagline": "POJU ist ein Denkpartner. Die Entscheidungen bleiben bei dir.",
      "cta": "Stell deine Frage — $9.99",
      "footnote": "Eine Frage · Unbegrenzte Tiefe · Wird beim Schließen gelöscht"
    }
  },
  
  "glyph": {
    "hero": {
      "heading": "Glyph",
      "subtitle": "Ein 60-Sekunden-Spiegel.",
      "description": "Halte eine Frage. Ziehe ein Muster. Lies eine Spiegelung.",
      "footnote": "Kostenlos. Keine Anmeldung. Lies mit einem Augenzwinkern.",
      "cta": "Glyph kostenlos testen"
    },
    "five_winds": {
      "heading": "Fünf Winde — fünf archetypische Muster",
      "description": "Die fünf Muster sind Spiegel, keine Vorhersagen. Jedes beschreibt eine menschliche Situation und hilft dir, das einzuordnen, was bereits geschieht.",
      "divine_tailwind": {
        "name": "Divine Tailwind",
        "description": "Die seltene Anmut völliger Ausrichtung. Alles, was du brauchst, bewegt sich bereits auf dich zu."
      },
      "fair_sky": {
        "name": "Fair Sky",
        "description": "Klare Pfade mit sanfter Unterstützung. Der Weg ist offen, aber du musst ihn trotzdem gehen."
      },
      "still_water": {
        "name": "Still Water",
        "description": "Die Zeit für Geduld und Stille. Weder vorwärts noch rückwärts. Sitze mit dem, was ist."
      },
      "crosswind": {
        "name": "Crosswind",
        "description": "Konkurrierende Kräfte ziehen an dir. Das ist kein Hinweis, härter zu drücken. Es ist ein Hinweis, sorgfältiger zuzuhören."
      },
      "eye_of_storm": {
        "name": "Eye of Storm",
        "description": "Die tiefe Stille im Zentrum eines Sturms. Wenn alles Äußere turbulent ist, lebt Klarheit am einzigen Ort, den nichts erreichen kann."
      }
    },
    "on_the_cards": {
      "heading": "Über die Karten.",
      "paragraphs": [
        "Die fünf Glyphs sind keine Etiketten des Schicksals. Sie sind keine \"guten Karten\" oder \"schlechten Karten\".",
        "Jede ist eine Linse — eine Art, diesen besonderen Moment zu lesen, für diese besondere Frage, gehalten von dieser besonderen Person.",
        "Der gleiche Glyph kann an verschiedenen Tagen, für verschiedene Personen, über verschiedene Fragen, völlig verschiedene Dinge bedeuten.",
        "Was du erhältst, ist kein Urteil. Es ist eine Perspektive — und eine Einladung, genauer hinzusehen."
      ]
    },
    "how_it_works": {
      "heading": "Wie Glyph funktioniert.",
      "step_1": {
        "title": "Halte deine Frage.",
        "description": "Komprimiere sie auf 60 Zeichen. Die Komprimierung beginnt die Antwort."
      },
      "step_2": {
        "title": "Ziehe dein Muster.",
        "description": "Eine von 100 archetypischen Formen, verfeinert über tausend Jahre."
      },
      "step_3": {
        "title": "Lies deine Spiegelung.",
        "description": "Eine kurze Antwort — verwurzelt in Weisheitstraditionen und moderner Psychologie."
      },
      "rules": [
        "Eine Frage pro Lesung. Frage nicht viele Dinge auf einmal.",
        "Warte 48 Stunden, bevor du dasselbe wieder fragst. Antworten brauchen Zeit, sich zu setzen.",
        "Komprimiere deine Frage auf 60 Zeichen. Die Komprimierung ist der Anfang der Antwort."
      ]
    },
    "final_cta": {
      "heading": "Halte eine Frage.",
      "subtitle": "Was du erhältst, ist kein Urteil. Es ist eine Einladung, genauer hinzusehen.",
      "cta": "Glyph kostenlos testen"
    }
  },
  
  "syncro": {
    "hero": {
      "heading": "Syncro",
      "subtitle": "Sieh deine natürlichen Rhythmen.",
      "description": "Basierend auf deinem Geburtskontext spiegelt Syncro wider, wie die Muster des Tages sich mit dir ausrichten. Wo lehnen, wo verlangsamen.",
      "tagline": "Eine Wettervorhersage für dein Innenleben, alle zwei Stunden aktualisiert.",
      "footnote": "Kostenlos · Öffnet nur auf dem Handy",
      "cta": "Syncro öffnen",
      "qr_label": "easternos.com/syncro",
      "sms_label": "Sende dir den Link",
      "sms_button": "Schick mir den Link"
    },
    "what_shows": {
      "heading": "Was Syncro zeigt.",
      "intro": "Halte dein Telefon in eine Richtung. Sieh, was verfügbar ist. Sieh, was nicht.",
      "items_intro": "Jede Richtung zeigt:",
      "items": [
        "Eine kurze Beschreibung des aktuellen Musters",
        "Wofür diese Periode geeignet ist (zum Beispiel, langsame Gespräche)",
        "Wofür diese Periode nicht geeignet ist (zum Beispiel, mit großen Anfragen warten)"
      ],
      "footnote": "Alle zwei Stunden aktualisiert, mit deinem Kontext."
    },
    "use_cases": {
      "heading": "Wo Menschen Syncro nutzen",
      "study": {
        "title": "Lernort",
        "description": "Wähle eine Schreibtischausrichtung, die stetigen Fokus vor einem tiefen Arbeitsblock unterstützt."
      },
      "negotiation": {
        "title": "Verhandlung",
        "description": "Finde eine Sitzausrichtung, die Selbstvertrauen und stabilere Kommunikation unterstützt."
      },
      "bed": {
        "title": "Bettausrichtung",
        "description": "Teste Schlafrichtungen und vergleiche, wie sich deine Schlafqualität im Laufe der Zeit ändert."
      },
      "travel": {
        "title": "Reiseentscheidung",
        "description": "Prüfe den Richtungston vor dem Aufbruch, wenn sowohl Timing als auch Klarheit wichtig sind."
      },
      "companion": {
        "title": "POJU-Begleiter",
        "description": "Nutze Syncro als Schicht der echten Welt, kehre dann zu POJU zurück für tiefere Entscheidungsstrategie."
      }
    },
    "what_it_is": {
      "heading": "Was es ist. Was es nicht ist.",
      "shows": {
        "title": "Was es zeigt",
        "items": [
          "Aktuelles Rhythmusmuster für die nächsten 2 Stunden",
          "Acht Richtungen mit ihren Eignungen",
          "Wo sich lehnen, wo verlangsamen"
        ]
      },
      "isnt": {
        "title": "Was es nicht ist",
        "items": [
          "Ein Vorhersager von Ereignissen",
          "Ein Versprecher von Ergebnissen",
          "Ein Ersatz für dein eigenes Urteil"
        ]
      }
    },
    "always_free": {
      "heading": "Immer kostenlos.",
      "description": "Syncro bleibt kostenlos als dein täglicher Rhythmusbegleiter. Öffne es, wann immer du Klarheit über den Moment brauchst.",
      "cta": "Syncro auf dem Handy öffnen"
    }
  },
  
  "footer": {
    "disclaimers": {
      "home": "Zur Selbstreflexion und Unterhaltung. POJU bietet Perspektiven, keine Vorhersagen. Alle Entscheidungen liegen bei dir.",
      "poju": "POJU ist ein Denkpartner. Es bietet Perspektiven, keine Prophezeiungen. Alle Entscheidungen liegen bei dir.",
      "glyph": "Lies mit einem Augenzwinkern. Die Muster spiegeln, sie sagen nicht voraus. Alle Entscheidungen liegen bei dir.",
      "syncro": "Syncro ist ein Selbstwahrnehmungswerkzeug. Nimm, was bei dir ankommt. Die Entscheidungen liegen bei dir."
    },
    "links": {
      "home": "Startseite",
      "disclaimer": "Haftungsausschluss",
      "privacy": "Datenschutz",
      "terms": "Nutzungsbedingungen",
      "contact": "Kontakt"
    },
    "copyright": "© 2026 POJU. Alle Rechte vorbehalten."
  }
}
```

---

# Part 6: 翻译质量验证

## ⚠️ 重要警告

```
我提供的翻译是【高质量初版】,基于 Claude 多语言能力翻译。

但你不应该直接用这版本上线。

需要做:
  ✅ 母语人士 review(每种语言)
  ✅ 文化适配性检查
  ✅ 专业术语精确性核对
  ✅ 调性一致性测试

特别建议:
  ✅ es: 找墨西哥/拉丁裔母语者 review
  ✅ zh: 找简体中文母语者 review(我提供的中文已经较好)
  ✅ fr: 找法国/魁北克母语者 review
  ✅ de: 找德国母语者 review

工具推荐:
  - ProZ.com (专业译者市场)
  - Smartling (专业本地化)
  - 朋友圈寻找母语者(成本最低)
  - Fiverr (低成本但质量参差)
```

---

# Part 7: 多语言测试用例

## POJU 测试

```
Test 1: 默认英文
  Locale: en
  Input: "Should I take this job?"
  期望: 英文回复

Test 2: 中文界面 + 英文输入
  Locale: zh
  Input: "Should I take this job?"
  期望: 中文回复(以 Priority 1 为主)

Test 3: 用户对话中要求切换
  Locale: en
  Round 1: "Should I take this job?"
  AI Round 1: [英文]
  Round 2: "请用中文继续"
  AI Round 2: [中文] ← Priority 3 触发

Test 4: 中文输入 + 中文界面
  Locale: zh
  Input: "我应该接受这份工作吗?"
  期望: 中文回复

Test 5: 西班牙语界面 + 英文输入
  Locale: es
  Input: "Should I take this job?"
  期望: 西班牙语回复

Test 6: 5 个等级名验证
  Any locale + any input
  AI 输出中提到 5 个 Glyph 等级
  期望: 等级名【保持英文】(Divine Tailwind 等)
```

## Syncro 测试

```
Test 1: 各 locale 输出
  Locale: en, es, zh, fr, de
  Input: 出生 1990-05-15, 当前时间
  期望: 5 种语言对应输出
  期望: 8 个方向都用对应语言

Test 2: 品牌词验证
  各 locale
  期望: "Syncro" 不被翻译
  期望: 8 方位中文版用"北/东/南/西"还是 N/E/S/W?
        → 需要决策(我推荐 zh 用"北/东南"等中文方位)
```

## Glyph 测试

```
Test 1: 5 个等级 × 5 种语言 = 25 个测试
  期望: 报告完整,不丢字段,等级名保持英文

Test 2: JSON 结构验证
  期望: 所有语言输出的 JSON 结构一致
  (situation, meaning, wisdom, actions, reflections, revisit_timing)
```

---

# Part 8: 给 Cursor 的执行指令

```markdown
# 任务: POJU Fix 03 - LLM 多语言改造

## 阅读
@docs/POJU_Fix_03_LLM_Multilang.md (本文档)

## 实施时机

仅在以下条件全部满足时实施:
  ✅ Fix 02 完成
  ✅ next-intl 框架已搭建
  ✅ 准备接入 LLM API

## 实施步骤

### Step 1: 创建 language-directive.ts
  - 路径: src/lib/prompts/language-directive.ts
  - 内容: 见本文档 Part 3 完整代码
  - 包括 3 级判断逻辑

### Step 2: 更新 5 个 messages/*.json
  - en.json (主)
  - zh.json (简体中文)
  - es.json (墨西哥西班牙语)
  - fr.json (法语)
  - de.json (德语)
  - 内容: 见本文档 Part 5

### Step 3: 改造 3 个 API 路由
  - /api/poju/route.ts
  - /api/glyph/route.ts
  - /api/syncro/route.ts
  - 在每个路由中调用 getLanguageDirective()
  - 把指令拼接到 System Prompt 末尾

### Step 4: 前端传递 locale
  - 所有调用 API 的地方传 locale 参数
  - 用 useLocale() hook 获取当前 locale

### Step 5: 测试
  - 按 Part 7 的测试用例验证
  - 每种语言至少 3 个测试通过

## 严格要求

🚫 不要修改 3 份 System Prompt 主体(POJU/Glyph/Syncro)
🚫 不要硬编码 5 套 Prompt
🚫 不要预翻译 100 签数据
🚫 不要在 LLM 输出中翻译品牌名

✅ 只在 Prompt 末尾追加 Language Directive
✅ 用 single source of truth (英文 Prompt + 实时翻译)
✅ messages/*.json 用 next-intl 加载
```

---

# Part 9: 后续优化路径

```
现在(Fix 03 完成时):
  ✅ 多语言基础架构就位
  ✅ 网站界面 5 语言翻译完成(待 review)
  ✅ LLM 输出根据 3 级判断
  ✅ 上线测试就绪

上线后第 1 个月:
  ⏸️ 数据驱动:看哪种语言访问最多
  ⏸️ 优先 review + 优化最热门语言
  ⏸️ 收集 LLM 输出质量反馈

上线后 3 个月:
  ⏸️ 母语者 review 完成
  ⏸️ 翻译迭代 2-3 轮
  ⏸️ 各语言用户体验持平

上线后 6 个月:
  ⏸️ 看是否需要更多语言(日语/韩语/葡萄牙语)
  ⏸️ 评估翻译团队的需求
```

---

文档完成,1500+ 行,涵盖:
  ✅ 3 级语言判断完整逻辑
  ✅ 工程实现代码
  ✅ 5 种语言完整翻译(可直接用)
  ✅ 测试用例
  ✅ Cursor 执行指令

待 Fix 02 完成 + LLM API 接入时,直接交付给 Cursor 实施。
