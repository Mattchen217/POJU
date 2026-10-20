const fs=require("fs");
const landing=fs.readFileSync("public/v2-landing.html","utf8");
console.log("ES L4", landing.includes("Los Pass de una sola compra sin usar se pueden reembolsar en detalles de PASS"));
console.log("FR L4", landing.includes("Les Pass ponctuels non utilisés peuvent être remboursés dans les détails PASS"));
// extract card1 features for each locale roughly
const m=landing.match(/PRICING_I18N\s*=\s*\{([\s\S]*?)\n\s*\};\s*\n/);
if(m){
  const block=m[1];
  for (const needle of ["one-click","一键退款","un clic","en un clic","Unused one-time","未使用的一次性","Los Pass de una sola","Les Pass ponctuels"]) {
    const idx=block.indexOf(needle);
    console.log(needle, idx>=0?"FOUND":"absent");
  }
}
