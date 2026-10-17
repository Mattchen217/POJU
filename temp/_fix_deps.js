const fs = require("fs");
let ui = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
if (!ui.includes("session.dyad_offer_status,")) {
  // add to activeComposerOptions deps only - find the block after withoutDyad return
  const marker = "return withoutDyad.length >= 2 ? withoutDyad.slice(0, 3) : undefined;";
  const i = ui.indexOf(marker);
  if (i < 0) throw new Error("marker missing");
  const depsStart = ui.indexOf("}, [", i);
  const depsEnd = ui.indexOf("]);", depsStart);
  const deps = ui.slice(depsStart, depsEnd);
  if (!deps.includes("session.dyad_offer_status")) {
    ui = ui.slice(0, depsEnd) + "\n    session.dyad_offer_status," + ui.slice(depsEnd);
    fs.writeFileSync("components/poju/POJUChatUI.tsx", ui);
    console.log("deps added");
  }
} else console.log("deps already present somewhere");
const ui2 = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
const i = ui2.indexOf("return withoutDyad.length");
console.log(ui2.slice(i, i + 280));