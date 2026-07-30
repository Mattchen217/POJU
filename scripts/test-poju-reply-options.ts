import assert from "node:assert/strict";
import {
  consumeReplyOptionsOnSession,
  sanitizeReplyOptions,
} from "@/lib/poju/reply-options";
import type { POJUSessionState } from "@/lib/poju/types";

assert.equal(sanitizeReplyOptions(null), undefined);
assert.equal(sanitizeReplyOptions(["only one"]), undefined);
assert.deepEqual(sanitizeReplyOptions(["a", "b"]), ["a", "b"]);
assert.deepEqual(sanitizeReplyOptions(["a", "b", "c", "d"]), ["a", "b", "c"]);
assert.deepEqual(sanitizeReplyOptions(["  a  ", "", "b"]), ["a", "b"]);

const session = {
  messages: [
    {
      role: "assistant" as const,
      content: "warm body",
      timestamp: "1",
      options: ["x", "y"],
    },
    {
      role: "user" as const,
      content: "hello",
      timestamp: "2",
    },
  ],
} as POJUSessionState;

const consumed = consumeReplyOptionsOnSession(session);
assert.equal(consumed.messages[0]?.options, undefined);
assert.equal(consumed.messages[0]?.meta?.options_consumed, true);
assert.equal(session.messages[0]?.options?.length, 2);

console.log("test-poju-reply-options: ok");
