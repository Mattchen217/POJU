const fs = require("fs");
const path = "scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(path, "utf8");
const old = `    const result = await confirmUnderstandingAndFreeze({
      session: ready,
      confirmation_turn_id: "turn_confirm",
      confirmation_text: "确认",
      now: nowIso,
    });
    assert.equal(result.ok, true, result.error ?? "freeze failed");
    const session = await durable(ready.session_id);`;
const neu = `    const result = await confirmUnderstandingAndFreeze({
      session: ready,
      statement: "确认",
      confirmation_turn_id: "turn_confirm",
      now: nowIso,
    });
    assert.equal(
      result.outcome,
      "frozen",
      result.error ?? \`freeze outcome=\${result.outcome}\`,
    );
    const session = await durable(result.session.session_id);`;
if (!s.includes(old)) {
  console.error("freezeSession block not found");
  process.exit(1);
}
s = s.replace(old, neu);
fs.writeFileSync(path, s);
console.log("test freezeSession API fixed");
