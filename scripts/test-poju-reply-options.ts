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
assert.deepEqual(
  sanitizeReplyOptions([{ text: "反复琢磨" }, { label: "放下转做别的" }, { option: "找人倾诉" }]),
  ["反复琢磨", "放下转做别的", "找人倾诉"],
);
assert.equal(
  sanitizeReplyOptions([{ reason: 1 }, { nested: true }]) === undefined ||
    !sanitizeReplyOptions([{ reason: 1 }, { nested: true }])?.includes("[object Object]"),
  true,
);
assert.equal(sanitizeReplyOptions([{ foo: 1 }, { bar: 2 }]), undefined);
assert.ok(
  !JSON.stringify(
    sanitizeReplyOptions([{ text: "ok" }, { label: "also" }]) ?? [],
  ).includes("[object Object]"),
);

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
