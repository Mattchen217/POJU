const fs = require("fs");
let ui = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
ui = ui.replace(
  "    sessionLang,\n  \n    session.dyad_offer_status,]);",
  "    sessionLang,\n    session.dyad_offer_status,\n  ]);"
);
ui = ui.replace(
  "    sessionLang,\r\n  \r\n    session.dyad_offer_status,]);",
  "    sessionLang,\r\n    session.dyad_offer_status,\r\n  ]);"
);
// also handle the exact broken form we saw
ui = ui.replace(/sessionLang,\r?\n\s*\r?\n\s*session\.dyad_offer_status,\]\);/, "sessionLang,\n    session.dyad_offer_status,\n  ]);");
fs.writeFileSync("components/poju/POJUChatUI.tsx", ui);
const i = ui.indexOf("return withoutDyad.length");
console.log(JSON.stringify(ui.slice(i, i + 300)));