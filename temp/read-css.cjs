const fs=require("fs");
const html=fs.readFileSync("public/v2-landing.html","utf8");
// find CSS for v2-product
const m=html.match(/\.v2-product-[^{]+\{[^}]+\}/g);
console.log((m||[]).slice(0,40).join("\n\n"));
console.log("\n==== style blocks mentioning product/carousel ====");
const lines=html.split(/\r?\n/);
lines.forEach((l,i)=>{ if(/v2-product|carousel|object-position|clip|mask/.test(l) && i<800) console.log((i+1)+": "+l.trim().slice(0,160)); });
