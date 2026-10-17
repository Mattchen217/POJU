const fs = require("fs");
let ui = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
if (!ui.includes("dyadGateChipsLocked,")) {
  ui = ui.replace(
    "  dyadSkipPatch,\n  matchDyadGateAction,\n} from \"@/lib/poju/dyad-compat\";",
    "  dyadSkipPatch,\n  dyadGateChipsLocked,\n  matchDyadGateAction,\n} from \"@/lib/poju/dyad-compat\";"
  );
  if (!ui.includes("dyadGateChipsLocked,")) {
    ui = ui.replace(
      "  dyadSkipPatch,\r\n  matchDyadGateAction,\r\n} from \"@/lib/poju/dyad-compat\";",
      "  dyadSkipPatch,\r\n  dyadGateChipsLocked,\r\n  matchDyadGateAction,\r\n} from \"@/lib/poju/dyad-compat\";"
    );
  }
  fs.writeFileSync("components/poju/POJUChatUI.tsx", ui);
}
const ui2 = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
const idx = ui2.indexOf("dyad-compat");
console.log(ui2.slice(idx - 220, idx + 40));
console.log("import count", (ui2.match(/dyadGateChipsLocked/g) || []).length);