const fs = require("fs");
const ui = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
const idx = ui.indexOf("dyad-compat");
console.log("idx", idx);
console.log(ui.slice(idx - 400, idx + 80));
console.log("count dyadGateChipsLocked", (ui.match(/dyadGateChipsLocked/g) || []).length);