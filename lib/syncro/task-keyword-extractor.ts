/**
 * Syncro v5.1 — task type detection from description keywords.
 * @see docs/Syncro_Calculation_Engine.md Step 3
 */

export type TaskType =
  | "wealth"
  | "career"
  | "relationship"
  | "health"
  | "decision"
  | "travel"
  | "communication"
  | "creation"
  | "other";

export interface TaskKeywords {
  primary_type: TaskType;
  secondary_types: TaskType[];
  raw_keywords: string[];
}

const KEYWORD_PATTERNS: Record<Exclude<TaskType, "other">, RegExp[]> = {
  wealth: [
    /\b(money|wealth|invest|business|sale|deal|contract|profit|finance|sign|close)\b/i,
    /(钱|财|生意|签|投资|赚|收入|合同|交易|销售|买|卖|商谈)/,
  ],
  career: [
    /\b(job|career|interview|promote|hire|resign|work|company|boss|colleague)\b/i,
    /(工作|事业|面试|升职|跳槽|辞职|公司|老板|同事|项目)/,
  ],
  relationship: [
    /\b(meet|date|partner|marry|wedding|divorce|relationship|friend|family|conflict)\b/i,
    /(感情|对象|结婚|约会|分手|相亲|朋友|家人|矛盾|冲突|和好)/,
  ],
  health: [
    /\b(health|hospital|doctor|sick|exercise|sleep|medicine)\b/i,
    /(健康|医院|医生|生病|锻炼|睡觉|吃药|身体)/,
  ],
  decision: [
    /\b(decide|choose|whether|should|or|either)\b/i,
    /(决定|选择|要不要|是否|该不该)/,
  ],
  travel: [
    /\b(travel|trip|fly|visit|move|relocate|airport|flight)\b/i,
    /(出行|出差|旅行|搬家|飞机|火车|远行)/,
  ],
  communication: [
    /\b(talk|discuss|negotiate|present|speech|email|message)\b/i,
    /(谈话|讨论|沟通|演讲|汇报|说服|对话)/,
  ],
  creation: [
    /\b(create|write|design|study|learn|exam|test|build)\b/i,
    /(创作|写作|写|设计|学习|考试|做|制作|建立|代码)/,
  ],
};

const TASK_TYPES: TaskType[] = [
  "wealth",
  "career",
  "relationship",
  "health",
  "decision",
  "travel",
  "communication",
  "creation",
  "other",
];

export function extractTaskKeywords(taskDescription: string): TaskKeywords {
  const matches: Record<TaskType, number> = {
    wealth: 0,
    career: 0,
    relationship: 0,
    health: 0,
    decision: 0,
    travel: 0,
    communication: 0,
    creation: 0,
    other: 0,
  };

  const rawKeywords: string[] = [];

  for (const type of TASK_TYPES) {
    if (type === "other") continue;
    for (const pattern of KEYWORD_PATTERNS[type]) {
      const matchResult = taskDescription.match(pattern);
      if (matchResult) {
        matches[type] += matchResult.length;
        rawKeywords.push(...matchResult);
      }
    }
  }

  let primaryType: TaskType = "other";
  let primaryCount = 0;
  for (const type of TASK_TYPES) {
    if (matches[type] > primaryCount) {
      primaryCount = matches[type];
      primaryType = type;
    }
  }

  const secondaryTypes: TaskType[] = [];
  for (const type of TASK_TYPES) {
    if (type !== primaryType && type !== "other" && matches[type] > 0) {
      secondaryTypes.push(type);
    }
  }

  return {
    primary_type: primaryType,
    secondary_types: secondaryTypes,
    raw_keywords: [...new Set(rawKeywords)],
  };
}

export const TASK_TO_QIMEN_FAVORED_DOORS: Record<TaskType, string[]> = {
  wealth: ["生門", "開門"],
  career: ["開門", "生門"],
  relationship: ["休門", "生門"],
  health: ["休門", "生門"],
  decision: ["開門", "景門"],
  travel: ["開門", "生門"],
  communication: ["景門", "開門"],
  creation: ["景門", "生門"],
  other: ["開門"],
};

export const TASK_TO_DIRECTION_BONUS: Record<TaskType, Record<string, number>> = {
  wealth: { SE: 5, E: 3 },
  career: { S: 5, SE: 3 },
  relationship: { SW: 5, NE: 3 },
  health: { N: 3, E: 3 },
  decision: { W: 5, NW: 3 },
  travel: { NW: 5, E: 3 },
  communication: { E: 3, S: 3 },
  creation: { S: 3, SE: 3 },
  other: {},
};
