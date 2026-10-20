const fs=require("fs");
const path=require("path");
// i18n request config
for (const f of ["i18n/request.ts","i18n/routing.ts","next.config.ts","next.config.mjs","next.config.js"]) {
  if (fs.existsSync(f)) console.log("====",f,"====\n",fs.readFileSync(f,"utf8").slice(0,2500));
}
// mobile drawer
console.log("==== MobileDrawer ====");
const md=fs.readFileSync("components/layout/mobile-drawer.tsx","utf8");
console.log(md.slice(0,2500));
