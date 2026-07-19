/**
 * Static acceptance for opening scope gate + attachment modules (no live LLM).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const opening = read("lib/llm/phases/opening-phase-v6.ts");
assert.match(opening, /scope_signal/);
assert.match(opening, /out_of_scope/);
assert.match(opening, /scopeMismatchMessage/);
assert.doesNotMatch(opening, /例如：|例如:|for example:|e\.g\./i);

const scope = read("lib/poju/scope-mismatch.ts");
assert.match(scope, /scopeMismatchMessage/);
assert.match(scope, /parseScopeSignal/);

const vision = read("lib/poju/attachments/vision-bridge.ts");
assert.match(vision, /minimax\/minimax-m3/);
assert.match(vision, /禁止在输出中使用任何示例/);
assert.doesNotMatch(vision, /手相学任务|掌纹专家/);

const client = read("lib/poju/attachments/client.ts");
assert.match(client, /isLikelyMobileClient/);
assert.match(client, /filesFromClipboard|fileToComposerAttachment/);

const chatUi = read("components/poju/POJUChatUI.tsx");
assert.match(chatUi, /attachmentsUnlocked/);
assert.match(chatUi, /ingestComposerFiles/);
assert.match(chatUi, /attachment:/);

const pojuChat = read("components/poju/PojuChat.tsx");
assert.match(pojuChat, /onDrop/);
assert.match(pojuChat, /onPaste/);
assert.match(pojuChat, /onContextMenu/);
assert.match(pojuChat, /runCtxAction/);

const zh = read("messages/zh.json");
assert.match(zh, /"scope_mismatch"/);
assert.match(zh, /"ctx_paste"/);

console.log("test-poju-scope-mismatch: OK");
