const fs = require("fs");
const path = "scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(path, "utf8");
const old = `    assert.equal(
      result.outcome,
      "frozen",
      result.error ?? \`freeze outcome=\${result.outcome}\`,
    );
    const session = await durable(result.session.session_id);`;
const neu = `    assert.equal(
      result.outcome,
      "frozen",
      result.error ?? \`freeze outcome=\${result.outcome}\`,
    );
    await savePOJUSession(result.session);
    const session = await durable(result.session.session_id);`;
if (!s.includes(old)) { console.error("not found"); process.exit(1); }
s = s.replace(old, neu);
fs.writeFileSync(path, s);
console.log("save after freeze added");
