import {
  extractStreamingResponseText,
  salvagePhaseResponseText,
} from "@/lib/poju/extract-streaming-response";
import { parsePhaseResult, isPhaseResponseFallback, resolveStreamedCompleteResponse } from "@/lib/llm/phases/phase-transport";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${name}`);
}

const partial = '{\n"response": "Then you come back. Not as the man';
assert(
  "partial JSON yields response text only",
  extractStreamingResponseText(partial) === "Then you come back. Not as the man",
);

assert(
  "JSON skeleton before value is empty",
  extractStreamingResponseText('{\n"response":') === "",
);

assert(
  "JSON skeleton with opening quote only is empty",
  extractStreamingResponseText('{\n"response": "') === "",
);

assert(
  "complete JSON parses response",
  extractStreamingResponseText('{"response":"你好\\n\\n世界"}') === "你好\n\n世界",
);

assert(
  "does not leak raw JSON wrapper",
  !extractStreamingResponseText('{\n"response": "hello').includes('"response"'),
);

// Unescaped ASCII quotes inside response (classic LLM JSON pitfall)
const leakyQuotes =
  '{"response":"八年,不是没想过,是没遇到那个让你觉得"对了"的人。","options":["选项一","选项二"]}';
assert(
  "streaming keeps full response despite unescaped inner quotes",
  extractStreamingResponseText(leakyQuotes).includes("对了") &&
    extractStreamingResponseText(leakyQuotes).includes("的人") &&
    !extractStreamingResponseText(leakyQuotes).endsWith("觉得"),
);

assert(
  "salvage keeps full response despite unescaped inner quotes",
  salvagePhaseResponseText(leakyQuotes).includes('觉得"对了"的人'),
);

assert(
  "escaped quotes still parse normally",
  extractStreamingResponseText('{"response":"那个\\"对了\\"的人","options":[]}') ===
    '那个"对了"的人',
);

assert(
  "salvage reply field",
  salvagePhaseResponseText('{"reply":"Hello from reply field."}') === "Hello from reply field.",
);

assert(
  "salvage message field",
  salvagePhaseResponseText('{"message":"Hello from message field."}') === "Hello from message field.",
);

assert(
  "salvage nested message.content",
  salvagePhaseResponseText('{"message":{"content":"Nested content works."}}') === "Nested content works.",
);

assert(
  "salvage longest prose string as last resort",
  salvagePhaseResponseText(
    '{"thought":{"breakthrough_hypotheses":["a"]},"text":"This is a long alternate body field for salvage testing."}',
  ).includes("long alternate body"),
);

assert(
  "agenda-only truncated does not invent prose salvage",
  salvagePhaseResponseText(
    '{"thought":{"breakthrough_hypotheses":["a"]}, "investigation_agenda": [',
  ) === "",
);

assert(
  "agenda-only truncated resolveStreamed gets infrastructure fallback",
  isPhaseResponseFallback(
    resolveStreamedCompleteResponse(
      "",
      '{"thought":{"breakthrough_hypotheses":["a"]}, "investigation_agenda": [',
      "zh",
    ),
  ),
);

assert(
  "parsePhaseResult uses salvage for reply",
  parsePhaseResult('{"reply":"Salvaged via parsePhaseResult."}').response.includes("Salvaged"),
);

assert(
  "salvage strips reasoning prefix before JSON",
  salvagePhaseResponseText(
    'Let me think through this carefully first.\n{"response":"Body after reasoning prefix."}',
  ) === "Body after reasoning prefix.",
);

assert(
  "salvage prose when no JSON structure",
  salvagePhaseResponseText("This is plain prose without any JSON wrapper at all.") ===
    "This is plain prose without any JSON wrapper at all.",
);

assert(
  "resolveStreamedCompleteResponse keeps streamed over fallback",
  resolveStreamedCompleteResponse(
    "[POJU] 本轮回复未能生成，请重试发送。会话已保存。",
    "Already streamed valid reply text here.",
    "zh",
  ) === "Already streamed valid reply text here.",
);

assert(
  "isPhaseResponseFallback detects infrastructure copy",
  isPhaseResponseFallback("[POJU] Reply could not be generated. Please send again."),
);
