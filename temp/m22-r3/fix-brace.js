const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
const raw = fs.readFileSync(path, "utf8");
const lines = raw.split(/\r?\n/);
let removed = false;
for (let i = 0; i < lines.length - 3; i++) {
  if (
    lines[i] === "        }" &&
    lines[i + 1] === "        }" &&
    lines[i + 2] === "      }" &&
    lines[i + 3] === "    } else {"
  ) {
    lines.splice(i + 1, 1);
    removed = true;
    console.log("removed duplicate brace at index", i + 1);
    break;
  }
}
if (!removed) {
  console.error("pattern not found");
  process.exit(1);
}
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("wrote");
