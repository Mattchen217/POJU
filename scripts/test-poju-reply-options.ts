import assert from "node:assert/strict";
import {
  consumeReplyOptionsOnSession,
  sanitizeReplyOptions,
} from "@/lib/poju/reply-options";
import { userPickedProvidedOption } from "@/lib/poju/question-status";
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
assert.deepEqual(consumed.messages[0]?.options, ["x", "y"]);
assert.equal(consumed.messages[0]?.meta?.options_consumed, true);
assert.deepEqual(consumed.messages[0]?.meta?.offered_options, ["x", "y"]);
assert.equal(session.messages[0]?.options?.length, 2);

// After consume, pick detection must still work (root cause of phase-3 chip miss).
const withUser = {
  ...consumed,
  messages: [
    ...consumed.messages,
    { role: "user" as const, content: "x", timestamp: "3" },
  ],
} as POJUSessionState;
assert.equal(userPickedProvidedOption(withUser, "x"), true);
assert.equal(userPickedProvidedOption(withUser, "not-an-option"), false);

console.log("test-poju-reply-options: ok");
