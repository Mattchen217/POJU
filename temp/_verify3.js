const fs = require("fs");
const ui = fs.readFileSync("components/poju/POJUChatUI.tsx", "utf8");
const i = ui.indexOf("const cleaned = last.options");
console.log(ui.slice(i, i + 550));
console.log("---deps---");
const j = ui.indexOf("understandingGatePending,\n    deliveryConfirmPending");
const j2 = j < 0 ? ui.indexOf("understandingGatePending,\r\n    deliveryConfirmPending") : j;
console.log(ui.slice(j2, j2 + 220));