import { extractStreamingResponseText } from "@/lib/poju/extract-streaming-response";

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
