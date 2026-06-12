import fs from "fs";

let css = fs.readFileSync("docs/poju-chat-offline.css", "utf8");
css = css.replace(
  'url("4f5b7f85-31a0-46aa-9383-ffbd22e7d99d")',
  'url("/pchat-starfield.svg")',
);

/* Sidebar uses shared .poju-new-session-btn — drop legacy purple CTA rules. */
css = css.replace(/\.pchat__newbtn[^}]*\{[^}]*\}/gs, "");
css = css.replace(/\.pchat__sidebar \.pchat__newbtn[^}]*\{[^}]*\}/g, "");

const header = `/* ============================================================
   poju-chat.css — POJU chat UI (poju-chat-offline.html design)
   ============================================================ */

@import "../../styles/poju-new-session-btn.css";

`;

fs.writeFileSync("components/poju/poju-chat.css", header + css);
console.log("wrote components/poju/poju-chat.css", header.length + css.length, "bytes");
