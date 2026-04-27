type MockChunk =
  | { type: "thinking"; text: string; delayMs: number }
  | { type: "answer"; text: string; summon?: "syncro" | "oracle"; phaseFive?: boolean };

const thinkingLines = [
  '✦ 道家云："天下大事必作于细"...',
  "✦ checking: your timing vs. career cycles",
  "✦ 先看你提到的关系张力与行动惯性",
  "✦ matching: Daoist Wu Wei framework",
  "✦ 这个局里最先该动的不是结果，是节奏",
];

export function buildMockResponse(userInput: string): MockChunk[] {
  const normalized = userInput.toLowerCase();
  const askOracle = normalized.includes("sign") || normalized.includes("启示");
  const askSyncro =
    normalized.includes("space") || normalized.includes("room") || normalized.includes("方向") || normalized.includes("desk");
  const phaseFive = normalized.includes("plan") || normalized.includes("行动") || normalized.includes("具体");

  // Task 2 约束：思考阶段动态时长，且总时长保持 5-30 秒
  const inputLen = Math.max(userInput.trim().length, 1);
  const targetTotalMs = Math.min(30000, Math.max(5000, 4500 + inputLen * 120));
  const baseWeights = [0.18, 0.22, 0.2, 0.22, 0.18];
  const delays = baseWeights.map((w) => Math.round(targetTotalMs * w));

  return [
    { type: "thinking", text: thinkingLines[0], delayMs: delays[0] },
    { type: "thinking", text: thinkingLines[1], delayMs: delays[1] },
    { type: "thinking", text: thinkingLines[2], delayMs: delays[2] },
    { type: "thinking", text: thinkingLines[3], delayMs: delays[3] },
    { type: "thinking", text: thinkingLines[4], delayMs: delays[4] },
    {
      type: "answer",
      text: phaseFive
        ? "你现在卡住的核心不是能力不足，而是动作顺序错了。先回应：你已经看见问题的中心。再分析：从事理看，你把“验证方向”和“证明价值”绑在了一次动作里，负担过重；从心理看，你在害怕做小步会被别人误读，所以迟迟不动。今天动作：先做一个 20 分钟可完成的最小动作，并在今晚写下“做完后真实反馈”。本周动作：连续 3 天重复同一最小动作，收集证据再升级。这样你会从焦虑循环切回可验证循环。"
        : "先回应你：你并不是没有答案，而是答案被噪音盖住了。分析上看，你现在同时背着“结果压力”和“关系压力”，所以每个选择都会被放大成输赢。POJU 的建议是先把问题压缩成一句话：‘如果只能做一件事，我最怕失去什么？’今天动作：写下这句话并给它一个 1-10 的紧迫分；本周动作：只执行一个与你分值最高项相关的小动作，不追求完美，只追求可持续。你会更快看到局势回正。",
      summon: askSyncro ? "syncro" : askOracle ? "oracle" : undefined,
      phaseFive,
    },
  ];
}
